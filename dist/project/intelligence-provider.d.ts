import type { FroamAnalysis, FroamScanRecord } from './types';
export type FroamProviderPrivacy = {
    execution: 'local' | 'remote';
    sendsSourceCode: boolean;
    sendsCredentials: boolean;
    dataDescription: string;
};
export type FroamIntelligenceProvider = {
    id: string;
    privacy: FroamProviderPrivacy;
    analyze?(records: readonly FroamScanRecord[]): Promise<FroamAnalysis>;
};
export declare const LOCAL_HEURISTIC_PROVIDER: FroamIntelligenceProvider;
export declare function assertRemoteProviderConsent(provider: FroamIntelligenceProvider, consent: boolean): void;
//# sourceMappingURL=intelligence-provider.d.ts.map