import { type Dispatch, type SetStateAction } from 'react';
import type { DeviceFrame, DeviceSize } from './device-sizes';
import { type EditorStore, type SelectionState, type ViewportMode } from './types';
type Ref<T> = {
    current: T;
};
type Setter<T> = Dispatch<SetStateAction<T>>;
export type UseDeviceShellOptions = {
    routeKey: string;
    store: EditorStore;
    viewportMode: ViewportMode;
    /** The screen to preview; null on desktop. */
    deviceSize: DeviceSize | null;
    zoom: number;
    currentSelectionRef: Ref<HTMLElement | null>;
    setPanelPosition: Setter<{
        x: number;
        y: number;
    } | null>;
    setSelection: Setter<SelectionState | null>;
    onFrame?: (frame: DeviceFrame | null) => void;
};
/**
 * Tablet and phone preview. The page is put on a device-sized screen, scaled
 * to fit the canvas, and — the part that matters — told it's on that device:
 * its media queries, viewport units and matchMedia() answer for the device
 * (viewport-emulation.ts), so a responsive site shows its real phone layout.
 *
 * The screen is a frame with a scroller inside it: sticky headers stick to the
 * top of the phone, fixed bars stay put while the page scrolls, the way they
 * do on the device. On a plain page the whole of <body> goes on the screen —
 * header and footer too; an app mounted in #root puts #root there; a document
 * React draws itself (Next's app router) is framed where it stands, since
 * moving React's nodes would break it. Desktop puts everything back.
 */
export declare function useDeviceShell({ routeKey, store, viewportMode, deviceSize, zoom, currentSelectionRef, setPanelPosition, setSelection, onFrame }: UseDeviceShellOptions): import("react").RefObject<"desktop" | "tablet" | "mobile">;
export {};
//# sourceMappingURL=useDeviceShell.d.ts.map