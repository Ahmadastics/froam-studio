import { packProjectDocument, unpackProjectDocument, type FroamPackedProject } from './storage-codec'
import type { FroamProjectDocument } from './types'

export type FroamHistoryCompactionReport = { beforeBytes: number; afterBytes: number; reductionPercent: number; applied: boolean; eventCount: number; eventIdsPreserved: boolean; checkpointIdsPreserved: boolean; canonicalEquivalent: boolean }

/**
 * Compacts the storage representation, never the canonical document. Events, IDs, payloads,
 * checkpoint states and branch fork references are restored exactly before use.
 */
export function compactProjectHistory(document: FroamProjectDocument): { packed: FroamPackedProject; report: FroamHistoryCompactionReport } {
  const packed = packProjectDocument(document); const restored = unpackProjectDocument(packed)
  const canonicalEquivalent = JSON.stringify(restored) === JSON.stringify(document)
  if (!canonicalEquivalent) throw new Error('Froam refused a non-equivalent history compaction')
  const beforeBytes = new TextEncoder().encode(JSON.stringify(document)).byteLength; const candidateBytes = new TextEncoder().encode(JSON.stringify(packed)).byteLength; const applied = candidateBytes < beforeBytes; const afterBytes = applied ? candidateBytes : beforeBytes
  return { packed, report: { beforeBytes, afterBytes, reductionPercent: beforeBytes ? (1 - afterBytes / beforeBytes) * 100 : 0, applied, eventCount: document.events.length, eventIdsPreserved: document.events.every((event, index) => restored.events[index]?.id === event.id), checkpointIdsPreserved: Object.keys(document.checkpoints).every((id) => Boolean(restored.checkpoints[id])), canonicalEquivalent } }
}
