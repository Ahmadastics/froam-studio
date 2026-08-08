import type { FroamProjectState, FroamScanRecord } from './types';
export type FroamIntelligenceProfile = {
    nodeCount: number;
    scanMs?: number;
    dnaMs: number;
    graphMs: number;
    archiveSimilarityMs: number;
    attentionMs: number;
    rhythmMs: number;
    cinemaMs?: number;
    serializationMs: number;
    serializedBytes: number;
    memoryBytes?: number;
};
export declare function profileIntelligence(input: {
    records: readonly FroamScanRecord[];
    state: FroamProjectState;
    scanMs?: number;
    viewportHeight?: number;
    cinema?: () => unknown;
}): FroamIntelligenceProfile;
//# sourceMappingURL=performance.d.ts.map