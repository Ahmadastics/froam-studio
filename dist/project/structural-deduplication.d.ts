import type { FroamDNA } from './types';
export type FroamComponentFamilyEvidence = {
    id: string;
    memberNodeIds: string[];
    signature: string;
    confidence: number;
    explicit?: boolean;
};
export type FroamFactoredComponentFamily = {
    definitionId: string;
    memberNodeIds: string[];
    sharedDna: Partial<FroamDNA>;
    instanceOverrides: Record<string, Partial<FroamDNA>>;
    evidence: {
        signature: string;
        confidence: number;
        explicit: boolean;
    };
};
/** Only high-confidence observed families or explicit user choices are factored. */
export declare function factorComponentFamilies(families: readonly FroamComponentFamilyEvidence[], dna: Record<string, FroamDNA>, threshold?: number): FroamFactoredComponentFamily[];
//# sourceMappingURL=structural-deduplication.d.ts.map