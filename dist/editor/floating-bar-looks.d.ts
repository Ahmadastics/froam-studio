/**
 * Look Studio's recipes: 205 styles and what each one does. Loaded the first
 * time Styles is opened — most sessions never open it, and they shouldn't
 * download it with the editor.
 */
import type { CSSProperties } from 'react';
type SelectionPatch = Record<string, string | number>;
export declare const LOOK_GROUPS: readonly ["Accent", "Surface", "Depth", "Shape", "Line", "Type", "Pattern", "Vibe", "Reset"];
export type LookGroup = (typeof LOOK_GROUPS)[number];
export type Look = {
    name: string;
    group: LookGroup;
    swatch: CSSProperties;
    styles: (accent: string) => Record<string, string>;
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