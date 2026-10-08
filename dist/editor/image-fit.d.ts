/**
 * Fitting an image to the place it is going.
 *
 * A photo rarely has the shape of the slot it lands in: a portrait shot in a
 * landscape card, a wide banner in a square tile. Left alone, `cover` crops
 * it around the middle (heads go missing) and an <img> sized by its own
 * pixels reflows the page around the new shape. Here the person picks the
 * crop — where, how close, what shape — and it is baked into a new image of
 * exactly that shape, sized for the slot rather than for the camera.
 *
 * Pure geometry, no DOM: it runs under node in the tests.
 */
export type ImageFitMode = 'fill' | 'fit';
export type ImageFitAspect = 'frame' | 'original' | '1:1' | '4:3' | '3:2' | '16:9' | '4:5' | '3:4';
export type ImageFitState = {
    /** fill: crop to the shape · fit: show the whole image inside it. */
    mode: ImageFitMode;
    aspect: ImageFitAspect;
    /** 1 = the largest crop of this shape the image allows. */
    zoom: number;
    /** Centre of the crop, as a fraction of the image (0–1). */
    x: number;
    y: number;
};
export type FitSize = {
    width: number;
    height: number;
};
export type CropRect = {
    sx: number;
    sy: number;
    sw: number;
    sh: number;
};
export declare const IMAGE_FIT_ASPECTS: {
    id: ImageFitAspect;
    label: string;
    title: string;
}[];
export declare const DEFAULT_IMAGE_FIT: ImageFitState;
export declare const MAX_IMAGE_FIT_ZOOM = 5;
/** Never bake an edge longer than this: the design file carries every pixel. */
export declare const MAX_OUTPUT_EDGE = 2560;
/**
 * Keep at least this much when the source has it. The slot may be fitted in
 * the phone preview and then shown full-width on a desktop.
 */
export declare const MIN_OUTPUT_EDGE = 1600;
export declare function isUsableSize(size: FitSize | null | undefined): size is FitSize;
/** Width over height of the chosen shape. An unmeasurable frame falls back to the image's own shape. */
export declare function resolveAspectRatio(aspect: ImageFitAspect, frame: FitSize | null, image: FitSize): number;
/** The CSS `aspect-ratio` that gives the element its new shape — none when it keeps the shape it has. */
export declare function aspectRatioCss(aspect: ImageFitAspect, image: FitSize): string | null;
/** The part of the image that shows, in image pixels. Always inside the image. */
export declare function cropRect(image: FitSize, ratio: number, state: Pick<ImageFitState, 'zoom' | 'x' | 'y'>): CropRect;
/** The same state, with zoom in range and the crop pulled back inside the image. */
export declare function clampFitState(image: FitSize, ratio: number, state: ImageFitState): ImageFitState;
/** Drag the picture by (dx, dy) screen pixels in a preview `viewWidth` wide: it follows the pointer. */
export declare function panFit(image: FitSize, ratio: number, state: ImageFitState, dx: number, dy: number, viewWidth: number): ImageFitState;
/**
 * Zoom to `nextZoom`, keeping the image point under (px, py) — a fraction of
 * the preview, 0.5/0.5 being its middle — where it is.
 */
export declare function zoomFitAt(image: FitSize, ratio: number, state: ImageFitState, nextZoom: number, px?: number, py?: number): ImageFitState;
/** The pixels of the source the result is made from: the crop, or the whole image when fitting. */
export declare function sourceRect(image: FitSize, ratio: number, state: ImageFitState): CropRect;
/**
 * The size of the slot once the shape is applied. The element keeps its
 * width; a new shape changes its height.
 */
export declare function slotSize(frame: FitSize | null, aspect: ImageFitAspect, ratio: number): FitSize | null;
/**
 * Baked size: twice the slot (sharp on retina), at least MIN_OUTPUT_EDGE on
 * the long edge, at most MAX_OUTPUT_EDGE — and never more pixels than the
 * source has. Upscaling only adds bytes.
 */
export declare function outputSize(source: FitSize, slot: FitSize | null): FitSize;
/**
 * How many screen pixels each source pixel is stretched over in the slot.
 * Above 1 the image is being enlarged and will look soft.
 */
export declare function enlargement(image: FitSize, ratio: number, state: ImageFitState, slot: FitSize | null): number;
/**
 * Widths to bake for an <img>'s `srcset`: the slot at 1×, 1.5× and 2× (a
 * phone and a retina laptop each download what they show), plus the size
 * `outputSize` picks — never wider than the crop, near-duplicates dropped.
 */
export declare function srcsetWidths(cropWidth: number, slot: FitSize | null, largest: number): number[];
/**
 * Where a cover-fitted picture sits so its visible part is centred on (x, y):
 * the `object-position` / `background-position` percentage for one axis,
 * when the visible part is `visible` (a fraction) of the whole.
 */
export declare function positionFor(center: number, visible: number): number;
/**
 * Fitting by CSS alone: the file is shown as it is and only cropped on the
 * page. For what can't be redrawn without losing something — a GIF's motion,
 * an SVG's sharpness, a video, another site's picture.
 *
 *   element     a page's own <img>/<video>: fill/fit, position and shape.
 *               (No zoom: it would need a transform and a clip on an element
 *               whose clip-path a Look may already be using.)
 *   contained   an <img>/<video> inside a Froam frame that clips it: zoom too,
 *               by scaling around the crop's centre.
 *   background  a CSS background: zoom by background-size.
 */
export declare function liveFitStyles(options: {
    kind: 'element' | 'contained' | 'background';
    state: ImageFitState;
    image: FitSize;
    slot: FitSize | null;
    url?: string;
    aspectCss: string | null;
    isImageFrame?: boolean;
    frameRatio?: number;
}): Record<string, string>;
/** The styles that give a box a picked shape (none when it keeps its own). */
export declare function shapeStyles(aspectCss: string | null, letShrink: boolean): Record<string, string>;
/** The inline styles that make the element show the baked image the way it was previewed. */
export declare function imageFitStyles(options: {
    kind: 'img' | 'background';
    state: ImageFitState;
    url: string;
    aspectCss: string | null;
    /** A Froam image frame: its placeholder content must not hold the new shape open. */
    isImageFrame?: boolean;
    /** Width over height of the slot as measured, for an <img> that would otherwise take the new image's shape. */
    frameRatio?: number;
}): Record<string, string>;
//# sourceMappingURL=image-fit.d.ts.map