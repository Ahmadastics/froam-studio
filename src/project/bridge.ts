import { bridgeUrl } from '../lib/bridge'
import { coerceFroamProjectFile, isFroamProjectFile, type FroamProjectFile } from './serialization'
import type { FroamIntelligenceErrorResponse, FroamIntelligenceNotConfiguredResponse, FroamIntelligenceRequest, FroamIntelligenceResponse } from './intelligence-transport'

export async function loadProjectFromBridge(fetchImpl: typeof fetch = fetch): Promise<FroamProjectFile | null> {
  const response = await fetchImpl(bridgeUrl('/__froam/repo/project/load'), { cache: 'no-store' })
  if (!response.ok) throw new Error(`Could not load Froam project (${response.status})`)
  const payload = await response.json() as { project?: unknown }
  return coerceFroamProjectFile(payload.project)
}

export async function saveProjectToBridge(project: FroamProjectFile, fetchImpl: typeof fetch = fetch) {
  if (!isFroamProjectFile(project)) throw new Error('Cannot save an invalid Froam project')
  const response = await fetchImpl(bridgeUrl('/__froam/repo/project/save'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(project),
  })
  const payload = await response.json() as { success?: boolean; error?: string }
  if (!response.ok || !payload.success) throw new Error(payload.error || `Could not save Froam project (${response.status})`)
  return payload
}

/**
 * Browser-safe intelligence planning client.
 * Calls the Froam bridge intelligence endpoint.
 * No provider credentials or model-specific logic lives here.
 */
export async function requestFroamIntelligence(
  request: FroamIntelligenceRequest,
  fetchImpl: typeof fetch = fetch,
  signal?: AbortSignal,
): Promise<FroamIntelligenceResponse | FroamIntelligenceNotConfiguredResponse> {
  const body = JSON.stringify(request)
  const response = await fetchImpl(bridgeUrl('/__froam/intelligence/plan'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal,
  })
  let payload: FroamIntelligenceResponse | FroamIntelligenceNotConfiguredResponse | FroamIntelligenceErrorResponse
  try {
    payload = await response.json() as typeof payload
  } catch {
    throw new Error('provider_unavailable')
  }
  if (!response.ok) {
    throw new Error('error' in payload && typeof payload.error === 'object' ? payload.error.code : 'provider_unavailable')
  }
  return payload as FroamIntelligenceResponse | FroamIntelligenceNotConfiguredResponse
}

/** Compatibility name for the first mutation-only client. */
export const requestIntelligencePlan = requestFroamIntelligence
