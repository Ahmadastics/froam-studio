/**
 * Froam Design Intelligence — token engine.
 *
 * Reads the host app's REAL design tokens straight from its live
 * stylesheets (the actual --red-500, --space-md, etc. the running app
 * uses), and provides colour maths for the accessibility + design-lint
 * features. This is only possible because Froam edits the live app, not
 * a static mock — the tokens are the truth, not a copy.
 */
import { contrastRatio, luminance, parseColor, toHex } from '../project/wcag';
export type TokenKind = 'color' | 'space' | 'radius' | 'shadow' | 'type' | 'font' | 'other';
export type DesignToken = {
    name: string;
    value: string;
    raw: string;
    kind: TokenKind;
    ramp: string;
    rgb?: RGB;
};
export type RGB = {
    r: number;
    g: number;
    b: number;
    a: number;
};
export type TokenGroups = {
    colorRamps: {
        ramp: string;
        tokens: DesignToken[];
    }[];
    spacing: DesignToken[];
    radius: DesignToken[];
    shadow: DesignToken[];
    all: DesignToken[];
};
export { parseColor, luminance, contrastRatio, toHex };
export declare function colorDistance(a: RGB, b: RGB): number;
export declare function readDesignTokens(force?: boolean): TokenGroups;
/** Nearest solid brand colour token to an arbitrary colour. */
export declare function nearestColorToken(rgb: RGB, tokens: DesignToken[]): {
    token: DesignToken;
    distance: number;
} | null;
//# sourceMappingURL=froamDesignTokens.d.ts.map