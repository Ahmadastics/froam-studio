/**
 * Look Studio's recipes: 289 styles and what each one does. Loaded the first
 * time Styles is opened — most sessions never open it, and they shouldn't
 * download it with the editor.
 */
import type { CSSProperties } from 'react';
type SelectionPatch = Record<string, string | number>;
export declare const LOOK_GROUPS: readonly ["Alive", "Signature", "Photo", "World", "Now", "Accent", "Surface", "Depth", "Shape", "Line", "Type", "Pattern", "Vibe", "Reset"];
export type LookGroup = (typeof LOOK_GROUPS)[number];
/**
 * What Styles calls each group. The ids above are stored nowhere but read by
 * tests and saved styles, so they stay; these are the words people navigate by.
 */
export declare const LOOK_GROUP_LABELS: Record<LookGroup, string>;
/** One line under each section heading: what you'd come to it for. */
export declare const LOOK_GROUP_HINTS: Record<LookGroup, string>;
/** The rail in Styles: groups gathered by the question you're asking. */
export declare const LOOK_SHELVES: readonly {
    title: string;
    groups: readonly LookGroup[];
}[];
export type Look = {
    name: string;
    group: LookGroup;
    swatch: CSSProperties;
    styles: (accent: string) => Record<string, string>;
    /**
     * On words (a heading, a paragraph): a recipe written for text, applied as
     * it is — or null when the look only makes sense on a box, and Styles hides
     * it for text. Left out, the box recipe is translated for text.
     */
    text?: ((accent: string) => Record<string, string>) | null;
    patch?: SelectionPatch;
};
export type LookOverrides = {
    accent?: string;
    fill?: string;
    text?: string;
    radius?: number;
    overrideFill?: boolean;
    overrideText?: boolean;
    overrideRadius?: boolean;
};
export declare const LOOKS: Look[];
export declare const LOOK_NOTES: Record<string, string>;
export {};
//# sourceMappingURL=floating-bar-looks.d.ts.map