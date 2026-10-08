export declare const INLINE_KEEP_BELOW = 2048;
export declare function inlineMediaIn(value: unknown): string[];
/**
 * `value` with every large inline picture replaced by what `keep` returns for
 * it (a media reference). Null when there was nothing to move. A picture that
 * can't be kept stays inline — moving is an optimisation, never a loss.
 */
export declare function moveInlineMedia<T>(value: T, keep: (blob: Blob) => Promise<string>, known?: Map<string, string>): Promise<T | null>;
//# sourceMappingURL=migrate-inline.d.ts.map