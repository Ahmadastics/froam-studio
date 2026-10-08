import { type MediaContext } from './media-refs';
/** Put back what the page itself had. Returns false when Froam never touched it. */
export declare function restorePageMedia(element: HTMLElement): boolean;
/** Whether `url` is what the page itself showed here before any edit. */
export declare function isPageMedia(element: HTMLElement, url: string | undefined): boolean;
/**
 * Apply `imageUrl` + the media draft to an <img> or <video>. Anything else is
 * a background and is handled by its styles. Returns whether it did anything.
 */
export declare function applyMediaSource(element: HTMLElement, imageUrl: string | undefined, mediaValue: string | undefined, context: MediaContext): boolean;
/** An <img>'s own src as a design would store it: ours as a reference, the page's as it was. */
export declare function readImageSource(element: HTMLImageElement): string;
//# sourceMappingURL=apply-media.d.ts.map