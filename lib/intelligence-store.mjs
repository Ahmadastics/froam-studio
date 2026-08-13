/**
 * Server-only provider adapter and HTTP handler for Froam intelligence.
 * Validation lives in the browser-safe transport module and is run again here
 * at both sides of the provider boundary.
 */
import {
  FROAM_INTELLIGENCE_MAX_REQUEST_BYTES,
  FROAM_INTELLIGENCE_MAX_RESPONSE_BYTES,
  REMOTE_INTELLIGENCE_PRIVACY,
  validateIntelligenceRequest,
  validateIntelligenceResponse,
} from '../dist/project/intelligence-transport.js'

const MAX_PROVIDER_ENVELOPE_BYTES = FROAM_INTELLIGENCE_MAX_RESPONSE_BYTES * 2

const ERROR_MESSAGES = {
  not_configured: 'Froam intelligence is not configured.',
  consent_required: 'Remote intelligence requires explicit consent.',
  invalid_request: 'The intelligence request is invalid.',
  provider_unavailable: 'The intelligence provider is unavailable.',
  provider_invalid_response: 'The intelligence provider returned an invalid response.',
  no_valid_proposals: 'The provider returned no safe mutation proposals.',
  unsupported_purpose: 'The requested intelligence purpose is not supported.',
}

function byteLength(value) {
  return Buffer.byteLength(value, 'utf8')
}

function sendJson(res, status, payload) {
  res.statusCode = status
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(payload))
}

function sendError(res, status, code, extra = {}) {
  sendJson(res, status, {
    success: false,
    error: { code, message: ERROR_MESSAGES[code] },
    ...extra,
  })
}

class RequestBodyError extends Error {
  constructor(code) { super(code); this.code = code }
}

async function readJsonBody(req) {
  if (req.body !== undefined) {
    let serialized
    try { serialized = JSON.stringify(req.body) } catch { throw new RequestBodyError('invalid_json') }
    if (byteLength(serialized) > FROAM_INTELLIGENCE_MAX_REQUEST_BYTES) throw new RequestBodyError('too_large')
    try { return JSON.parse(serialized) } catch { throw new RequestBodyError('invalid_json') }
  }
  return new Promise((resolve, reject) => {
    const chunks = []
    let bytes = 0
    let rejected = false
    req.on('data', (chunk) => {
      if (rejected) return
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      bytes += buffer.byteLength
      if (bytes > FROAM_INTELLIGENCE_MAX_REQUEST_BYTES) {
        rejected = true
        reject(new RequestBodyError('too_large'))
        return
      }
      chunks.push(buffer)
    })
    req.on('end', () => {
      if (rejected) return
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) }
      catch { reject(new RequestBodyError('invalid_json')) }
    })
    req.on('error', () => { if (!rejected) reject(new RequestBodyError('read_failed')) })
  })
}

function normalizeProviderOutput(value) {
  let serialized
  try { serialized = typeof value === 'string' ? value : JSON.stringify(value) }
  catch { return { valid: false, reason: 'unserializable' } }
  if (typeof serialized !== 'string' || byteLength(serialized) > FROAM_INTELLIGENCE_MAX_RESPONSE_BYTES) {
    return { valid: false, reason: 'too_large' }
  }
  try { return { valid: true, value: JSON.parse(serialized) } }
  catch { return { valid: false, reason: 'invalid_json' } }
}

function acceptsJson(req) {
  const value = req.headers?.['content-type']
  return typeof value === 'string' && /^application\/(?:json|[\w.+-]+\+json)(?:\s*;|$)/i.test(value)
}

/**
 * Create the reusable POST /plan endpoint. A null provider is a supported,
 * non-failing configuration and returns the structured not-configured result.
 */
export function createFroamIntelligenceApi({ provider = null, authorize = null, log = () => {} } = {}) {
  return async function handleIntelligenceRequest(req, res) {
    const url = new URL(req.url ?? '/', 'http://froam.local')
    if (!url.pathname.endsWith('/plan')) return false
    if (req.method !== 'POST') {
      sendError(res, 405, 'invalid_request')
      return true
    }
    if (req.body === undefined && !acceptsJson(req)) {
      sendError(res, 415, 'invalid_request')
      return true
    }
    if (authorize) {
      let authorized = false
      try { authorized = await authorize(req) } catch { authorized = false }
      if (!authorized) {
        sendError(res, 403, 'invalid_request')
        return true
      }
    }

    let body
    try { body = await readJsonBody(req) }
    catch {
      sendError(res, 400, 'invalid_request')
      return true
    }

    const requestValidation = validateIntelligenceRequest(body)
    if (!requestValidation.valid) {
      const code = requestValidation.code === 'unsupported_purpose' ? 'unsupported_purpose' : 'invalid_request'
      log(`intelligence request rejected: ${code}`)
      sendError(res, 400, code)
      return true
    }
    const request = requestValidation.request

    if (!provider) {
      sendError(res, 200, 'not_configured', { configured: false, reason: ERROR_MESSAGES.not_configured })
      return true
    }
    if (provider.privacy?.requiresConsent === true && request.consent !== true) {
      sendError(res, 403, 'consent_required')
      return true
    }

    const controller = new AbortController()
    const abort = () => controller.abort()
    const close = () => { if (!res.writableEnded) controller.abort() }
    req.once?.('aborted', abort)
    res.once?.('close', close)
    let providerOutput
    try { providerOutput = await provider.plan(request, { signal: controller.signal }) }
    catch {
      if (controller.signal.aborted && (req.aborted || res.destroyed)) return true
      // Deliberately do not log provider exception messages; upstream bodies,
      // filesystem paths, and accidental secrets must not cross this boundary.
      log(`intelligence provider unavailable: ${String(provider.id ?? 'unknown').slice(0, 100)}`)
      sendError(res, 502, 'provider_unavailable')
      return true
    } finally {
      req.removeListener?.('aborted', abort)
      res.removeListener?.('close', close)
    }

    // Mandatory serialization boundary for both string and object providers.
    const normalized = normalizeProviderOutput(providerOutput)
    if (!normalized.valid) {
      log(`intelligence provider response rejected: ${normalized.reason}`)
      sendError(res, 502, 'provider_invalid_response')
      return true
    }
    const responseValidation = validateIntelligenceResponse(normalized.value, request, String(provider.id ?? 'unknown').slice(0, 200))
    if (!responseValidation.valid) {
      const status = responseValidation.code === 'no_valid_proposals' ? 422 : 502
      log(`intelligence provider response rejected: ${responseValidation.code}`)
      sendError(res, status, responseValidation.code)
      return true
    }

    log(`intelligence ${request.purpose}: ${request.context.projectId}`)
    sendJson(res, 200, responseValidation.response)
    return true
  }
}

class CompatibleProviderError extends Error {
  constructor(code) { super(code); this.name = 'CompatibleProviderError'; this.code = code }
}

const DEFAULT_SYSTEM_PROMPT = `You are Froam's native interface intelligence provider.
Return one strict JSON object and no markdown. Speak only in Froam-native interface knowledge.
Never return JavaScript, JSX, TSX, shell commands, git commands, filesystem writes, source code, or credentials.
For purpose "mutate", return {"purpose":"mutate","proposals":[FroamMutationProposal],"rationale":"...","confidence":0..1}. Allowed event types are node.upserted, relation.upserted, interaction.upserted, dna.captured, and responsive.upserted. Use only allowed domains and node ids supplied by the request. For safe visual edits, prefer dna.captured: copy the supplied selected-node DNA and change only relevant observable CSS-shaped fields under dna.visual (color, backgroundColor, border, borderColor, borderRadius, boxShadow, opacity), dna.layout for spacing, or dna.motion for motion. Never add URLs, source code, width, height, min/max dimensions, or unrelated nodes.
For purposes "understand", "reference", "responsive", or "evaluate", return {"purpose":"<same purpose>","findings":[{"summary":"...","origin":"observed|inferred|generated","confidence":0..1,"evidence":[]}],"recommendations":[],"limitations":[]} and never return proposals.
Keep observed facts distinct from inference. Responsive breakpoint hypotheses must use origin "inferred" unless directly measured.`

/**
 * Native-fetch adapter for APIs implementing the OpenAI chat-completions wire
 * format. Base URL and model are explicit so no vendor is mandatory.
 */
export function createOpenAICompatibleProvider({
  baseUrl,
  apiKey,
  model,
  fetchImpl = globalThis.fetch,
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  timeout = 30_000,
}) {
  if (typeof baseUrl !== 'string' || !/^https?:\/\//i.test(baseUrl)) throw new TypeError('A valid compatible-provider baseUrl is required')
  if (typeof apiKey !== 'string' || !apiKey) throw new TypeError('A compatible-provider apiKey is required')
  if (typeof model !== 'string' || !model) throw new TypeError('A compatible-provider model is required')
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required')
  const timeoutMs = Number.isFinite(timeout) ? Math.max(1, Math.min(120_000, timeout)) : 30_000

  return {
    id: 'froam-openai-compatible-v1',
    privacy: REMOTE_INTELLIGENCE_PRIVACY,
    async plan(request, { signal } = {}) {
      const { consent: _consent, ...boundedRequest } = request
      const controller = new AbortController()
      let timedOut = false
      const abortFromCaller = () => controller.abort()
      if (signal?.aborted) abortFromCaller()
      else signal?.addEventListener('abort', abortFromCaller, { once: true })
      const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
      let response
      try {
        response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: JSON.stringify(boundedRequest) },
            ],
            temperature: 0.2,
          }),
          signal: controller.signal,
        })
      } catch {
        throw new CompatibleProviderError(timedOut ? 'timeout' : signal?.aborted ? 'aborted' : 'network')
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', abortFromCaller)
      }
      if (!response?.ok) throw new CompatibleProviderError('http_status')

      let envelopeText
      try { envelopeText = await response.text() } catch { throw new CompatibleProviderError('invalid_envelope') }
      if (byteLength(envelopeText) > MAX_PROVIDER_ENVELOPE_BYTES) throw new CompatibleProviderError('oversized_envelope')
      let envelope
      try { envelope = JSON.parse(envelopeText) } catch { throw new CompatibleProviderError('invalid_envelope') }
      if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) throw new CompatibleProviderError('invalid_envelope')
      const content = envelope?.choices?.[0]?.message?.content
      if (typeof content !== 'string' && (!content || typeof content !== 'object' || Array.isArray(content))) throw new CompatibleProviderError('missing_content')
      return content
    },
  }
}
