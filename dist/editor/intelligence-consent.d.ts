export declare const FROAM_INTELLIGENCE_CONSENT_KEY = "froam-intelligence-consent-v1";
export type FroamIntelligenceConsent = 'unknown' | 'allowed' | 'declined';
export declare function readFroamIntelligenceConsent(storage?: Pick<Storage, 'getItem'>): FroamIntelligenceConsent;
export declare function writeFroamIntelligenceConsent(storage: Pick<Storage, 'setItem'> | undefined, value: Exclude<FroamIntelligenceConsent, 'unknown'>): boolean;
//# sourceMappingURL=intelligence-consent.d.ts.map