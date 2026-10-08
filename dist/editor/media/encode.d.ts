import type { CropRect } from '../image-fit';
export type EncodedImage = {
    blob: Blob;
    width: number;
    height: number;
};
/**
 * Cut `rect` out of an image file and encode it once per width.
 *
 * Decoding, cropping and resizing happen inside createImageBitmap — off the
 * main thread in Chromium — and encoding in convertToBlob, also async, so
 * placing a 12-megapixel photo no longer freezes the page. Widths are done
 * one at a time to keep memory flat.
 */
export declare function bakeCrop(blob: Blob, rect: CropRect, widths: number[], mayHaveAlpha: boolean): Promise<EncodedImage[]>;
/** A data URL for one blob — only where there is no bridge to keep files. */
export declare function blobToDataUrl(blob: Blob): Promise<string>;
/**
 * A video's still for `poster`: shown before it plays, while it loads, and
 * instead of it for people who asked for less motion. Null when the video's
 * pixels can't be read (another site's, without permission).
 */
export declare function capturePoster(videoUrl: string, maxEdge?: number): Promise<Blob | null>;
//# sourceMappingURL=encode.d.ts.map