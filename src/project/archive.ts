import { FROAM_DNA_SCHEMA_VERSION, type FroamArchiveItem, type FroamDNA, type FroamInteraction, type FroamNode } from './types'

export type FroamArchiveKind = NonNullable<FroamArchiveItem['kind']>

export function archiveItemKind(item: FroamArchiveItem): FroamArchiveKind { return item.kind ?? 'component' }

export function minimalArchiveDna(nodeId: string, input: { role?: string; tagName?: string; styles?: Record<string, string>; motion?: FroamInteraction } = {}): FroamDNA {
  return {
    schemaVersion: FROAM_DNA_SCHEMA_VERSION,
    nodeId,
    capturedAt: Date.now(),
    identity: input.tagName ? { tagName: input.tagName } : undefined,
    semantics: { role: input.role ?? 'unknown' },
    visual: input.styles ? { archivedStyles: input.styles } : undefined,
    motion: input.motion ? { interactionId: input.motion.id, trigger: input.motion.trigger, durationMs: input.motion.durationMs } : undefined,
    provenance: { capture: 'archive-direct', observed: true },
  }
}

export function createArchiveItem(input: {
  id: string; nodeId: string; name: string; actorId: string; projectId: string; branchId: string; dna: FroamDNA;
  html?: string; legacyPath?: string; assetIds?: string[]; interactionIds?: string[]; variantOf?: string; now?: number;
  kind?: FroamArchiveKind; description?: string; tags?: string[]; styles?: Record<string, string>; interaction?: FroamInteraction;
  includes?: Array<'structure' | 'styles' | 'motion' | 'behavior'>
}): FroamArchiveItem {
  return {
    schemaVersion: input.kind ? 2 : 1, id: input.id, nodeId: input.nodeId, name: input.name.trim() || 'Archived artifact',
    kind: input.kind, description: input.description, tags: input.tags,
    createdAt: input.now ?? Date.now(), createdBy: input.actorId,
    snapshot: { html: input.html, legacyPath: input.legacyPath }, dna: input.dna,
    assetIds: input.assetIds ?? [], interactionIds: input.interactionIds ?? [],
    variantOf: input.variantOf, provenance: { projectId: input.projectId, branchId: input.branchId, sourceNodeId: input.nodeId }, usageNodeIds: [],
    artifact: input.kind ? { styles: input.styles, interaction: input.interaction, interactionIds: input.interactionIds, includes: input.includes } : undefined,
    metadata: { componentFamilyId: input.dna.structure?.componentFamilyId, useCount: 0 },
  }
}

export function upsertArchive(archive: Record<string, FroamArchiveItem>, item: FroamArchiveItem) { return { ...archive, [item.id]: item } }
export function removeFromArchive(archive: Record<string, FroamArchiveItem>, id: string) { const next = { ...archive }; delete next[id]; return next }
export function searchArchive(archive: Record<string, FroamArchiveItem>, query: string) {
  const needle = query.trim().toLowerCase()
  return Object.values(archive).filter((item) => !needle || `${item.name} ${archiveItemKind(item)} ${item.description ?? ''} ${(item.tags ?? []).join(' ')} ${item.dna.semantics?.role ?? ''}`.toLowerCase().includes(needle)).sort((a, b) => b.createdAt - a.createdAt)
}

export function reuseArchiveItem(item: FroamArchiveItem, input: { nodeId: string; parentId?: string | null; routeKey?: string; path?: string }): FroamNode {
  return { id: input.nodeId, kind: 'component-instance', name: item.name, parentId: input.parentId ?? null, componentId: item.id, source: 'froam', locator: { routeKey: input.routeKey, path: input.path }, metadata: { archiveItemId: item.id, derivedFrom: item.nodeId } }
}

export function recordArchiveUsage(item: FroamArchiveItem, nodeId: string): FroamArchiveItem { return { ...item, usageNodeIds: [...new Set([...item.usageNodeIds, nodeId])], metadata: { ...item.metadata, lastReusedAt: Date.now() } } }

export function recordArchiveArtifactUse(item: FroamArchiveItem, nodeId?: string, now = Date.now()): FroamArchiveItem {
  const count = Number(item.metadata?.useCount ?? item.usageNodeIds.length)
  return { ...item, usageNodeIds: nodeId ? [...new Set([...item.usageNodeIds, nodeId])] : item.usageNodeIds, metadata: { ...item.metadata, useCount: count + 1, lastReusedAt: now } }
}

function signature(item: FroamArchiveItem) {
  return JSON.stringify({ structure: item.dna.structure, layout: item.dna.layout, semantics: item.dna.semantics, visual: item.dna.visual })
}

export function similarArchiveItems(archive: Record<string, FroamArchiveItem>) {
  const items = Object.values(archive)
  const pairs: Array<{ left: string; right: string; confidence: number }> = []
  const buckets = new Map<string, FroamArchiveItem[]>()
  for (const item of items) buckets.set(signature(item), [...(buckets.get(signature(item)) ?? []), item])
  for (const bucket of buckets.values()) for (let i = 0; i < bucket.length; i += 1) for (let j = i + 1; j < bucket.length; j += 1) pairs.push({ left: bucket[i].id, right: bucket[j].id, confidence: .95 })
  const exact = new Set(pairs.map((pair) => [pair.left, pair.right].sort().join('|')))
  const semanticBuckets = new Map<string, FroamArchiveItem[]>()
  for (const item of items) { const role = String(item.dna.semantics?.role ?? 'unknown'); if (role !== 'unknown') semanticBuckets.set(role, [...(semanticBuckets.get(role) ?? []), item]) }
  for (const bucket of semanticBuckets.values()) for (let i = 0; i < bucket.length; i += 1) for (let j = i + 1; j < bucket.length; j += 1) { const key = [bucket[i].id, bucket[j].id].sort().join('|'); if (exact.has(key)) continue; const a = bucket[i].dna; const b = bucket[j].dna; let confidence = .55; if (a.layout?.display === b.layout?.display) confidence += .12; if (JSON.stringify(a.structure?.childNodeIds ?? []) === JSON.stringify(b.structure?.childNodeIds ?? [])) confidence += .12; if (a.structure?.componentFamilyId && a.structure.componentFamilyId === b.structure?.componentFamilyId) confidence += .16; if (confidence >= .67) pairs.push({ left: bucket[i].id, right: bucket[j].id, confidence: Math.min(.9, confidence) }) }
  return pairs
}
