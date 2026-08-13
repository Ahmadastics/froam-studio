import { FROAM_INTELLIGENCE_CONSENT_KEY, readFroamIntelligenceConsent, writeFroamIntelligenceConsent } from './intelligence-consent.js';
export const FROAM_REFERENCE_CONSENT_KEY = FROAM_INTELLIGENCE_CONSENT_KEY;
export const FROAM_REFERENCE_ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];
export const FROAM_REFERENCE_MAX_PIXELS = 20_000_000;
export const FROAM_REFERENCE_MAX_REFERENCES = 20;
export function validateReferenceFile(input) {
    if (!FROAM_REFERENCE_ACCEPTED_TYPES.includes(input.type))
        return { valid: false, reason: 'Use a PNG, JPEG or WebP screenshot' };
    if (!Number.isFinite(input.size) || input.size <= 0)
        return { valid: false, reason: 'The screenshot file is empty' };
    return { valid: true };
}
export function validateReferenceDimensions(width, height) {
    if (!Number.isFinite(width) || !Number.isFinite(height) || width < 16 || height < 16)
        return { valid: false, reason: 'The screenshot dimensions are invalid' };
    if (width * height > FROAM_REFERENCE_MAX_PIXELS)
        return { valid: false, reason: 'The screenshot exceeds Froam’s 20 megapixel reconstruction limit' };
    return { valid: true };
}
/** A suggestion from observable width, never a claim about the originating device. */
export function suggestReferenceLabel(width) { return width < 640 ? 'Mobile' : width < 1024 ? 'Tablet' : 'Desktop'; }
export function referenceQualityLabel(value) {
    if (value === undefined)
        return { label: '—', detail: 'Not measured', tone: 'unknown' };
    if (value >= .85)
        return { label: 'Strong', detail: `${Math.round(value * 100)}% measured`, tone: 'strong' };
    if (value >= .7)
        return { label: 'Good', detail: `${Math.round(value * 100)}% measured`, tone: 'good' };
    if (value >= .5)
        return { label: 'Moderate', detail: `${Math.round(value * 100)}% measured`, tone: 'moderate' };
    return { label: 'Limited', detail: `${Math.round(value * 100)}% measured`, tone: 'limited' };
}
export function referenceQualityRows(quality) {
    return [
        ['Structure', referenceQualityLabel(quality.structure)],
        ['Geometry', referenceQualityLabel(quality.geometry)],
        ['Text', referenceQualityLabel(quality.text)],
        ['Responsive', referenceQualityLabel(quality.responsiveEvidence)],
        ['Visual', referenceQualityLabel(quality.visual)],
    ];
}
export function readReferenceConsent(storage) {
    return readFroamIntelligenceConsent(storage);
}
export function writeReferenceConsent(storage, value) {
    return writeFroamIntelligenceConsent(storage, value);
}
//# sourceMappingURL=reference-workspace-model.js.map