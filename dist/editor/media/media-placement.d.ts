import type { FitSize } from '../image-fit';
import { type MediaDraft } from './media-draft';
/**
 * Where a picture or video goes, decided from what is selected:
 *
 *   img         a page's <img>: its src (and srcset) change
 *   video       a page's <video>: its src, poster and playback change
 *   frame       a Froam image frame: a background picture
 *   frame-video a Froam frame holding a <video> it owns (zoomable: the frame clips)
 *   background  any other element: a background picture
 *   bg-video    any other element: a video behind its content
 *   new         nothing selected: a new frame
 */
export type MediaRole = 'img' | 'video' | 'frame' | 'frame-video' | 'background' | 'bg-video' | 'new';
export declare const VIDEO_ATTR = "data-froam-video";
export declare const BG_VIDEO_ATTR = "data-froam-bg-video";
/** On elements inside an injected block, whose drafts don't persist: the fit, carried in the block's HTML. */
export declare const MEDIA_ATTR = "data-froam-media";
export declare function isImageFrame(element: Element | null): element is HTMLElement;
export declare function ownedVideoIn(element: HTMLElement): HTMLVideoElement | null;
/** A video Froam placed belongs to its frame, or to the element it plays behind: that is what gets edited. */
export declare function mediaHostOf(element: HTMLElement | null): HTMLElement | null;
/** Where an upload of `kind` lands on `target`, or a sentence saying why it can't. */
export declare function roleFor(target: HTMLElement | null, kind: 'image' | 'video'): MediaRole | string;
/** Roles where a live (CSS) fit can also zoom: a background, or media inside a box Froam owns that clips it. */
export declare function canZoomLive(role: MediaRole): role is "frame" | "background" | "frame-video" | "bg-video" | "new";
/** The box the picture fills, in CSS pixels: an <img>/<video>'s content box, a background's padding box. */
export declare function measureSlot(target: HTMLElement | null): FitSize | null;
/** What media an element shows now, as a design would store it — for Adjust. */
export declare function currentMediaOf(target: HTMLElement, draftMedia?: string): {
    kind: 'image' | 'video';
    url: string;
    media: MediaDraft | null;
    role: MediaRole;
} | null;
/** Whether there is something to Adjust on this element. */
export declare function hasAdjustableMedia(element: HTMLElement | null): boolean;
/**
 * The <video> a frame or a background plays, made or updated in place. Its
 * attributes and inline styles are its whole state: it lives in an injected
 * block's HTML, which is what persists (references, not bridge URLs, once
 * serialized — see mediaRefsFromUrls).
 */
export declare function writeOwnedVideo(video: HTMLVideoElement, media: MediaDraft, fitStyles: Record<string, string>): void;
/** A video behind `host`'s content: an injected layer under everything else in it. */
export declare function ensureBackgroundVideo(host: HTMLElement): {
    layer: HTMLElement;
    video: HTMLVideoElement;
};
/** A frame's own video, made if it has none yet; its background picture and placeholder step aside. */
export declare function ensureFrameVideo(frame: HTMLElement): HTMLVideoElement;
/** Whether a file of this type is a still photo whose pixels can be cut (not a GIF, SVG or video). */
export declare function isBakeable(type: string): boolean;
/** A media type from a reference's or URL's extension, for files we did not upload ourselves. */
export declare function typeFromName(url: string): string;
//# sourceMappingURL=media-placement.d.ts.map