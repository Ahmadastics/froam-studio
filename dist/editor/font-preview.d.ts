/** The CSS font-family that draws a preview of `family`. */
export declare function previewFamily(family: string, fallback?: string): string;
export declare function isPreviewLoaded(family: string): boolean;
/** Called after any batch of previews lands, so rows can re-render. */
export declare function onPreviewsLoaded(listener: () => void): () => void;
/**
 * Queue a preview of `family` that can draw `text`. Unknown families
 * (system stacks, brand fonts already on the page) are ignored.
 */
export declare function requestPreview(family: string, text: string): void;
//# sourceMappingURL=font-preview.d.ts.map