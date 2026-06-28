import fs from 'node:fs'
import path from 'node:path'
import { Agent, JsonlLocalAgentStore } from '@cursor/sdk'

function readPayload() {
  const inline = process.argv[2]
  if (inline) {
    return JSON.parse(inline)
  }

  return JSON.parse(fs.readFileSync(0, 'utf8'))
}

function writeResult(result) {
  process.stdout.write(`${JSON.stringify(result)}\n`)
}

function getStore(cwd) {
  const storeDir = path.join(cwd, '.cursor-agent-store')
  fs.mkdirSync(storeDir, { recursive: true })
  return new JsonlLocalAgentStore(storeDir)
}

function buildOptions(payload) {
  return {
    apiKey: payload.apiKey,
    model: { id: payload.model },
    local: {
      cwd: payload.cwd,
      store: getStore(payload.cwd),
      settingSources: [],
    },
    name: payload.name ?? 'ai-prototype',
  }
}

async function runSend(payload) {
  const options = buildOptions(payload)
  const agent = payload.cursorAgentId
    ? await Agent.resume(payload.cursorAgentId, options)
    : await Agent.create(options)

  try {
    const run = await agent.send(payload.message)
    const outcome = await run.wait()

    if (outcome.status === 'error') {
      writeResult({ ok: false, error: 'CURSOR_RUN_FAILED' })
      process.exit(2)
    }

    writeResult({
      ok: true,
      text: outcome.result?.trim() ?? '',
      agentId: agent.agentId,
    })
  }
  finally {
    agent.close()
  }
}

async function runPrompt(payload) {
  const outcome = await Agent.prompt(payload.message, buildOptions(payload))

  if (outcome.status === 'error') {
    writeResult({ ok: false, error: 'CURSOR_RUN_FAILED' })
    process.exit(2)
  }

  writeResult({
    ok: true,
    text: outcome.result?.trim() ?? '',
  })
}

async function main() {
  const payload = readPayload()

  if (!payload?.apiKey || !payload?.model || !payload?.cwd || !payload?.message) {
    writeResult({ ok: false, error: 'BRIDGE_INVALID_PAYLOAD' })
    process.exit(1)
  }

  if (payload.action === 'prompt') {
    await runPrompt(payload)
    return
  }

  await runSend(payload)
}

main().catch((error) => {
  writeResult({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  })
  process.exit(1)
})
