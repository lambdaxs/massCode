import type { GrsaiGenerateResponse } from '../../shared/aiPrototype'
import { request as undiciRequest } from 'undici'

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, '')
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
      aspectRatio: options.aspectRatio,
      replyType: 'async',
    }),
  })

  const body = (await response.body.json()) as GrsaiGenerateResponse
  if (response.statusCode >= 400) {
    throw new Error(body.error || `GENERATE_FAILED:${response.statusCode}`)
  }

  return body
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
