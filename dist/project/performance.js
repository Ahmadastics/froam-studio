import { similarArchiveItems } from './archive.js';
import { predictAttention } from './attention.js';
import { materializeGraphRows } from './graph-inspector.js';
import { analyzeVisualRhythm } from './rhythm.js';
import { dnaFromScan } from './scan.js';
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
//# sourceMappingURL=performance.js.map