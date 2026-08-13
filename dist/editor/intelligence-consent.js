export const FROAM_INTELLIGENCE_CONSENT_KEY = 'froam-intelligence-consent-v1';
const LEGACY_REFERENCE_CONSENT_KEY = 'froam-reference-intelligence-consent-v1';
export function readFroamIntelligenceConsent(storage) {
    try {
        const value = storage?.getItem(FROAM_INTELLIGENCE_CONSENT_KEY)
            ?? storage?.getItem(LEGACY_REFERENCE_CONSENT_KEY);
        return value === 'allowed' || value === 'declined' ? value : 'unknown';
    }
    catch {
        return 'unknown';
    }
}
export function writeFroamIntelligenceConsent(storage, value) {
    try {
        storage?.setItem(FROAM_INTELLIGENCE_CONSENT_KEY, value);
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=intelligence-consent.js.map