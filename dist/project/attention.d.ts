import type { FroamAnalysis, FroamScanRecord } from './types';
export type FroamAttentionRank = {
    nodeId: string;
    score: number;
    rank: number;
    role: string;
    reasons: string[];
};
export declare function predictAttention(records: readonly FroamScanRecord[], now?: number): FroamAnalysis;
//# sourceMappingURL=attention.d.ts.map