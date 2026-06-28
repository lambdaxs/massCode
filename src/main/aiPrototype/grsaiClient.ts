import type { GrsaiGenerateResponse } from '../../shared/aiPrototype'
import { request as undiciRequest } from 'undici'
import { AI_PROTOTYPE_CREDITS_TOKEN } from '../../shared/aiPrototype'

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
}

function normalizeAspectRatio(aspectRatio: string): string {
  const normalized = aspectRatio.trim().toLowerCase()
  const pixelMap: Record<string, string> = {
    '1024x1024': '1:1',
    '768x1024': '3:4',
    '1024x768': '4:3',
    '768x1344': '9:16',
    '1344x768': '16:9',
  }

  return pixelMap[normalized] ?? aspectRatio.trim()
}

export async function submitGrsaiGenerate(options: {
  baseUrl: string
  apiKey: string
  model: string
  prompt: string
  images: string[]
  aspectRatio: string
}): Promise<GrsaiGenerateResponse> {
  const url = `${normalizeBaseUrl(options.baseUrl)}/v1/api/generate`
  const response = await undiciRequest(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: options.model,
      prompt: options.prompt,
      images: options.images,
      aspectRatio: normalizeAspectRatio(options.aspectRatio),
      replyType: 'async',
    }),
  })

  const body = (await response.body.json()) as GrsaiGenerateResponse
  if (response.statusCode >= 400) {
    throw new Error(body.error || `GENERATE_FAILED:${response.statusCode}`)
  }

  return body
}

function parseNumericCredits(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.replace(/,/g, ''))
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

export function parseGrsaiCreditsResponse(body: unknown): number {
  const record = body as {
    code?: number | string
    data?: unknown
    msg?: string
  }

  const code = Number(record.code)
  if (!Number.isFinite(code) || code !== 0) {
    throw new Error(record.msg || 'CREDITS_FAILED')
  }

  if (typeof record.data === 'number') {
    const direct = parseNumericCredits(record.data)
    if (direct !== null) {
      return direct
    }
  }

  if (record.data && typeof record.data === 'object') {
    const dataRecord = record.data as Record<string, unknown>
    const parsed = parseNumericCredits(
      dataRecord.credits ?? dataRecord.credit ?? dataRecord.balance,
    )
    if (parsed !== null) {
      return parsed
    }
  }

  throw new TypeError('CREDITS_INVALID')
}

export async function fetchGrsaiCredits(options: {
  baseUrl: string
}): Promise<number> {
  const url = `${normalizeBaseUrl(options.baseUrl)}/client/openapi/getCredits`
  const response = await undiciRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      token: AI_PROTOTYPE_CREDITS_TOKEN,
    }),
  })

  const body = await response.body.json()

  if (response.statusCode >= 400) {
    throw new Error(`CREDITS_HTTP_${response.statusCode}`)
  }

  return parseGrsaiCreditsResponse(body)
}

export async function fetchGrsaiResult(options: {
  baseUrl: string
  apiKey: string
  taskId: string
}): Promise<GrsaiGenerateResponse> {
  const url = new URL(`${normalizeBaseUrl(options.baseUrl)}/v1/api/result`)
  url.searchParams.set('id', options.taskId)

  const response = await undiciRequest(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
    },
  })

  const body = (await response.body.json()) as GrsaiGenerateResponse
  if (response.statusCode >= 400) {
    throw new Error(body.error || `RESULT_FAILED:${response.statusCode}`)
  }

  return body
}
