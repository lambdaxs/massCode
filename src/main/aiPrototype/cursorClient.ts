import { execSync, spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { app } from 'electron'

export interface CursorClientSettings {
  apiKey: string
  model: string
  cwd: string
  cursorAgentId?: string
  name?: string
}

interface CursorBridgePayload {
  action: 'send' | 'prompt'
  apiKey: string
  model: string
  cwd: string
  message: string
  cursorAgentId?: string
  name?: string
}

interface CursorBridgeResult {
  ok: boolean
  text?: string
  agentId?: string
  error?: string
}

let cachedNodeBinary: string | null = null

function getBridgeScriptPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'cursor-agent-bridge.mjs')
  }

  return path.join(
    app.getAppPath(),
    'scripts/ai-prototype/cursor-agent-bridge.mjs',
  )
}

function parseNodeVersion(version: string): { major: number, minor: number } {
  const [majorRaw, minorRaw] = version.split('.')
  return {
    major: Number(majorRaw) || 0,
    minor: Number(minorRaw) || 0,
  }
}

function isSupportedNodeVersion(version: string): boolean {
  const { major, minor } = parseNodeVersion(version)
  return major > 22 || (major === 22 && minor >= 13)
}

function resolveNodeBinary(): string {
  if (cachedNodeBinary) {
    return cachedNodeBinary
  }

  const envPath = process.env.MASSCODE_NODE_PATH?.trim()
  const candidates = [
    envPath,
    '/opt/homebrew/bin/node',
    '/usr/local/bin/node',
    'node',
  ].filter((value): value is string => Boolean(value))

  for (const candidate of candidates) {
    try {
      const version = execSync(`"${candidate}" -p "process.versions.node"`, {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()

      if (isSupportedNodeVersion(version)) {
        cachedNodeBinary = candidate
        return candidate
      }
    }
    catch {
      continue
    }
  }

  throw new Error('NODE_22_REQUIRED')
}

function getProjectRoot(): string {
  return app.getAppPath()
}

function getBridgeEnv(apiKey: string): NodeJS.ProcessEnv {
  const projectRoot = getProjectRoot()
  const nodePath = [
    path.join(projectRoot, 'node_modules'),
    process.env.NODE_PATH,
  ]
    .filter(Boolean)
    .join(path.delimiter)

  return {
    ...process.env,
    NODE_PATH: nodePath,
    CURSOR_API_KEY: apiKey,
  }
}

function runCursorBridge(
  payload: CursorBridgePayload,
): Promise<CursorBridgeResult> {
  const bridgePath = getBridgeScriptPath()
  if (!fs.existsSync(bridgePath)) {
    return Promise.reject(new Error('CURSOR_BRIDGE_MISSING'))
  }

  const nodeBinary = resolveNodeBinary()
  const args = [bridgePath, JSON.stringify(payload)]
  const projectRoot = getProjectRoot()

  return new Promise((resolve, reject) => {
    const child = spawn(nodeBinary, args, {
      cwd: projectRoot,
      env: getBridgeEnv(payload.apiKey),
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')

    child.stdout.on('data', (chunk: string) => {
      stdout += chunk
    })

    child.stderr.on('data', (chunk: string) => {
      stderr += chunk
    })

    child.on('error', (error) => {
      reject(error)
    })

    child.on('close', () => {
      const trimmedStdout = stdout.trim()
      const trimmedStderr = stderr.trim()

      if (!trimmedStdout) {
        if (trimmedStderr.includes('node:sqlite')) {
          reject(new Error('NODE_22_REQUIRED'))
          return
        }

        if (trimmedStderr.includes('@connectrpc/connect-node')) {
          reject(new Error('CURSOR_BRIDGE_DEPS_MISSING'))
          return
        }

        reject(new Error(trimmedStderr || 'CURSOR_BRIDGE_FAILED'))
        return
      }

      let parsed: CursorBridgeResult
      try {
        parsed = JSON.parse(trimmedStdout) as CursorBridgeResult
      }
      catch {
        reject(new Error('CURSOR_BRIDGE_INVALID_RESPONSE'))
        return
      }

      if (!parsed.ok) {
        reject(new Error(parsed.error || 'CURSOR_RUN_FAILED'))
        return
      }

      resolve(parsed)
    })
  })
}

export async function runCursorAgentMessage(
  settings: CursorClientSettings,
  message: string,
): Promise<{ text: string, agentId: string }> {
  const result = await runCursorBridge({
    action: 'send',
    apiKey: settings.apiKey,
    model: settings.model,
    cwd: settings.cwd,
    cursorAgentId: settings.cursorAgentId,
    name: settings.name,
    message,
  })

  return {
    text: result.text ?? '',
    agentId: result.agentId ?? settings.cursorAgentId ?? '',
  }
}

export async function runCursorOneShotPrompt(
  settings: Omit<CursorClientSettings, 'cursorAgentId'>,
  message: string,
): Promise<string> {
  const result = await runCursorBridge({
    action: 'prompt',
    apiKey: settings.apiKey,
    model: settings.model,
    cwd: settings.cwd,
    name: settings.name,
    message,
  })

  return result.text ?? ''
}

export function isCursorStartupError(_error: unknown): boolean {
  return false
}

export function formatCursorError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}
