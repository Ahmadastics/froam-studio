import type { FroamAnchor, FroamAnchorFingerprint, FroamAnchorResolution } from './types';
/**
 * Below this, a candidate is not the element — better an honest orphan than a
 * comment silently re-attached to the wrong paragraph.
 */
export declare const ANCHOR_MATCH_THRESHOLD = 0.5;
/**
 * How much a candidate looks like the thing the anchor was taken from, 0–1.
 *
 * Weights are normalised over whatever signals the original fingerprint
 * actually carried, so an element with an id is judged mostly on its id, and a
 * bare `<div>` with no id, text or classes can never clear the threshold on
 * tag alone — which is the honest answer for an element with nothing
 * distinguishing about it.
 */
export declare function scoreFingerprint(want: FroamAnchorFingerprint, got: FroamAnchorFingerprint): number;
export declare function fingerprintElement(element: HTMLElement, root: HTMLElement): FroamAnchorFingerprint;
export declare function createAnchor(element: HTMLElement, root: HTMLElement): FroamAnchor;
/**
 * Find what an anchor points at now.
 *
 * The path is tried first and cheaply, but it is *verified* against the
 * fingerprint rather than trusted — a path that still resolves after a
 * restructure is precisely the dangerous case, because it returns a real
 * element that is the wrong one.
 */
export declare function resolveAnchor(anchor: FroamAnchor, root: HTMLElement): FroamAnchorResolution;
//# sourceMappingURL=anchor.d.ts.map