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
  // Mounted in the local bridge, the bridge decides who may call it (it can
  // spend the developer's AI key); elsewhere this stays an open API.
  const bridgeOrigin = res.__froamCorsOrigin
  if (bridgeOrigin !== undefined) {
    if (bridgeOrigin) {
      res.setHeader('Access-Control-Allow-Origin', bridgeOrigin)
      res.setHeader('Vary', 'Origin')
    }
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*')
  }
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
  const candidates = [serialized]
  const fenced = serialized.trim().match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1]
  if (fenced) candidates.push(fenced)
  const start = serialized.indexOf('{')
  const end = serialized.lastIndexOf('}')
  if (start >= 0 && end > start) candidates.push(serialized.slice(start, end + 1))
  for (const candidate of candidates) {
    try { return { valid: true, value: JSON.parse(candidate) } }
    catch { /* try the next bounded representation */ }
  }
  return { valid: false, reason: 'invalid_json' }
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
For purpose "mutate", return {"purpose":"mutate","proposals":[FroamMutationProposal],"rationale":"...","confidence":0..1}. Allowed event types are node.upserted, relation.upserted, interaction.upserted, dna.captured, and responsive.upserted. Use only allowed domains and node ids supplied by the request. For safe executable edits, prefer dna.captured and copy the supplied selected-node DNA before changing only requested fields. Use dna.visual for color, backgroundColor, border, borderColor, borderRadius, boxShadow and opacity; dna.visual for typography fields such as fontSize, fontWeight, lineHeight, letterSpacing and textAlign; dna.layout for display, positioning, flex/grid alignment, spacing, overflow, width and height; dna.motion for transition, animation and transform; and dna.semantics.textContent for a requested plain-text copy replacement. Never add URLs, HTML, source code, scripts, unrelated nodes, or changes the user did not request.
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
      if (typeof content === 'string') return content
      if (content && typeof content === 'object' && !Array.isArray(content)) return content
      if (Array.isArray(content)) {
        const text = content.map((part) => typeof part === 'string' ? part : typeof part?.text === 'string' ? part.text : '').join('').trim()
        if (text) return text
      }
      throw new CompatibleProviderError('missing_content')
    },
  }
}


/* ── Claude, natively ─────────────────────────────────────────────────── */

/**
 * The shape Froam's plan comes back in. Claude is asked to answer by calling
 * this tool, so the plan arrives as structured data — not prose that happens
 * to contain JSON. The transport validator still checks every field.
 */
const FROAM_PLAN_TOOL = {
  name: 'froam_plan',
  description: "Return Froam's answer to the request: for purpose \"mutate\" the proposals, rationale and confidence; for the analysis purposes the findings, recommendations and limitations.",
  input_schema: {
    type: 'object',
    properties: {
      purpose: { type: 'string', enum: ['mutate', 'understand', 'reference', 'responsive', 'evaluate'] },
      proposals: { type: 'array', items: { type: 'object' } },
      rationale: { type: 'string' },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      findings: { type: 'array', items: { type: 'object' } },
      recommendations: { type: 'array', items: {} },
      limitations: { type: 'array', items: {} },
    },
    required: ['purpose'],
  },
}

/**
 * Anthropic's Messages API. The plan is forced through FROAM_PLAN_TOOL
 * (tool_choice), which is what makes Claude's answers dependable here.
 */
export function createAnthropicProvider({
  apiKey,
  model = 'claude-sonnet-5',
  baseUrl = 'https://api.anthropic.com',
  fetchImpl = globalThis.fetch,
  systemPrompt = DEFAULT_SYSTEM_PROMPT,
  timeout = 45_000,
  maxTokens = 4096,
}) {
  if (typeof apiKey !== 'string' || !apiKey) throw new TypeError('An Anthropic API key is required')
  if (typeof model !== 'string' || !model) throw new TypeError('A Claude model is required')
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required')
  const timeoutMs = Number.isFinite(timeout) ? Math.max(1, Math.min(120_000, timeout)) : 45_000

  return {
    id: 'froam-anthropic-v1',
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
        response = await fetchImpl(`${baseUrl.replace(/\/$/, '')}/v1/messages`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens,
            temperature: 0.2,
            system: systemPrompt,
            tools: [FROAM_PLAN_TOOL],
            tool_choice: { type: 'tool', name: FROAM_PLAN_TOOL.name },
            messages: [{ role: 'user', content: JSON.stringify(boundedRequest) }],
          }),
          signal: controller.signal,
        })
      } catch {
        throw new CompatibleProviderError(timedOut ? 'timeout' : signal?.aborted ? 'aborted' : 'network')
      } finally {
        clearTimeout(timer)
        signal?.removeEventListener('abort', abortFromCaller)
      }
      if (!response?.ok) throw new CompatibleProviderError(response?.status === 401 || response?.status === 403 ? 'auth' : 'http_status')
      let envelope
      try { envelope = JSON.parse(await response.text()) } catch { throw new CompatibleProviderError('invalid_envelope') }
      const blocks = Array.isArray(envelope?.content) ? envelope.content : []
      const call = blocks.find((block) => block?.type === 'tool_use' && block.name === FROAM_PLAN_TOOL.name)
      if (call?.input && typeof call.input === 'object') return call.input
      const text = blocks.map((block) => (block?.type === 'text' && typeof block.text === 'string' ? block.text : '')).join('').trim()
      if (text) return text
      throw new CompatibleProviderError('missing_content')
    },
  }
}

/**
 * The AI froam dev uses, from the environment — shared with `froam ai-check`
 * so what's checked is exactly what runs. ANTHROPIC_API_KEY alone means
 * Claude, natively; FROAM_AI_* (or OPENAI_*) means any OpenAI-compatible API;
 * FROAM_AI_PROVIDER=anthropic uses FROAM_AI_API_KEY with Claude.
 */
export function createProviderFromEnv(env = process.env) {
  const wantsAnthropic = env.FROAM_AI_PROVIDER === 'anthropic' || (!env.FROAM_AI_API_KEY && !env.OPENAI_API_KEY && Boolean(env.ANTHROPIC_API_KEY))
  if (wantsAnthropic) {
    const apiKey = env.FROAM_AI_PROVIDER === 'anthropic' ? env.FROAM_AI_API_KEY || env.ANTHROPIC_API_KEY : env.ANTHROPIC_API_KEY
    if (!apiKey) return null
    const model = env.FROAM_AI_MODEL || 'claude-sonnet-5'
    const baseUrl = env.FROAM_AI_BASE_URL || 'https://api.anthropic.com'
    return { provider: createAnthropicProvider({ apiKey, model, baseUrl }), model, host: new URL(baseUrl).host, kind: 'anthropic' }
  }
  const apiKey = env.FROAM_AI_API_KEY || env.OPENAI_API_KEY
  const model = env.FROAM_AI_MODEL || env.OPENAI_MODEL
  const baseUrl = env.FROAM_AI_BASE_URL || env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  if (!apiKey || !model) return null
  return { provider: createOpenAICompatibleProvider({ baseUrl, apiKey, model }), model, host: new URL(baseUrl).host, kind: 'openai-compatible' }
}

/**
 * One real request through a provider, checked the way froam dev checks it:
 * the plan must parse and pass validation. For `froam ai-check`.
 */
export async function checkIntelligenceProvider(provider, request) {
  const started = Date.now()
  const valid = validateIntelligenceRequest(request)
  if (!valid.valid) return { ok: false, code: 'invalid_request', ms: 0 }
  let output
  try { output = await provider.plan(valid.request) } catch (error) { return { ok: false, code: error?.code ?? 'provider_unavailable', ms: Date.now() - started } }
  const normalized = normalizeProviderOutput(output)
  if (!normalized.valid) return { ok: false, code: 'provider_invalid_response', detail: normalized.reason, ms: Date.now() - started }
  const checked = validateIntelligenceResponse(normalized.value, valid.request, String(provider.id ?? 'unknown'))
  if (!checked.valid) return { ok: false, code: checked.code, ms: Date.now() - started }
  return { ok: true, response: checked.response, ms: Date.now() - started }
}
