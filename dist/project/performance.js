import { similarArchiveItems } from './archive.js';
import { predictAttention } from './attention.js';
import { materializeGraphRows } from './graph-inspector.js';
import { analyzeVisualRhythm } from './rhythm.js';
import { dnaFromScan } from './scan.js';
import { deriveBranchState } from './event-log.js';
import { packProjectDocument, profileProjectSize, unpackProjectDocument } from './storage-codec.js';
const timer = () => typeof performance !== 'undefined' ? performance.now() : Date.now();
function measured(work) { const start = timer(); const value = work(); return { value, ms: timer() - start }; }
export function profileIntelligence(input) {
    const dna = measured(() => input.records.map(dnaFromScan));
    const graph = measured(() => materializeGraphRows(input.state));
    const archive = measured(() => similarArchiveItems(input.state.archive));
    const attention = measured(() => predictAttention(input.records, 1));
    const rhythm = measured(() => analyzeVisualRhythm(input.records, input.viewportHeight ?? 800, 1));
    const cinema = input.cinema ? measured(input.cinema) : undefined;
    const serialization = measured(() => JSON.stringify({ ...input.state, dna: Object.fromEntries(dna.value.map((item) => [item.nodeId, item])) }));
    const memory = performance.memory?.usedJSHeapSize;
    return { nodeCount: input.records.length, scanMs: input.scanMs, dnaMs: dna.ms, graphMs: graph.ms, archiveSimilarityMs: archive.ms, attentionMs: attention.ms, rhythmMs: rhythm.ms, cinemaMs: cinema?.ms, serializationMs: serialization.ms, serializedBytes: new TextEncoder().encode(serialization.value).byteLength, memoryBytes: memory };
}
export function profileProjectPlatform(project) {
    const size = profileProjectSize(project);
    const materialize = measured(() => deriveBranchState(project));
    const packed = measured(() => packProjectDocument(project));
    const serialized = measured(() => { const candidate = JSON.stringify(packed.value); const raw = JSON.stringify(project); return candidate.length < raw.length ? candidate : raw; });
    const loaded = measured(() => { const value = JSON.parse(serialized.value); return value.kind === 'froam-packed-project' ? unpackProjectDocument(value) : value; });
    const replay = measured(() => deriveBranchState(loaded.value));
    return { size, materializeMs: materialize.ms, saveMs: packed.ms + serialized.ms, loadMs: loaded.ms, replayMs: replay.ms, packedBytes: new TextEncoder().encode(serialized.value).byteLength };
}
//# sourceMappingURL=performance.js.map