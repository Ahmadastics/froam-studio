/**
 * Look Studio's recipes: 253 styles and what each one does. Loaded the first
 * time Styles is opened — most sessions never open it, and they shouldn't
 * download it with the editor.
 */
import type { CSSProperties } from 'react';
type SelectionPatch = Record<string, string | number>;
export declare const LOOK_GROUPS: readonly ["Alive", "Signature", "Photo", "Accent", "Surface", "Depth", "Shape", "Line", "Type", "Pattern", "Vibe", "Reset"];
export type LookGroup = (typeof LOOK_GROUPS)[number];
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