import { type FitSize, type ImageFitState } from './image-fit';
import { type MediaPlayback } from './media/media-draft';
export type ImageFitRequest = {
    id: number;
    /** What the dialog shows: the original, from the bridge or an object URL. */
    previewUrl: string;
    kind: 'image' | 'video';
    /**
     * baked: the crop is cut into a new, smaller file (a still photo whose
     * pixels can be read). live: the file is shown as it is and CSS crops it
     * (a GIF, an SVG, a video, a picture another site won't share).
     */
    method: 'baked' | 'live';
    /** Whether zoom can be shown on the page for this target (see liveFitStyles). */
    zoomable: boolean;
    /** The slot it is going into, in CSS pixels; null when it has no size yet. */
    frame: FitSize | null;
    initial?: ImageFitState;
    /** A fresh upload: cancelling means it is not placed at all. */
    isUpload: boolean;
    playback?: MediaPlayback;
    /** Size of the file, for a warning when a video is heavy for a web page. */
    bytes?: number;
    /** Something to tell the person before they place it. */
    note?: string;
    /** An SVG: it draws sharp at any size, so it is never "too small". */
    vector?: boolean;
};
export type ImageFitChoice = {
    state: ImageFitState;
    /** The original's own pixel size, as the browser decoded it. */
    natural: FitSize;
    playback?: MediaPlayback;
};
type Props = {
    request: ImageFitRequest | null;
    /** Do the placing. The dialog stays open, showing progress, until this settles; a rejection's message is shown. */
    onApply: (choice: ImageFitChoice) => Promise<void>;
    onCancel: () => void;
};
export declare function rememberImageFit(url: string, blob: Blob, state: ImageFitState): void;
export declare function recallImageFit(url: string): {
    blob: Blob;
    state: ImageFitState;
} | null;
/** Formats a browser can't redraw without losing something: a GIF's motion, an SVG's sharpness. */
export declare function isAnimatedOrVector(typeOrUrl: string): boolean;
export default function FroamImageFit({ request, onApply, onCancel }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamImageFit.d.ts.map