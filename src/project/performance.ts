import { similarArchiveItems } from './archive'
import { predictAttention } from './attention'
import { materializeGraphRows } from './graph-inspector'
import { analyzeVisualRhythm } from './rhythm'
import { dnaFromScan } from './scan'
import type { FroamProjectState, FroamScanRecord } from './types'
import type { FroamProjectDocument } from './types'
import { deriveBranchState } from './event-log'
import { packProjectDocument, profileProjectSize, unpackProjectDocument } from './storage-codec'

export type FroamIntelligenceProfile = { nodeCount: number; scanMs?: number; dnaMs: number; graphMs: number; archiveSimilarityMs: number; attentionMs: number; rhythmMs: number; cinemaMs?: number; serializationMs: number; serializedBytes: number; memoryBytes?: number }
export type FroamPlatformProfile = { size: ReturnType<typeof profileProjectSize>; materializeMs: number; saveMs: number; loadMs: number; replayMs: number; packedBytes: number }
const timer = () => typeof performance !== 'undefined' ? performance.now() : Date.now()
function measured<T>(work: () => T) { const start = timer(); const value = work(); return { value, ms: timer() - start } }

export function profileIntelligence(input: { records: readonly FroamScanRecord[]; state: FroamProjectState; scanMs?: number; viewportHeight?: number; cinema?: () => unknown }): FroamIntelligenceProfile {
  const dna = measured(() => input.records.map(dnaFromScan)); const graph = measured(() => materializeGraphRows(input.state)); const archive = measured(() => similarArchiveItems(input.state.archive)); const attention = measured(() => predictAttention(input.records, 1)); const rhythm = measured(() => analyzeVisualRhythm(input.records, input.viewportHeight ?? 800, 1)); const cinema = input.cinema ? measured(input.cinema) : undefined; const serialization = measured(() => JSON.stringify({ ...input.state, dna: Object.fromEntries(dna.value.map((item) => [item.nodeId, item])) }))
  const memory = (performance as unknown as { memory?: { usedJSHeapSize?: number } }).memory?.usedJSHeapSize
  return { nodeCount: input.records.length, scanMs: input.scanMs, dnaMs: dna.ms, graphMs: graph.ms, archiveSimilarityMs: archive.ms, attentionMs: attention.ms, rhythmMs: rhythm.ms, cinemaMs: cinema?.ms, serializationMs: serialization.ms, serializedBytes: new TextEncoder().encode(serialization.value).byteLength, memoryBytes: memory }
}

export function profileProjectPlatform(project: FroamProjectDocument): FroamPlatformProfile {
  const size = profileProjectSize(project); const materialize = measured(() => deriveBranchState(project)); const packed = measured(() => packProjectDocument(project)); const serialized = measured(() => { const candidate = JSON.stringify(packed.value); const raw = JSON.stringify(project); return candidate.length < raw.length ? candidate : raw }); const loaded = measured(() => { const value = JSON.parse(serialized.value); return value.kind === 'froam-packed-project' ? unpackProjectDocument(value) : value as FroamProjectDocument }); const replay = measured(() => deriveBranchState(loaded.value))
  return { size, materializeMs: materialize.ms, saveMs: packed.ms + serialized.ms, loadMs: loaded.ms, replayMs: replay.ms, packedBytes: new TextEncoder().encode(serialized.value).byteLength }
}
