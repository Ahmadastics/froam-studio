/**
 * The editor's side of lib/media-store.mjs: put a file in the workspace and
 * get back the reference a design stores.
 *
 * Without a bridge (a hosted demo), or for someone on a share link (who may
 * suggest changes but not write files), there is nowhere to put a file:
 * `canStoreMedia()` says so and callers fall back to an inline picture.
 */
export type StoredMedia = {
    ref: string;
    /** Where the editor loads it from: the bridge. */
    url: string;
    name: string;
    bytes: number;
    type: string;
};
/** Whether a bridge that keeps media files is answering. Asked once. */
export declare function canStoreMedia(): Promise<boolean>;
/** The bridge answered, and said no: the file itself is the problem (not an image, too big). */
export declare class MediaRejected extends Error {
}
/** Keep a file in the project. The same bytes twice are one file. */
export declare function storeMedia(blob: Blob): Promise<StoredMedia>;
/**
 * Copy another site's picture or video into the project, through the bridge
 * (a browser can't read pixels a site hasn't shared). After this it can be
 * cropped like an upload.
 */
export declare function importMedia(url: string): Promise<StoredMedia>;
//# sourceMappingURL=media-store.d.ts.map