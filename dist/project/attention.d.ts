import type { FroamAnalysis, FroamScanRecord } from './types';
export type FroamAttentionRank = {
    nodeId: string;
    score: number;
    rank: number;
    role: string;
    reasons: string[];
};
export type FroamAttentionFixture = {
    id: string;
    records: FroamScanRecord[];
    expectedTopNodeIds: string[];
    note: string;
};
export type FroamAttentionEvaluation = {
    provider: string;
    fixtures: number;
    topChoiceAgreement: number;
    meanTopThreeRecall: number;
    results: Array<{
        fixtureId: string;
        topChoice: boolean;
        topThreeRecall: number;
    }>;
};
export interface FroamAttentionProvider {
    id: string;
    maturity: 'experimental';
    method: string;
    predict(records: readonly FroamScanRecord[], now?: number): FroamAnalysis;
}
export declare const LOCAL_ATTENTION_PROVIDER: FroamAttentionProvider;
export declare function predictAttention(records: readonly FroamScanRecord[], now?: number): FroamAnalysis;
export declare function evaluateAttentionProvider(provider: FroamAttentionProvider, fixtures: readonly FroamAttentionFixture[]): FroamAttentionEvaluation;
//# sourceMappingURL=attention.d.ts.map