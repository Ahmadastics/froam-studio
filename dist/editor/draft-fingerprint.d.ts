import type { FroamAnchorFingerprint } from '../collab/types';
export declare function sampleFingerprintText(value: string): string;
/**
 * Fingerprint `element` for storage alongside a draft.
 *
 * `originalText` is the element's text before Froam touched it, when the editor
 * has one. `undefined` means the text was never edited, in which case what is
 * on screen is what is in the repo and the live sample is correct.
 */
export declare function fingerprintForDraft(element: HTMLElement, root: HTMLElement, originalText?: string): FroamAnchorFingerprint;
//# sourceMappingURL=draft-fingerprint.d.ts.map