import type { FroamReferenceQuality } from '../project/reference-intelligence';
import { type FroamIntelligenceConsent } from './intelligence-consent';
export declare const FROAM_REFERENCE_CONSENT_KEY = "froam-intelligence-consent-v1";
export declare const FROAM_REFERENCE_ACCEPTED_TYPES: readonly ["image/png", "image/jpeg", "image/webp"];
export declare const FROAM_REFERENCE_MAX_PIXELS = 20000000;
export declare const FROAM_REFERENCE_MAX_REFERENCES = 20;
export type FroamReferenceConsent = FroamIntelligenceConsent;
export declare function validateReferenceFile(input: {
    type: string;
    size: number;
}): {
    valid: false;
    reason: string;
} | {
    valid: true;
    reason?: undefined;
};
export declare function validateReferenceDimensions(width: number, height: number): {
    valid: false;
    reason: string;
} | {
    valid: true;
    reason?: undefined;
};
/** A suggestion from observable width, never a claim about the originating device. */
export declare function suggestReferenceLabel(width: number): "Desktop" | "Mobile" | "Tablet";
export declare function referenceQualityLabel(value: number | undefined): {
    label: string;
    detail: string;
    tone: "unknown";
} | {
    label: string;
    detail: string;
    tone: "strong";
} | {
    label: string;
    detail: string;
    tone: "good";
} | {
    label: string;
    detail: string;
    tone: "moderate";
} | {
    label: string;
    detail: string;
    tone: "limited";
};
export declare function referenceQualityRows(quality: FroamReferenceQuality): readonly [readonly ["Structure", {
    label: string;
    detail: string;
    tone: "unknown";
} | {
    label: string;
    detail: string;
    tone: "strong";
} | {
    label: string;
    detail: string;
    tone: "good";
} | {
    label: string;
    detail: string;
    tone: "moderate";
} | {
    label: string;
    detail: string;
    tone: "limited";
}], readonly ["Geometry", {
    label: string;
    detail: string;
    tone: "unknown";
} | {
    label: string;
    detail: string;
    tone: "strong";
} | {
    label: string;
    detail: string;
    tone: "good";
} | {
    label: string;
    detail: string;
    tone: "moderate";
} | {
    label: string;
    detail: string;
    tone: "limited";
}], readonly ["Text", {
    label: string;
    detail: string;
    tone: "unknown";
} | {
    label: string;
    detail: string;
    tone: "strong";
} | {
    label: string;
    detail: string;
    tone: "good";
} | {
    label: string;
    detail: string;
    tone: "moderate";
} | {
    label: string;
    detail: string;
    tone: "limited";
}], readonly ["Responsive", {
    label: string;
    detail: string;
    tone: "unknown";
} | {
    label: string;
    detail: string;
    tone: "strong";
} | {
    label: string;
    detail: string;
    tone: "good";
} | {
    label: string;
    detail: string;
    tone: "moderate";
} | {
    label: string;
    detail: string;
    tone: "limited";
}], readonly ["Visual", {
    label: string;
    detail: string;
    tone: "unknown";
} | {
    label: string;
    detail: string;
    tone: "strong";
} | {
    label: string;
    detail: string;
    tone: "good";
} | {
    label: string;
    detail: string;
    tone: "moderate";
} | {
    label: string;
    detail: string;
    tone: "limited";
}]];
export declare function readReferenceConsent(storage?: Pick<Storage, 'getItem'>): FroamReferenceConsent;
export declare function writeReferenceConsent(storage: Pick<Storage, 'setItem'> | undefined, value: Exclude<FroamReferenceConsent, 'unknown'>): boolean;
//# sourceMappingURL=reference-workspace-model.d.ts.map