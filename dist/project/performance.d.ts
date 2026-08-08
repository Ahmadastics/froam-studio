import type { FroamProjectState, FroamScanRecord } from './types';
import type { FroamProjectDocument } from './types';
import { profileProjectSize } from './storage-codec';
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
export type FroamPlatformProfile = {
    size: ReturnType<typeof profileProjectSize>;
    materializeMs: number;
    saveMs: number;
    loadMs: number;
    replayMs: number;
    packedBytes: number;
};
export declare function profileIntelligence(input: {
    records: readonly FroamScanRecord[];
    state: FroamProjectState;
    scanMs?: number;
    viewportHeight?: number;
    cinema?: () => unknown;
}): FroamIntelligenceProfile;
export declare function profileProjectPlatform(project: FroamProjectDocument): FroamPlatformProfile;
//# sourceMappingURL=performance.d.ts.map