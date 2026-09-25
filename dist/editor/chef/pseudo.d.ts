import type { ElementDraft } from './types';
/**
 * ::before and ::after — the badges, quote marks, icons and "New" labels a
 * site draws with CSS `content`. A pseudo-element has no node and no inline
 * style, so its edits live on the host's draft as state-encoded keys,
 *
 *   `__froamState:before:content`, `__froamState:after:color`, …
 *
 * the same shape hover/focus/active styles use. Generated CSS compiles them to
 * `selector::before { … }`; in the editor, paintPseudoElements() does the same
 * with a stylesheet keyed by a stamped attribute.
 */
export type PseudoElement = 'before' | 'after';
export declare const PSEUDO_ELEMENTS: readonly PseudoElement[];
export declare const PSEUDO_HOST_ATTR = "data-froam-pseudo";
export declare function pseudoKey(pseudo: PseudoElement, property: string): string;
/** This pseudo-element's edits in a draft, as `{ property: value }`. */
export declare function pseudoStyles(styles: Record<string, string> | undefined, pseudo: PseudoElement): Record<string, string>;
/**
 * Plain text → a CSS `content` value. Keywords, functions and strings someone
 * typed with quotes pass through; everything else becomes a CSS string. Braces
 * and `<` are escaped so the value can never end a rule or a <style> element.
 */
export declare function encodePseudoContent(text: string): string;
/** A CSS `content` value → the text a person would type to get it. */
export declare function decodePseudoContent(value: string | undefined): string;
/**
 * Shows this route's ::before/::after edits in the editor. Hosts are stamped
 * with their path so one stylesheet can address them; stamps and rules are
 * only rewritten when they change (the page's observers see every write).
 */
export declare function paintPseudoElements(root: HTMLElement, routeDrafts: Record<string, ElementDraft>): void;
export declare function clearPseudoPaint(): void;
//# sourceMappingURL=pseudo.d.ts.map