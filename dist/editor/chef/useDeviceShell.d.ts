import { type Dispatch, type SetStateAction } from 'react';
import { type EditorStore, type SelectionState, type ViewportMode } from './types';
type Ref<T> = {
    current: T;
};
type Setter<T> = Dispatch<SetStateAction<T>>;
export type UseDeviceShellOptions = {
    routeKey: string;
    store: EditorStore;
    viewportMode: ViewportMode;
    zoom: number;
    currentSelectionRef: Ref<HTMLElement | null>;
    setPanelPosition: Setter<{
        x: number;
        y: number;
    } | null>;
    setSelection: Setter<SelectionState | null>;
};
/**
 * Tablet and mobile preview: the page's root is sized to the device width (so
 * its own media queries fire), fixed in a scaled frame with a decorative bezel,
 * and the drafts for that viewport are painted. Desktop puts everything back.
 * Returns the viewport the page was last laid out for.
 */
export declare function useDeviceShell({ routeKey, store, viewportMode, zoom, currentSelectionRef, setPanelPosition, setSelection }: UseDeviceShellOptions): import("react").RefObject<"desktop" | "tablet" | "mobile">;
export {};
//# sourceMappingURL=useDeviceShell.d.ts.map