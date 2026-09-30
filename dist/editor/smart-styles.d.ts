/**
 * Smart Quick Edits: style edits that read the page first.
 *
 * A preset puts the same shadow on every site. These look at the page the way
 * a designer would — the colour actually behind the element, the site's own
 * brand colour, the other elements of its kind — and work the value out:
 * a text colour that passes WCAG on *this* background, glass tuned to what's
 * behind it, a gradient and a glow in *this* site's colour, a size that scales
 * from phone to desktop, the corners and padding its look-alikes use.
 *
 * All of it runs on this device. The page is read once, when an edit is asked
 * for (readSmartContext); everything after that is pure, so it's tested in Node.
 */
import type { FroamMutationDomain, FroamPageContext } from '../project/mutation';
type Rgba = {
    r: number;
    g: number;
    b: number;
    a: number;
};
export type SmartEditId = 'contrast' | 'fluid' | 'glass' | 'gradient' | 'glow' | 'balance' | 'match' | 'brand' | 'pop';
export type SmartChange = {
    domain: FroamMutationDomain;
    property: string;
    value: string;
};
/** What to change, and in plain words why — the preview shows the note. No changes means there was nothing to do, and the note says why. */
export type SmartEdit = {
    id: SmartEditId;
    changes: SmartChange[];
    note: string;
};
export type SmartSubject = {
    visual: Record<string, unknown>;
    layout: Record<string, unknown>;
    tag?: string;
    page?: FroamPageContext;
};
/**
 * The nearest colour of the same hue that reaches `target` against `ground`:
 * as close to the original as the target allows, so a brand colour stays
 * recognisably itself. Checked after rounding to hex, as it will be written.
 */
export declare function readableShade(color: Rgba, ground: Rgba, target: number): Rgba;
export declare function smartEditFor(intent: string): SmartEditId | null;
/**
 * The smart edit an instruction asks for, worked out for this element on this
 * page — or null when it isn't one. `take` is Quick Edit's Try again: each
 * take is a different, still page-derived variation (another hue pairing, a
 * softer or stronger glow, lighter or heavier frost), not the same result twice.
 */
export declare function smartStyleEdit(intent: string, subject: SmartSubject, take?: number): SmartEdit | null;
/** Everything the smart edits need about the page around `element`, read once. */
export declare function readSmartContext(element: HTMLElement, root: HTMLElement): FroamPageContext;
export {};
//# sourceMappingURL=smart-styles.d.ts.map