/**
 * Browser-safe, provider-neutral transport for Froam-native intelligence.
 *
 * The transport carries bounded interface knowledge, never provider secrets,
 * source files, browser memory, or decoded screenshot pixel buffers. Only a
 * `mutate` response can contain executable Froam mutation proposals; every
 * other purpose is analysis-only.
 */
import type { FroamViewport } from '../collab/types'
import type { FroamIntelligenceMemory } from './intelligence-memory'
import type { FroamProviderPrivacy } from './intelligence-provider'
import type { FroamMutationConstraints, FroamMutationDomain, FroamMutationProposal } from './mutation'
import type { FroamDNA, FroamRelation, FroamResponsivePolicy, FroamScanRecord } from './types'

export const FROAM_INTELLIGENCE_SCHEMA_VERSION = 1 as const
export const FROAM_INTELLIGENCE_MAX_REQUEST_BYTES = 512_000
export const FROAM_INTELLIGENCE_MAX_RESPONSE_BYTES = 256_000
export const FROAM_INTELLIGENCE_MAX_PROPOSALS = 20

export type FroamIntelligencePurpose = 'mutate' | 'understand' | 'reference' | 'responsive' | 'evaluate'
export type FroamEvidenceOrigin = 'observed' | 'inferred' | 'generated'

export type FroamIntelligenceEvidence = {
  origin: FroamEvidenceOrigin
  summary: string
  source?: string
  confidence?: number
}

/** Structured reference knowledge only. Actual image bytes use a future, opaque media channel. */
export type FroamIntelligenceReferenceSummary = {
  id: string
  /** Opaque handle for a future multimodal transport; never base64 image data. */
  mediaReferenceId?: string
  viewportWidth?: number
  viewportHeight?: number
  route?: string
  state?: string
  label?: string
  reconstructedRegions?: Array<{
    id: string
    nodeId?: string
    kind: 'text' | 'image' | 'container' | 'unknown'
    x: number
    y: number
    width: number
    height: number
    text?: string
    semanticRole?: string
    confidence?: number
    origin: FroamEvidenceOrigin
  }>
  ocrText?: Array<{ text: string; confidence?: number; origin: 'observed' | 'inferred' }>
  observedHierarchy?: Array<{ parentId: string; childId: string; origin: FroamEvidenceOrigin; confidence?: number }>
  dna?: Record<string, FroamDNA>
  knownLimitations?: string[]
}

export type FroamIntelligenceResponsiveObservation = {
  width: number
  nodeId?: string
  summary: string
  origin: 'observed' | 'inferred'
  confidence?: number
  markers?: string[]
}

/** Compact derived evidence for reference/responsive analysis. Never contains pixel buffers. */
export type FroamIntelligenceReferenceEvidence = {
  matches: Array<{ fromReferenceId: string; toReferenceId: string; fromRegionId: string; toRegionId: string; confidence: number; evidence: string[] }>
  differences: Array<{ fromReferenceId: string; toReferenceId: string; appeared: number; disappeared: number; moved: number; ambiguous: number }>
  responsiveSignature: { observedWidths: number[]; observations: Array<{ kind: string; width: number; summary: string; origin: 'observed'; confidence: number }>; hypotheses: Array<{ kind: string; summary: string; origin: 'inferred'; confidence: number; betweenWidths?: [number, number] }> }
  quality: { structure?: number; geometry?: number; text?: number; visual?: number; responsiveEvidence?: number }
  limitations: string[]
}

export type FroamIntelligenceContext = {
  /** Stable identifiers only; these are not local filesystem paths. */
  projectId: string
  activeBranchId: string
  routeKey: string
  viewport: FroamViewport
  selectedNodeId?: string | null
  /** Supporting locator only; stable node identity remains authoritative. */
  selectedPath?: string | null
  /** Compatibility spelling used by the first browser assembler. */
  selectedDomPath?: string | null
  scanRecords?: FroamScanRecord[]
  dna?: Record<string, FroamDNA>
  relationships?: FroamRelation[]
  responsivePolicies?: FroamResponsivePolicy[]
  responsiveObservations?: FroamIntelligenceResponsiveObservation[]
  references?: FroamIntelligenceReferenceSummary[]
  referenceEvidence?: FroamIntelligenceReferenceEvidence
  memory?: FroamIntelligenceMemory
}

type FroamIntelligenceRequestBase<P extends FroamIntelligencePurpose> = {
  schemaVersion: typeof FROAM_INTELLIGENCE_SCHEMA_VERSION
  purpose: P
  intent: string
  context: FroamIntelligenceContext
  /** Optional scope for analysis, mandatory and non-empty for mutation. */
  scopeNodeIds?: string[]
  previousAttemptFeedback?: string | null
  /** Compatibility spelling retained for existing callers. */
  priorAttemptFeedback?: string | null
  requestId?: string
  /** Enforced by the server only when the selected provider is remote. */
  consent?: boolean
}

export type FroamMutationIntelligenceRequest = FroamIntelligenceRequestBase<'mutate'> & {
  scopeNodeIds: string[]
  constraints: FroamMutationConstraints
  protectedNodeIds?: string[]
}

export type FroamAnalysisIntelligenceRequest = FroamIntelligenceRequestBase<
  'understand' | 'reference' | 'responsive' | 'evaluate'
> & {
  constraints?: never
  protectedNodeIds?: never
}

export type FroamIntelligenceRequest = FroamMutationIntelligenceRequest | FroamAnalysisIntelligenceRequest
/** Compatibility alias. The endpoint remains `/plan`, but the envelope is purpose-neutral. */
export type FroamIntelligencePlanRequest = FroamIntelligenceRequest

export type FroamMutationPlanResponse = {
  schemaVersion: typeof FROAM_INTELLIGENCE_SCHEMA_VERSION
  purpose: 'mutate'
  requestId?: string
  provider: string
  proposals: FroamMutationProposal[]
  rationale: string
  confidence: number
  warnings?: string[]
}

export type FroamAnalysisFinding = {
  id?: string
  summary: string
  detail?: string
  origin: FroamEvidenceOrigin
  confidence?: number
  evidence?: FroamIntelligenceEvidence[]
  nodeIds?: string[]
}

type FroamAnalysisResponseBase<P extends Exclude<FroamIntelligencePurpose, 'mutate'>> = {
  schemaVersion: typeof FROAM_INTELLIGENCE_SCHEMA_VERSION
  purpose: P
  requestId?: string
  provider: string
  findings: FroamAnalysisFinding[]
  recommendations?: string[]
  limitations?: string[]
}

export type FroamUnderstandingResponse = FroamAnalysisResponseBase<'understand'>
export type FroamReferenceAnalysisResponse = FroamAnalysisResponseBase<'reference'> & { referenceIds?: string[] }
export type FroamResponsiveAnalysisResponse = FroamAnalysisResponseBase<'responsive'> & {
  breakpointHypotheses?: Array<{ summary: string; origin: 'inferred'; confidence?: number }>
}
export type FroamVisualEvaluationResponse = FroamAnalysisResponseBase<'evaluate'> & { score?: number }

export type FroamIntelligenceResponse =
  | FroamMutationPlanResponse
  | FroamUnderstandingResponse
  | FroamReferenceAnalysisResponse
  | FroamResponsiveAnalysisResponse
  | FroamVisualEvaluationResponse
/** Compatibility alias for mutation-only consumers. */
export type FroamIntelligencePlanResponse = FroamMutationPlanResponse

export type FroamIntelligenceErrorCode =
  | 'not_configured'
  | 'consent_required'
  | 'invalid_request'
  | 'provider_unavailable'
  | 'provider_invalid_response'
  | 'no_valid_proposals'
  | 'unsupported_purpose'

export type FroamIntelligenceErrorResponse = {
  success: false
  configured?: false
  error: { code: FroamIntelligenceErrorCode; message: string }
}

export type FroamIntelligenceNotConfiguredResponse = FroamIntelligenceErrorResponse & {
  configured: false
  reason: string
}

const PURPOSES = new Set<FroamIntelligencePurpose>(['mutate', 'understand', 'reference', 'responsive', 'evaluate'])
const MAX_DEPTH = 12
const MAX_ITEMS = 2_000
const MAX_INTENT_CHARS = 4_000
const MAX_RATIONALE_CHARS = 1_000
const MAX_FINDINGS = 50
const MAX_SCOPE_NODES = 100
const MAX_STRING_CHARS = 20_000
const PROTO_POISON = new Set(['__proto__', 'constructor', 'prototype'])
const CREDENTIAL_KEYS = new Set(['apikey', 'api_key', 'authorization', 'password', 'secret', 'token'])
const ALLOWED_DOMAINS = new Set<FroamMutationDomain>([
  'visual', 'typography', 'spacing', 'layout', 'navigation', 'interactions', 'motion', 'responsive', 'composition',
])
const ALLOWED_EVENT_TYPES = new Set([
  'node.upserted', 'relation.upserted', 'interaction.upserted', 'dna.captured', 'responsive.upserted',
])
const NODE_KINDS = new Set(['project', 'page', 'screen', 'frame', 'element', 'component-definition', 'component-instance', 'asset', 'state'])
const NODE_SOURCES = new Set(['host-dom', 'froam', 'imported'])
const RELATION_KINDS = new Set(['contains', 'instance-of', 'navigates-to', 'transitions-to', 'uses-asset', 'derived-from', 'variant-of', 'belongs-to', 'connected-to', 'mutated-from', 'uses-interaction', 'sampled-from', 'governed-by', 'tested-by', 'performed-by', 'uses-sound', 'custom'])
const INTERACTION_TRIGGERS = new Set(['load', 'hover', 'press', 'click', 'focus', 'scroll', 'drag', 'custom'])
const REQUEST_KEYS = new Set(['schemaVersion', 'purpose', 'intent', 'context', 'scopeNodeIds', 'constraints', 'protectedNodeIds', 'previousAttemptFeedback', 'priorAttemptFeedback', 'requestId', 'consent'])
const CONTEXT_KEYS = new Set(['projectId', 'activeBranchId', 'routeKey', 'viewport', 'selectedNodeId', 'selectedPath', 'selectedDomPath', 'scanRecords', 'dna', 'relationships', 'responsivePolicies', 'responsiveObservations', 'references', 'referenceEvidence', 'memory'])
const REFERENCE_KEYS = new Set(['id', 'mediaReferenceId', 'viewportWidth', 'viewportHeight', 'route', 'state', 'label', 'reconstructedRegions', 'ocrText', 'observedHierarchy', 'dna', 'knownLimitations'])

function utf8Bytes(value: string) {
  return typeof TextEncoder === 'function' ? new TextEncoder().encode(value).byteLength : value.length
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function boundedString(value: unknown, max = 256): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max
}

function boundedJson(value: unknown, options: { rejectCredentials?: boolean } = {}) {
  let items = 0
  const visit = (current: unknown, depth: number): boolean => {
    if (depth > MAX_DEPTH || ++items > MAX_ITEMS) return false
    if (current === null || typeof current === 'boolean') return true
    if (typeof current === 'string') return current.length <= MAX_STRING_CHARS
    if (typeof current === 'number') return Number.isFinite(current)
    if (typeof current !== 'object') return false
    if (ArrayBuffer.isView(current) || current instanceof ArrayBuffer) return false
    if (Array.isArray(current)) return current.length <= MAX_ITEMS && current.every((item) => visit(item, depth + 1))
    for (const [key, child] of Object.entries(current as Record<string, unknown>)) {
      const normalizedKey = key.toLowerCase().replace(/[-\s]/g, '')
      if (PROTO_POISON.has(key)) return false
      if (options.rejectCredentials && CREDENTIAL_KEYS.has(normalizedKey)) return false
      if (!visit(child, depth + 1)) return false
    }
    return true
  }
  return visit(value, 0)
}

function validIds(value: unknown, maximum = MAX_SCOPE_NODES): value is string[] {
  return Array.isArray(value) && value.length <= maximum && value.every((id) => boundedString(id)) && new Set(value).size === value.length
}

function validContext(value: unknown) {
  if (!isRecord(value) || !boundedJson(value, { rejectCredentials: true })) return false
  if (Object.keys(value).some((key) => !CONTEXT_KEYS.has(key))) return false
  if (!boundedString(value.projectId) || !boundedString(value.activeBranchId)) return false
  if (typeof value.routeKey !== 'string' || value.routeKey.length > 2_000) return false
  if (!['desktop', 'tablet', 'mobile'].includes(String(value.viewport))) return false
  if (value.selectedNodeId != null && !boundedString(value.selectedNodeId)) return false
  if (value.selectedPath != null && (typeof value.selectedPath !== 'string' || value.selectedPath.length > 4_000)) return false
  if (value.selectedDomPath != null && (typeof value.selectedDomPath !== 'string' || value.selectedDomPath.length > 4_000)) return false
  if (value.scanRecords != null && (!Array.isArray(value.scanRecords) || value.scanRecords.length > 100)) return false
  if (value.relationships != null && (!Array.isArray(value.relationships) || value.relationships.length > 200)) return false
  if (value.responsivePolicies != null && (!Array.isArray(value.responsivePolicies) || value.responsivePolicies.length > 100)) return false
  if (value.responsiveObservations != null && (!Array.isArray(value.responsiveObservations) || value.responsiveObservations.length > 200)) return false
  if (value.references != null) {
    if (!Array.isArray(value.references) || value.references.length > 20) return false
    for (const reference of value.references) {
      if (!isRecord(reference) || Object.keys(reference).some((key) => !REFERENCE_KEYS.has(key)) || !boundedString(reference.id)) return false
      if (reference.mediaReferenceId != null && !boundedString(reference.mediaReferenceId, 1_000)) return false
      for (const dimension of ['viewportWidth', 'viewportHeight']) if (reference[dimension] != null && (typeof reference[dimension] !== 'number' || !Number.isFinite(reference[dimension]) || reference[dimension] <= 0 || reference[dimension] > 100_000)) return false
      if (reference.reconstructedRegions != null && (!Array.isArray(reference.reconstructedRegions) || reference.reconstructedRegions.length > 500)) return false
      if (reference.ocrText != null && (!Array.isArray(reference.ocrText) || reference.ocrText.length > 500)) return false
      if (reference.observedHierarchy != null && (!Array.isArray(reference.observedHierarchy) || reference.observedHierarchy.length > 500)) return false
    }
  }
  return true
}

export type FroamRequestValidationResult =
  | { valid: true; request: FroamIntelligenceRequest }
  | { valid: false; code: 'invalid_request' | 'unsupported_purpose'; reason: string }

export function validateIntelligenceRequest(value: unknown): FroamRequestValidationResult {
  if (!isRecord(value) || !boundedJson(value, { rejectCredentials: true })) {
    return { valid: false, code: 'invalid_request', reason: 'Request must be bounded credential-free JSON' }
  }
  if (Object.keys(value).some((key) => !REQUEST_KEYS.has(key))) return { valid: false, code: 'invalid_request', reason: 'Request contains unsupported fields' }
  let serialized: string
  try { serialized = JSON.stringify(value) } catch { return { valid: false, code: 'invalid_request', reason: 'Request must be serializable JSON' } }
  if (utf8Bytes(serialized) > FROAM_INTELLIGENCE_MAX_REQUEST_BYTES) {
    return { valid: false, code: 'invalid_request', reason: 'Request exceeds the size limit' }
  }
  if (value.schemaVersion !== FROAM_INTELLIGENCE_SCHEMA_VERSION) return { valid: false, code: 'invalid_request', reason: 'Unsupported schema version' }
  if (typeof value.purpose !== 'string' || !PURPOSES.has(value.purpose as FroamIntelligencePurpose)) return { valid: false, code: 'unsupported_purpose', reason: 'Unsupported intelligence purpose' }
  if (typeof value.intent !== 'string' || !value.intent.trim() || value.intent.length > MAX_INTENT_CHARS) return { valid: false, code: 'invalid_request', reason: 'Intent is required and must be bounded' }
  if (!validContext(value.context)) return { valid: false, code: 'invalid_request', reason: 'Invalid intelligence context' }
  if (value.requestId != null && !boundedString(value.requestId)) return { valid: false, code: 'invalid_request', reason: 'Invalid request id' }
  if (value.scopeNodeIds != null && !validIds(value.scopeNodeIds)) return { valid: false, code: 'invalid_request', reason: 'Invalid node scope' }

  if (value.purpose === 'mutate') {
    if (!validIds(value.scopeNodeIds) || value.scopeNodeIds.length === 0) return { valid: false, code: 'invalid_request', reason: 'Mutation requires a non-empty node scope' }
    if (!isRecord(value.constraints)) return { valid: false, code: 'invalid_request', reason: 'Mutation constraints are required' }
    if (!Array.isArray(value.constraints.allow) || value.constraints.allow.some((domain) => typeof domain !== 'string' || !ALLOWED_DOMAINS.has(domain as FroamMutationDomain))) return { valid: false, code: 'invalid_request', reason: 'Invalid allowed mutation domains' }
    if (!Array.isArray(value.constraints.protect) || value.constraints.protect.some((item) => typeof item !== 'string' || item.length > 100)) return { valid: false, code: 'invalid_request', reason: 'Invalid mutation protections' }
    if (value.protectedNodeIds != null && !validIds(value.protectedNodeIds)) return { valid: false, code: 'invalid_request', reason: 'Invalid protected node ids' }
    if (value.constraints.protectedNodeIds != null && !validIds(value.constraints.protectedNodeIds)) return { valid: false, code: 'invalid_request', reason: 'Invalid constrained node ids' }
  } else if ('constraints' in value || 'protectedNodeIds' in value) {
    return { valid: false, code: 'invalid_request', reason: 'Analysis requests cannot carry mutation constraints' }
  }
  return { valid: true, request: value as FroamIntelligenceRequest }
}

/** Compatibility boolean predicate. */
export function validatePlanRequest(value: unknown): value is FroamIntelligencePlanRequest {
  return validateIntelligenceRequest(value).valid
}

function payloadReferences(type: string, payload: Record<string, unknown>) {
  if (type === 'node.upserted') return isRecord(payload.node) && boundedString(payload.node.id) ? [payload.node.id] : null
  if (type === 'relation.upserted') {
    if (!isRecord(payload.relation) || !boundedString(payload.relation.id) || !boundedString(payload.relation.from) || !boundedString(payload.relation.to) || typeof payload.relation.kind !== 'string' || !RELATION_KINDS.has(payload.relation.kind)) return null
    return [payload.relation.from, payload.relation.to]
  }
  if (type === 'interaction.upserted') {
    const interaction = payload.interaction
    if (!isRecord(interaction) || !boundedString(interaction.id) || !boundedString(interaction.name, 500) || !boundedString(interaction.sourceId) || !validIds(interaction.targetIds, 100) || typeof interaction.trigger !== 'string' || !INTERACTION_TRIGGERS.has(interaction.trigger) || !Array.isArray(interaction.timeline) || interaction.timeline.length > 100) return null
    if (!interaction.timeline.every((frame) => isRecord(frame) && typeof frame.at === 'number' && Number.isFinite(frame.at) && isRecord(frame.values))) return null
    return [interaction.sourceId, ...interaction.targetIds]
  }
  if (type === 'dna.captured') {
    const dna = payload.dna
    if (!isRecord(dna) || dna.schemaVersion !== 1 || !boundedString(dna.nodeId) || typeof dna.capturedAt !== 'number' || !Number.isFinite(dna.capturedAt)) return null
    return [dna.nodeId]
  }
  if (type === 'responsive.upserted') {
    const responsive = payload.responsive
    if (!isRecord(responsive) || responsive.schemaVersion !== 1 || !boundedString(responsive.nodeId) || !['critical', 'high', 'medium', 'low', 'decorative'].includes(String(responsive.priority))) return null
    for (const key of ['canHide', 'canCollapse', 'canWrap', 'canTruncate', 'canCrop', 'canReposition']) if (typeof responsive[key] !== 'boolean') return null
    if (typeof responsive.updatedAt !== 'number' || !Number.isFinite(responsive.updatedAt) || !boundedString(responsive.updatedBy)) return null
    return [responsive.nodeId]
  }
  return null
}

function validPayload(type: string, payload: unknown, scope: Set<string>, protectedIds: Set<string>, targets: string[]) {
  if (!isRecord(payload) || !boundedJson(payload)) return false
  const expectedKey: Record<string, string> = { 'node.upserted': 'node', 'relation.upserted': 'relation', 'interaction.upserted': 'interaction', 'dna.captured': 'dna', 'responsive.upserted': 'responsive' }
  if (Object.keys(payload).length !== 1 || !(expectedKey[type] in payload)) return false
  const references = payloadReferences(type, payload)
  if (!references || references.some((id) => !scope.has(id) || protectedIds.has(id))) return false
  if (type === 'node.upserted') {
    const node = payload.node as Record<string, unknown>
    if (typeof node.kind !== 'string' || !NODE_KINDS.has(node.kind) || typeof node.source !== 'string' || !NODE_SOURCES.has(node.source)) return false
  }
  return references.some((id) => targets.includes(id))
}

export type FroamIntelligenceValidationResult =
  | { valid: true; proposals: FroamMutationProposal[] }
  | { valid: false; reason: string }

/** Deterministically validate executable model output as native Froam operations. */
export function validateIntelligencePlan(raw: unknown, request: FroamIntelligencePlanRequest): FroamIntelligenceValidationResult {
  if (request.purpose !== 'mutate') return { valid: false, reason: 'Only mutate requests can contain proposals' }
  if (!isRecord(raw) || !boundedJson(raw)) return { valid: false, reason: 'Plan must be bounded JSON' }
  if (raw.purpose != null && raw.purpose !== 'mutate') return { valid: false, reason: 'Response purpose does not match request' }
  if (!Array.isArray(raw.proposals)) return { valid: false, reason: 'proposals must be an array' }
  if (raw.proposals.length > FROAM_INTELLIGENCE_MAX_PROPOSALS) return { valid: false, reason: `Too many proposals (max ${FROAM_INTELLIGENCE_MAX_PROPOSALS})` }

  const scope = new Set(request.scopeNodeIds)
  const protectedIds = new Set([...(request.protectedNodeIds ?? []), ...(request.constraints.protectedNodeIds ?? [])])
  const accepted: FroamMutationProposal[] = []
  for (const candidate of raw.proposals) {
    if (!isRecord(candidate) || !boundedJson(candidate)) continue
    if (typeof candidate.type !== 'string' || !ALLOWED_EVENT_TYPES.has(candidate.type)) continue
    if (typeof candidate.domain !== 'string' || !ALLOWED_DOMAINS.has(candidate.domain as FroamMutationDomain) || !request.constraints.allow.includes(candidate.domain as FroamMutationDomain)) continue
    if (!validIds(candidate.targetIds, 100) || candidate.targetIds.length === 0 || candidate.targetIds.some((id) => !scope.has(id) || protectedIds.has(id))) continue
    if (typeof candidate.confidence !== 'number' || !Number.isFinite(candidate.confidence)) continue
    if (typeof candidate.rationale !== 'string' || !candidate.rationale.trim()) continue
    if (!validPayload(candidate.type, candidate.payload, scope, protectedIds, candidate.targetIds)) continue
    accepted.push({
      type: candidate.type as FroamMutationProposal['type'],
      domain: candidate.domain as FroamMutationDomain,
      targetIds: [...candidate.targetIds],
      confidence: Math.max(0, Math.min(1, candidate.confidence)),
      rationale: candidate.rationale.trim().slice(0, MAX_RATIONALE_CHARS),
      payload: structuredClone(candidate.payload) as FroamMutationProposal['payload'],
      dependencies: validIds(candidate.dependencies, 50) ? [...candidate.dependencies] : undefined,
    })
  }
  return accepted.length ? { valid: true, proposals: accepted } : { valid: false, reason: 'No valid proposals survived validation' }
}

function sanitizeStrings(value: unknown, maxItems = 20) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).slice(0, maxItems).map((item) => item.trim().slice(0, MAX_RATIONALE_CHARS)) : undefined
}

function sanitizeFinding(value: unknown, scope: Set<string>): FroamAnalysisFinding | null {
  if (!isRecord(value) || !boundedJson(value) || typeof value.summary !== 'string' || !value.summary.trim() || !['observed', 'inferred', 'generated'].includes(String(value.origin))) return null
  if (value.confidence != null && (typeof value.confidence !== 'number' || !Number.isFinite(value.confidence))) return null
  const nodeIds = validIds(value.nodeIds, 100) ? value.nodeIds.filter((id) => scope.has(id)) : undefined
  const evidence = Array.isArray(value.evidence) ? value.evidence.slice(0, 20).flatMap((item): FroamIntelligenceEvidence[] => {
    if (!isRecord(item) || typeof item.summary !== 'string' || !item.summary.trim() || !['observed', 'inferred', 'generated'].includes(String(item.origin))) return []
    if (item.confidence != null && (typeof item.confidence !== 'number' || !Number.isFinite(item.confidence))) return []
    return [{ origin: item.origin as FroamEvidenceOrigin, summary: item.summary.trim().slice(0, MAX_RATIONALE_CHARS), source: typeof item.source === 'string' ? item.source.slice(0, 500) : undefined, confidence: typeof item.confidence === 'number' ? Math.max(0, Math.min(1, item.confidence)) : undefined }]
  }) : undefined
  return {
    id: typeof value.id === 'string' ? value.id.slice(0, 256) : undefined,
    summary: value.summary.trim().slice(0, MAX_RATIONALE_CHARS),
    detail: typeof value.detail === 'string' ? value.detail.slice(0, 4_000) : undefined,
    origin: value.origin as FroamEvidenceOrigin,
    confidence: typeof value.confidence === 'number' ? Math.max(0, Math.min(1, value.confidence)) : undefined,
    evidence,
    nodeIds,
  }
}

export type FroamResponseValidationResult =
  | { valid: true; response: FroamIntelligenceResponse }
  | { valid: false; code: 'provider_invalid_response' | 'no_valid_proposals'; reason: string }

export function validateIntelligenceResponse(raw: unknown, request: FroamIntelligenceRequest, provider = 'unknown'): FroamResponseValidationResult {
  if (!isRecord(raw) || !boundedJson(raw)) return { valid: false, code: 'provider_invalid_response', reason: 'Response must be bounded JSON' }
  if (raw.purpose != null && raw.purpose !== request.purpose) return { valid: false, code: 'provider_invalid_response', reason: 'Response purpose does not match request' }
  if (request.purpose === 'mutate') {
    const plan = validateIntelligencePlan(raw, request)
    if (!plan.valid) return { valid: false, code: plan.reason.startsWith('No valid') ? 'no_valid_proposals' : 'provider_invalid_response', reason: plan.reason }
    return { valid: true, response: { schemaVersion: 1, purpose: 'mutate', requestId: request.requestId, provider, proposals: plan.proposals, rationale: typeof raw.rationale === 'string' ? raw.rationale.slice(0, MAX_RATIONALE_CHARS) : '', confidence: typeof raw.confidence === 'number' && Number.isFinite(raw.confidence) ? Math.max(0, Math.min(1, raw.confidence)) : 0, warnings: sanitizeStrings(raw.warnings, 10) } }
  }

  if ('proposals' in raw) return { valid: false, code: 'provider_invalid_response', reason: 'Analysis responses cannot contain mutation proposals' }

  if (!Array.isArray(raw.findings) || raw.findings.length > MAX_FINDINGS) return { valid: false, code: 'provider_invalid_response', reason: 'findings must be a bounded array' }
  const scope = new Set(request.scopeNodeIds ?? [])
  const findings = raw.findings.map((item) => sanitizeFinding(item, scope)).filter((item): item is FroamAnalysisFinding => item !== null)
  if (raw.findings.length > 0 && findings.length === 0) return { valid: false, code: 'provider_invalid_response', reason: 'No valid findings survived validation' }
  const common = { schemaVersion: 1 as const, requestId: request.requestId, provider, findings, recommendations: sanitizeStrings(raw.recommendations), limitations: sanitizeStrings(raw.limitations) }
  if (request.purpose === 'reference') return { valid: true, response: { ...common, purpose: 'reference', referenceIds: validIds(raw.referenceIds, 20) ? raw.referenceIds : undefined } }
  if (request.purpose === 'responsive') {
    const breakpointHypotheses = Array.isArray(raw.breakpointHypotheses) ? raw.breakpointHypotheses.slice(0, 20).flatMap((item): Array<{ summary: string; origin: 'inferred'; confidence?: number }> => isRecord(item) && typeof item.summary === 'string' && item.summary.trim() && item.origin === 'inferred' && (item.confidence == null || typeof item.confidence === 'number' && Number.isFinite(item.confidence)) ? [{ summary: item.summary.slice(0, MAX_RATIONALE_CHARS), origin: 'inferred', confidence: typeof item.confidence === 'number' ? Math.max(0, Math.min(1, item.confidence)) : undefined }] : []) : undefined
    return { valid: true, response: { ...common, purpose: 'responsive', breakpointHypotheses } }
  }
  if (request.purpose === 'evaluate') return { valid: true, response: { ...common, purpose: 'evaluate', score: typeof raw.score === 'number' && Number.isFinite(raw.score) ? Math.max(0, Math.min(1, raw.score)) : undefined } }
  return { valid: true, response: { ...common, purpose: 'understand' } }
}

export function assertResponseSize(raw: string): void {
  if (utf8Bytes(raw) > FROAM_INTELLIGENCE_MAX_RESPONSE_BYTES) throw new Error('Intelligence response exceeds the maximum size')
}

export type FroamRemoteIntelligencePrivacy = FroamProviderPrivacy & {
  execution: 'remote'
  requiresConsent: true
  sendsSourceCode: false
  sendsCredentials: false
}

export const REMOTE_INTELLIGENCE_PRIVACY: FroamRemoteIntelligencePrivacy = {
  execution: 'remote', requiresConsent: true, sendsSourceCode: false, sendsCredentials: false,
  dataDescription: 'Bounded Froam-native interface evidence and project memory. No source code, credentials, or raw screenshot pixels.',
}

export function assertRemoteIntelligenceConsent(consent: boolean): void {
  if (!consent) throw new Error('Remote intelligence requires explicit consent')
}
