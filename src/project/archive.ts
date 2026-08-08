import type { FroamArchiveItem, FroamDNA, FroamNode } from './types'

export function createArchiveItem(input: {
  id: string; nodeId: string; name: string; actorId: string; projectId: string; branchId: string; dna: FroamDNA;
  html?: string; legacyPath?: string; assetIds?: string[]; interactionIds?: string[]; now?: number
}): FroamArchiveItem {
  return {
    schemaVersion: 1, id: input.id, nodeId: input.nodeId, name: input.name.trim() || 'Archived component',
    createdAt: input.now ?? Date.now(), createdBy: input.actorId,
    snapshot: { html: input.html, legacyPath: input.legacyPath }, dna: input.dna,
    assetIds: input.assetIds ?? [], interactionIds: input.interactionIds ?? [],
    provenance: { projectId: input.projectId, branchId: input.branchId, sourceNodeId: input.nodeId }, usageNodeIds: [],
  }
}

export function upsertArchive(archive: Record<string, FroamArchiveItem>, item: FroamArchiveItem) { return { ...archive, [item.id]: item } }
export function removeFromArchive(archive: Record<string, FroamArchiveItem>, id: string) { const next = { ...archive }; delete next[id]; return next }
export function searchArchive(archive: Record<string, FroamArchiveItem>, query: string) {
  const needle = query.trim().toLowerCase()
  return Object.values(archive).filter((item) => !needle || `${item.name} ${item.dna.semantics?.role ?? ''}`.toLowerCase().includes(needle)).sort((a, b) => b.createdAt - a.createdAt)
}

export function reuseArchiveItem(item: FroamArchiveItem, input: { nodeId: string; parentId?: string | null; routeKey?: string; path?: string }): FroamNode {
  return { id: input.nodeId, kind: 'component-instance', name: item.name, parentId: input.parentId ?? null, componentId: item.id, source: 'froam', locator: { routeKey: input.routeKey, path: input.path }, metadata: { archiveItemId: item.id, derivedFrom: item.nodeId } }
}

function signature(item: FroamArchiveItem) {
  return JSON.stringify({ structure: item.dna.structure, layout: item.dna.layout, semantics: item.dna.semantics, visual: item.dna.visual })
}

export function similarArchiveItems(archive: Record<string, FroamArchiveItem>) {
  const items = Object.values(archive)
  const pairs: Array<{ left: string; right: string; confidence: number }> = []
  for (let i = 0; i < items.length; i += 1) for (let j = i + 1; j < items.length; j += 1) {
    const a = signature(items[i]); const b = signature(items[j])
    if (a === b) pairs.push({ left: items[i].id, right: items[j].id, confidence: .95 })
  }
  return pairs
}
