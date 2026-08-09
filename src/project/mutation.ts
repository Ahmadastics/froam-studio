import { appendProjectEvents, applyProjectEvent, createProjectBranch, createProjectEvent, deriveBranchState } from './event-log'
import type { FroamDNA, FroamProjectDocument, FroamProjectEvent, FroamProjectEventPayload, FroamProjectEventType, FroamProjectState } from './types'

export type FroamMutationLevel = 'safe' | 'experimental' | 'unhinged'
export type FroamMutationDomain = 'visual' | 'typography' | 'spacing' | 'layout' | 'navigation' | 'interactions' | 'motion' | 'responsive' | 'composition'
export type FroamMutationProtection = 'copy' | 'brand-colors' | 'logo' | 'product-data' | 'navigation' | 'component' | 'section'
export type FroamMutationConstraints = { protect: FroamMutationProtection[]; allow: FroamMutationDomain[]; protectedNodeIds?: string[] }
export type FroamMutationProposal = { type: FroamProjectEventType; payload: FroamProjectEventPayload; targetIds: string[]; rationale: string; domain: FroamMutationDomain; confidence: number; dependencies?: string[] }
export type FroamMutationRequest = { state: FroamProjectState; scopeNodeIds: string[]; level: FroamMutationLevel; constraints: FroamMutationConstraints; seed?: number; now: number; projectContext?: Record<string, unknown> }
export interface FroamMutationProvider { id: string; version: string; local: boolean; propose(request: FroamMutationRequest): FroamMutationProposal[] }
export type FroamMutationProvenance = { id: string; sourceBranchId: string; sourceCheckpointId: string; level: FroamMutationLevel; provider: string; operationIds: string[]; targetScope: string[]; constraints: FroamMutationConstraints; createdAt: number }
export type FroamMutationComparison = { sourceBranchId: string; mutationBranchId: string; changedNodeIds: string[]; structural: number; visual: number; interactions: number; responsive: number; eventIds: string[] }
export type FroamAdoptionResult = { status: 'adopted' | 'refused'; project: FroamProjectDocument; adoptedEventIds: string[]; conflicts: Array<{ eventId: string; targetId: string; reason: string }> }

const DEFAULT_ALLOWED: Record<FroamMutationLevel, FroamMutationDomain[]> = {
  safe: ['visual', 'typography', 'spacing', 'motion'],
  experimental: ['visual', 'typography', 'spacing', 'layout', 'navigation', 'interactions', 'motion', 'responsive', 'composition'],
  unhinged: ['visual', 'typography', 'spacing', 'layout', 'navigation', 'interactions', 'motion', 'responsive', 'composition'],
}
export function normalizeMutationConstraints(level: FroamMutationLevel, input?: Partial<FroamMutationConstraints>): FroamMutationConstraints {
  const allowed = new Set(DEFAULT_ALLOWED[level]); const requested = input?.allow?.filter((item) => allowed.has(item)) ?? DEFAULT_ALLOWED[level]
  return { protect: [...new Set(input?.protect ?? [])], allow: [...new Set(requested)], protectedNodeIds: [...new Set(input?.protectedNodeIds ?? [])] }
}
function roleOf(state: FroamProjectState, nodeId: string) { return String(state.dna[nodeId]?.semantics?.role ?? state.nodes[nodeId]?.metadata?.semanticRole ?? '') }
function isProtected(request: FroamMutationRequest, nodeId: string) {
  if (request.constraints.protectedNodeIds?.includes(nodeId)) return true
  const role = roleOf(request.state, nodeId)
  return request.constraints.protect.includes('navigation') && /navigation|menu/.test(role) || request.constraints.protect.includes('logo') && /logo/.test(role)
}
function proposalAllowed(request: FroamMutationRequest, proposal: FroamMutationProposal) {
  if (!request.constraints.allow.includes(proposal.domain)) return false
  if (proposal.targetIds.some((id) => isProtected(request, id))) return false
  if (request.level === 'safe' && !['dna.captured', 'interaction.upserted'].includes(proposal.type)) return false
  return true
}

export const deterministicMutationProvider: FroamMutationProvider = { id: 'froam-deterministic-mutagen', version: '2', local: true, propose(request) {
  const alternatives: Record<string, string> = { navigation: 'command-interface', menu: 'contextual-command-interface', card: 'adaptive-detail-browser', list: 'progressive-exploration', form: 'conversational-sequence', unknown: 'contextual-workspace' }
  const proposals = [...request.scopeNodeIds].sort().flatMap((nodeId, index) => {
    const node = request.state.nodes[nodeId]; if (!node || isProtected(request, nodeId)) return []
    const dna = request.state.dna[nodeId]; const accent = ['#b8ff2c', '#68f7ff', '#ff6bd6'][(index + (request.seed ?? 0)) % 3]
    const visual: FroamMutationProposal = { type: 'dna.captured', targetIds: [nodeId], domain: 'visual', confidence: .96, rationale: 'Reframe the surface while preserving semantic content', payload: { dna: { ...(dna ?? { schemaVersion: 1, nodeId, capturedAt: 0 }), capturedAt: request.now, visual: { ...dna?.visual, mutationAccent: accent, mutationLevel: request.level, ...(request.constraints.protect.includes('brand-colors') ? {} : { surfaceTreatment: index % 2 ? 'luminous-edge' : 'tonal-depth' }) }, provenance: { ...dna?.provenance, mutationProvider: 'froam-deterministic-mutagen@2' } } } }
    const result: FroamMutationProposal[] = [visual]
    if (request.level !== 'safe') result.push({ type: 'node.upserted', targetIds: [nodeId], domain: 'composition', confidence: .86, rationale: 'Recompose the selected product region without deleting its data semantics', payload: { node: { ...node, metadata: { ...node.metadata, mutation: { level: request.level, composition: index % 2 ? 'adaptive-stack' : 'context-grid', preservesContent: true } } } } })
    if (request.level === 'unhinged') { const role = roleOf(request.state, nodeId) || 'unknown'; result.push({ type: 'node.upserted', targetIds: [nodeId], domain: 'navigation', confidence: .72, rationale: `Replace conventional ${role} presentation with a coherent alternate interaction model`, payload: { node: { ...node, metadata: { ...node.metadata, mutation: { level: 'unhinged', interfaceModel: alternatives[role] ?? alternatives.unknown, preservesPurpose: true, preservesProductData: true } } } } }); result.push({ type: 'interaction.upserted', targetIds: [nodeId], domain: 'interactions', confidence: .78, rationale: 'Make the alternate model explorable through a reversible reveal', payload: { interaction: { id: `mutation:interaction:${nodeId}`, name: 'Mutagen contextual reveal', sourceId: nodeId, targetIds: [nodeId], trigger: 'click', timeline: [{ at: 0, values: { opacity: .72, transform: 'scale(.985)' } }, { at: 1, values: { opacity: 1, transform: 'scale(1)' } }], durationMs: 280, metadata: { experimental: true, mutationLevel: request.level, preservesContent: true } } } }) }
    return result
  })
  return proposals.filter((proposal) => proposalAllowed(request, proposal))
} }

export function previewMutation(provider: FroamMutationProvider, request: FroamMutationRequest) {
  const proposals = provider.propose(request).filter((proposal) => proposalAllowed(request, proposal))
  return { provider: `${provider.id}@${provider.version}`, level: request.level, proposals, summary: proposals.map((item) => ({ domain: item.domain, rationale: item.rationale, targets: item.targetIds.length, confidence: item.confidence })), requiresConfirmation: proposals.length > 3 || proposals.some((item) => ['layout', 'navigation', 'composition'].includes(item.domain)) }
}

export function createMutationPrototype(document: FroamProjectDocument, input: { branchId: string; name?: string; actorId: string; level: FroamMutationLevel; scopeNodeIds: string[]; provider?: FroamMutationProvider; constraints?: Partial<FroamMutationConstraints>; projectContext?: Record<string, unknown>; now?: number; seed?: number; idFactory?: () => string }) {
  const sourceBranchId = document.activeBranchId; const sourceCheckpointId = document.branches[sourceBranchId].baseCheckpointId; const provider = input.provider ?? deterministicMutationProvider; const now = input.now ?? Date.now(); const constraints = normalizeMutationConstraints(input.level, input.constraints)
  const request: FroamMutationRequest = { state: deriveBranchState(document, sourceBranchId), scopeNodeIds: [...new Set(input.scopeNodeIds)], level: input.level, constraints, seed: input.seed, now, projectContext: input.projectContext }
  const preview = previewMutation(provider, request)
  let project = createProjectBranch(document, { id: input.branchId, name: input.name ?? `Mutation ${input.branchId}`, actorId: input.actorId, fromBranchId: sourceBranchId, now, idFactory: input.idFactory })
  const baseClock = Math.max(0, ...project.events.map((event) => event.clock)); const events = preview.proposals.map((proposal, index) => createProjectEvent({ projectId: project.id, branchId: input.branchId, actorId: input.actorId, clock: baseClock + index + 1, createdAt: now + index, type: proposal.type, payload: proposal.payload, targetIds: proposal.targetIds, label: `MUTATE ${input.level}: ${proposal.rationale}`, idFactory: input.idFactory }))
  project = appendProjectEvents(project, events)
  const provenance: FroamMutationProvenance = { id: input.branchId, sourceBranchId, sourceCheckpointId, level: input.level, provider: preview.provider, operationIds: events.map((event) => event.id), targetScope: request.scopeNodeIds, constraints, createdAt: now }
  const relationEvents = request.scopeNodeIds.filter((id) => request.state.nodes[id]).map((nodeId, index) => createProjectEvent({ projectId: project.id, branchId: input.branchId, actorId: input.actorId, clock: baseClock + events.length + index + 1, createdAt: now + events.length + index, type: 'relation.upserted', payload: { relation: { id: `mutation-lineage:${input.branchId}:${nodeId}`, kind: 'derived-from', from: nodeId, to: nodeId, metadata: { mutationId: input.branchId, sourceBranchId, sourceCheckpointId, level: input.level, provider: preview.provider } } }, targetIds: [nodeId], label: 'Mutation lineage', idFactory: input.idFactory }))
  project = appendProjectEvents(project, relationEvents)
  return { project: { ...project, metadata: { ...project.metadata, mutations: [...((project.metadata?.mutations as FroamMutationProvenance[] | undefined) ?? []), provenance] } }, provenance: { ...provenance, operationIds: [...events, ...relationEvents].map((event) => event.id) }, proposals: preview.proposals, preview }
}

function stable(value: unknown) { return JSON.stringify(value) }
export function compareMutationBranches(document: FroamProjectDocument, sourceBranchId: string, mutationBranchId: string): FroamMutationComparison {
  const source = deriveBranchState(document, sourceBranchId); const mutation = deriveBranchState(document, mutationBranchId); const changedNodeIds = [...new Set([...Object.keys(source.nodes), ...Object.keys(mutation.nodes), ...Object.keys(source.dna), ...Object.keys(mutation.dna)])].filter((id) => stable(source.nodes[id]) !== stable(mutation.nodes[id]) || stable(source.dna[id]) !== stable(mutation.dna[id]))
  const mutationEvents = document.events.filter((event) => event.branchId === mutationBranchId)
  return { sourceBranchId, mutationBranchId, changedNodeIds, structural: mutationEvents.filter((event) => event.type.startsWith('node.') || event.type.startsWith('relation.')).length, visual: mutationEvents.filter((event) => event.type === 'dna.captured').length, interactions: mutationEvents.filter((event) => event.type.startsWith('interaction.')).length, responsive: mutationEvents.filter((event) => event.type.startsWith('responsive.')).length, eventIds: mutationEvents.map((event) => event.id) }
}
function valueForEvent(state: FroamProjectState, event: FroamProjectEvent) { const payload = event.payload as Record<string, any>; if (event.type.startsWith('node.')) return state.nodes[payload.node?.id ?? payload.nodeId]; if (event.type.startsWith('relation.')) return state.relations[payload.relation?.id ?? payload.relationId]; if (event.type.startsWith('interaction.')) return state.interactions[payload.interaction?.id ?? payload.interactionId]; if (event.type === 'dna.captured') return state.dna[payload.dna?.nodeId]; if (event.type.startsWith('responsive.')) return state.responsive[payload.responsive?.nodeId ?? payload.nodeId]; return undefined }
const ADOPTABLE = new Set<FroamProjectEventType>(['node.upserted', 'relation.upserted', 'interaction.upserted', 'dna.captured', 'responsive.upserted'])
export function adoptMutationChanges(document: FroamProjectDocument, input: { mutationBranchId: string; targetBranchId: string; eventIds: string[]; actorId: string; now?: number; idFactory?: () => string }): FroamAdoptionResult {
  const mutation = document.branches[input.mutationBranchId]; const target = document.branches[input.targetBranchId]; if (!mutation || !target) throw new Error('Unknown mutation or target branch')
  const base = document.checkpoints[mutation.rootCheckpointId ?? mutation.baseCheckpointId]?.state; if (!base) throw new Error('Mutation fork checkpoint is missing')
  const targetState = deriveBranchState(document, input.targetBranchId); const chosen = document.events.filter((event) => event.branchId === input.mutationBranchId && input.eventIds.includes(event.id) && ADOPTABLE.has(event.type)); const conflicts: FroamAdoptionResult['conflicts'] = []
  for (const event of chosen) if (stable(valueForEvent(targetState, event)) !== stable(valueForEvent(base, event))) for (const targetId of event.targetIds.length ? event.targetIds : ['project']) conflicts.push({ eventId: event.id, targetId, reason: 'Target changed since the mutation fork' })
  if (conflicts.length) return { status: 'refused', project: document, adoptedEventIds: [], conflicts }
  const now = input.now ?? Date.now(); const baseClock = Math.max(0, ...document.events.map((event) => event.clock)); const adopted = chosen.map((event, index) => createProjectEvent({ projectId: document.id, branchId: input.targetBranchId, actorId: input.actorId, clock: baseClock + index + 1, createdAt: now + index, type: event.type, payload: structuredClone(event.payload), targetIds: event.targetIds, label: `Adopted from ${input.mutationBranchId}: ${event.label ?? event.type}`, idFactory: input.idFactory })); let project = appendProjectEvents(document, adopted)
  const adoption = { mutationBranchId: input.mutationBranchId, targetBranchId: input.targetBranchId, sourceEventIds: chosen.map((event) => event.id), adoptedEventIds: adopted.map((event) => event.id), createdAt: now, actorId: input.actorId }
  project = { ...project, metadata: { ...project.metadata, mutationAdoptions: [...((project.metadata?.mutationAdoptions as unknown[] | undefined) ?? []), adoption] } }
  return { status: 'adopted', project, adoptedEventIds: adopted.map((event) => event.id), conflicts: [] }
}

export function materializeMutationPreview(state: FroamProjectState, proposals: readonly FroamMutationProposal[]) { return proposals.reduce((current, proposal, index) => applyProjectEvent(current, { schemaVersion: 2, id: `preview-${index}`, projectId: 'preview', branchId: 'preview', actorId: 'preview', clock: index + 1, createdAt: 0, type: proposal.type, targetIds: proposal.targetIds, payload: proposal.payload }), structuredClone(state)) }
