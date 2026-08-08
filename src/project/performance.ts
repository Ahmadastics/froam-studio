import { similarArchiveItems } from './archive'
import { predictAttention } from './attention'
import { materializeGraphRows } from './graph-inspector'
import { analyzeVisualRhythm } from './rhythm'
import { dnaFromScan } from './scan'
import type { FroamProjectState, FroamScanRecord } from './types'

export type FroamIntelligenceProfile = { nodeCount: number; scanMs?: number; dnaMs: number; graphMs: number; archiveSimilarityMs: number; attentionMs: number; rhythmMs: number; cinemaMs?: number; serializationMs: number; serializedBytes: number; memoryBytes?: number }
const timer = () => typeof performance !== 'undefined' ? performance.now() : Date.now()
function measured<T>(work: () => T) { const start = timer(); const value = work(); return { value, ms: timer() - start } }

export function profileIntelligence(input: { records: readonly FroamScanRecord[]; state: FroamProjectState; scanMs?: number; viewportHeight?: number; cinema?: () => unknown }): FroamIntelligenceProfile {
  const dna = measured(() => input.records.map(dnaFromScan)); const graph = measured(() => materializeGraphRows(input.state)); const archive = measured(() => similarArchiveItems(input.state.archive)); const attention = measured(() => predictAttention(input.records, 1)); const rhythm = measured(() => analyzeVisualRhythm(input.records, input.viewportHeight ?? 800, 1)); const cinema = input.cinema ? measured(input.cinema) : undefined; const serialization = measured(() => JSON.stringify({ ...input.state, dna: Object.fromEntries(dna.value.map((item) => [item.nodeId, item])) }))
  const memory = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize
  return { nodeCount: input.records.length, scanMs: input.scanMs, dnaMs: dna.ms, graphMs: graph.ms, archiveSimilarityMs: archive.ms, attentionMs: attention.ms, rhythmMs: rhythm.ms, cinemaMs: cinema?.ms, serializationMs: serialization.ms, serializedBytes: new TextEncoder().encode(serialization.value).byteLength, memoryBytes: memory }
}
