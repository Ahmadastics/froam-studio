/**
 * Accessibility, read off the live page once. The A11y tab, the Health scan,
 * "Fix contrast everywhere", the reviewer checks and the scan profile all ask
 * these functions, so they cannot give three answers about one element.
 *
 * Browser only (reads computed styles and layout). The thresholds are WCAG
 * 2.2 AA: 1.4.3 contrast, 1.1.1 text alternatives, 4.1.2 names and 2.5.8
 * target size with its inline and spacing exceptions. Where a number can't be
 * measured honestly — words over a photo, gradient-filled letters — the
 * answer says so instead of guessing.
 */
import { type Rgba } from './wcag';
export declare const ownText: (element: Element) => boolean;
/** How much of an element survives its own and every ancestor's `opacity`. */
export declare function opacityOf(element: Element): number;
export type TextContrast = {
    status: 'exempt';
    reason: 'no-text' | 'hidden' | 'disabled';
} | {
    status: 'unmeasurable';
    reason: 'photo' | 'gradient-text' | 'colour';
    detail: string;
} | {
    status: 'measured';
    /** The worst ratio across everything behind the words. */
    ratio: number;
    /** The AA floor for this size and weight: 4.5, or 3 for large text. */
    required: number;
    large: boolean;
    passes: boolean;
    /** The text colour as styled, before any fading. */
    colour: Rgba;
    /** What the words sit on: one colour, or each stop of a gradient. */
    grounds: Rgba[];
    /** The ground the text reads worst on. */
    ground: Rgba;
    /** The text as it actually paints on `ground`, fading included. */
    rendered: Rgba;
    /** Combined opacity of the element and its ancestors. */
    opacity: number;
    /** False when no text colour at all could pass — the fading is the problem. */
    fixableByColour: boolean;
};
/** Every colour the element's words could sit on, composited down to an opaque base; null over a photo. */
export declare function groundsBehind(element: HTMLElement): Rgba[] | null;
/** The worst ratio a text colour gets across `grounds`, painted at `opacity`. */
export declare function contrastOn(colour: Rgba, grounds: readonly Rgba[], opacity?: number): {
    ratio: number;
    ground: Rgba;
};
/**
 * Can the words this element itself holds be read where they sit? WCAG 1.4.3:
 * measured against what is really painted behind them — every stop of a
 * gradient, every translucent layer — with the element's and its ancestors'
 * opacity applied to both. Disabled controls are exempt, as the standard says.
 */
export declare function readTextContrast(element: HTMLElement): TextContrast;
/** Whether an image is described, deliberately decorative, or neither. */
export declare function imageAlternative(image: HTMLImageElement): 'described' | 'decorative' | 'missing';
/** An approximation of the accessible name (accname 1.2): enough to tell a named control from an unnamed one. */
export declare function accessibleName(element: HTMLElement): string;
export declare const INTERACTIVE_SELECTOR = "a[href], button, input:not([type=\"hidden\"]), select, textarea, summary, [role=\"button\"], [role=\"link\"], [role=\"checkbox\"], [role=\"radio\"], [role=\"switch\"], [role=\"tab\"], [role=\"menuitem\"], [onclick]";
/** The inline exception: a link in a sentence, sized by the line of text around it. */
export declare function isInlineTarget(element: HTMLElement): boolean;
export type UndersizedTarget = {
    element: HTMLElement;
    width: number;
    height: number;
};
/**
 * Targets under 24×24 that no exception covers. WCAG 2.5.8's spacing
 * exception lets an undersized target pass when a 24px circle centred on it
 * touches no other target and no other undersized target's circle — without
 * it every ordinary icon row reads as a pile of failures.
 */
export declare function undersizedTargets(elements: readonly HTMLElement[]): UndersizedTarget[];
//# sourceMappingURL=a11y.d.ts.map