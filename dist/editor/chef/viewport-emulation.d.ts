/**
 * Make the page believe it's on a phone or tablet — without leaving the page.
 *
 * The browser evaluates CSS media queries, viewport units and matchMedia()
 * against the real window, so a 390px-wide frame on a 1440px screen still
 * gets the desktop layout. While a device preview is on, this answers those
 * questions for the device instead:
 *
 * - every @media rule (and <link media>, <style media>, @import media) that
 *   asks about width, height, aspect ratio, orientation, hover or pointer is
 *   evaluated for the device and switched to `all` or `not all`;
 * - vw / vh (and dvh, svh, lvh, vmin, vmax) in the page's rules become the
 *   device's pixels;
 * - window.matchMedia() answers width/height/hover/pointer queries for the
 *   device, so a script's "is this mobile?" agrees with its CSS.
 *
 * Froam's own styles are left alone — the editor around the preview keeps
 * its real layout — and everything is put back exactly on restore.
 */
export type EmulatedViewport = {
    width: number;
    height: number;
    touch: boolean;
};
/** The browser's own matchMedia — what the editor uses for its own layout, preview or not. */
export declare function nativeMatchMedia(query: string): MediaQueryList | null;
/** A list's real answer, even while a preview answers for the device. */
export declare function nativeMediaMatches(list: MediaQueryList | null | undefined): boolean;
/** Whether a media query depends on the viewport (and so needs the device's answer). */
export declare function isViewportQuery(text: string): boolean;
/**
 * One feature, without its parentheses. `undefined`: not a viewport feature
 * (the browser answers it); `null`: a viewport feature we can't read.
 */
export declare function evaluateFeature(expression: string, size: EmulatedViewport): boolean | null | undefined;
/** A whole media list for the device: `null` when it can't be read (then it's left alone). */
export declare function evaluateMediaList(text: string, size: EmulatedViewport): boolean | null;
/** "100vh" → "844px" for the device; anything without viewport units comes back unchanged. */
export declare function resolveViewportUnits(value: string, size: EmulatedViewport): string;
/** Answer as the device would, until restoreViewport(). Calling again changes the device. */
export declare function emulateViewport(size: EmulatedViewport): void;
/** Back to the real window: every rule, unit and list as it was. */
export declare function restoreViewport(): void;
/** The window's own scroll, preview or not. */
export declare function nativeWindowScroll(): {
    x: number;
    y: number;
};
export declare function emulateScroll(target: HTMLElement): void;
export declare function restoreScroll(): void;
//# sourceMappingURL=viewport-emulation.d.ts.map