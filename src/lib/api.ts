import { getFroamStudioConfig } from '../config'

type ApiOptions = {
  method?: string
  body?: unknown
  cache?: boolean
}

type ApiErrorShape = {
  error?: string
  details?: unknown
}

export class FroamStudioApiError extends Error {
  status: number
  details?: unknown

  constructor(message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'FroamStudioApiError'
    this.status = status
    this.details = details
  }
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

function resolveEndpoint(endpoint: string) {
  if (/^https?:\/\//i.test(endpoint)) return endpoint

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  const baseUrl = getFroamStudioConfig().apiBaseUrl?.trim()
  return baseUrl ? `${trimTrailingSlash(baseUrl)}${normalizedEndpoint}` : normalizedEndpoint
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function safelyParseJson(value: string) {
  try {
    return JSON.parse(value)
  } catch {
    return { raw: value }
  }
}

export async function api<T = unknown>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = 'GET', body, cache = false } = options
  const fetcher = getFroamStudioConfig().fetch ?? globalThis.fetch

  if (!fetcher) {
    throw new FroamStudioApiError('Froam Studio could not find a fetch implementation.', 0)
  }

  const normalizedMethod = method.toUpperCase()
  const headers: Record<string, string> = {}
  const request: RequestInit = {
    method: normalizedMethod,
    credentials: 'include',
    cache: cache ? 'default' : 'no-store',
    headers,
  }

  if (body !== undefined && normalizedMethod !== 'GET') {
    headers['Content-Type'] = 'application/json'
    request.body = JSON.stringify(body)
  }

  const response = await fetcher(resolveEndpoint(endpoint), request)
  const rawText = await response.text()
  const data = rawText ? safelyParseJson(rawText) : null

  if (!response.ok) {
    const errorData: ApiErrorShape | null = isRecord(data) ? data : null
    let message = typeof errorData?.error === 'string'
      ? errorData.error
      : `Froam Studio API Error ${response.status}`

    if (errorData?.details) message += `: ${JSON.stringify(errorData.details)}`
    throw new FroamStudioApiError(message, response.status, errorData?.details)
  }

  return data as T
}

export const apiGetFresh = <T = unknown>(endpoint: string) => api<T>(endpoint, { cache: false })
export const apiPost = <T = unknown>(endpoint: string, body: unknown) => api<T>(endpoint, { method: 'POST', body })
export const apiDelete = <T = unknown>(endpoint: string) => api<T>(endpoint, { method: 'DELETE' })
