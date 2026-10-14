/**
 * Froam effects — interactive styles that answer the cursor, the scroll and
 * the passing of time: tilt, magnetic pull, spotlight, reveals, parallax,
 * kinetic text, marquees, hover craft.
 *
 * An effect is a style like any other, `--froam-fx-<id>: <params>` (for
 * example `--froam-fx-tilt: max:12 glare:0.3`), so it is saved, merged
 * between devices, undone, cascaded by screen size (`none` at Mobile turns
 * one off on phones) and shipped exactly as colours are. This engine reads
 * those properties off the page and brings them to life. The same code runs
 * in the editor and, inlined into froam.runtime.js (lib/codegen.mjs), on the
 * live site — so it imports nothing and touches nothing but the elements
 * that ask for it.
 *
 * Rules every effect keeps:
 *   - `prefers-reduced-motion`: nothing moves; content is shown as it is.
 *   - Cursor effects need a real cursor; on touch they stay still.
 *   - Content is never hidden from a crawler: only this script hides it, and
 *     only until it is revealed.
 *   - Whatever an effect changes it puts back when it ends. In the editor
 *     ("preview"), effects that rewrite text or structure play once and
 *     restore, so editing and saving never see the split-up version.
 */
export type FxFamily = 'pointer' | 'scroll' | 'text' | 'craft' | 'ambient';
export type FxParam = {
    key: string;
    label: string;
    kind: 'number' | 'choice' | 'color';
    default: number | string;
    min?: number;
    max?: number;
    step?: number;
    unit?: string;
    options?: readonly string[];
};
export type FxSpec = {
    id: string;
    family: FxFamily;
    label: string;
    description: string;
    params: readonly FxParam[];
    /** Runs once an element is in view, rather than continuously. */
    oneShot?: boolean;
    /** Rewrites the element's text or children while it runs. */
    rewrites?: boolean;
    /** Meant for words: offered on text. */
    text?: boolean;
};
export declare const FX_PREFIX = "--froam-fx-";
export declare const FX_CATALOG: readonly FxSpec[];
export declare const fxSpec: (id: string) => FxSpec;
export type FxParams = Record<string, string | number>;
/** `max:12 glare:0.3` → { max: 12, glare: 0.3 }, filled in with defaults. `none` or nothing → null. */
export declare function parseFx(id: string, raw: string | null | undefined): FxParams | null;
/** The value to store: only what differs from the defaults, or `on`. */
export declare function formatFx(id: string, params?: FxParams): string;
export type FroamFx = {
    /** Read every element's effects again (after the editor paints, the page changes, the size changes). */
    refresh: () => void;
    /** Play an element's one-shot effects again, from the start. */
    replay: (element: Element) => void;
    /** The editor is open: rewriting effects play once and restore. */
    setPreview: (on: boolean) => void;
    destroy: () => void;
};
export declare function installFroamFx(win: Window & typeof globalThis): FroamFx;
//# sourceMappingURL=engine.d.ts.map