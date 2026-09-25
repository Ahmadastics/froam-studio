import { type Dispatch, type SetStateAction } from 'react';
import type { FroamToolMode, LayerNode, SelectionState } from './types';
import { type CaretTarget } from './writing';
type Ref<T> = {
    current: T;
};
type Setter<T> = Dispatch<SetStateAction<T>>;
export type CanvasPointerOptions = {
    showPanel: boolean;
    routeKey: string;
    viewportStoreKey: string;
    inlineEditing: boolean;
    showToast: (message: string) => void;
    startWriting: (target: HTMLElement, caret?: CaretTarget) => void;
    updateSelectionsState: (next: SelectionState[]) => void;
    activeToolRef: Ref<FroamToolMode>;
    currentHoverRef: Ref<HTMLElement | null>;
    currentSelectionRef: Ref<HTMLElement | null>;
    lastClickPointRef: Ref<{
        x: number;
        y: number;
    } | null>;
    panelOpenRef: Ref<boolean>;
    selectionRef: Ref<SelectionState | null>;
    selectionsRef: Ref<SelectionState[]>;
    setActive: Setter<boolean>;
    setClickPulse: Setter<{
        key: number;
        x: number;
        y: number;
        rect: DOMRect;
    } | null>;
    setCommandPaletteOpen: Setter<boolean>;
    setContextMenuPos: Setter<{
        x: number;
        y: number;
    } | null>;
    setInlineEditing: Setter<boolean>;
    setMeasureRect: Setter<DOMRect | null>;
    setPanelOpen: Setter<boolean>;
    setQuickChatOpen: Setter<boolean>;
    setSelectionCandidates: Setter<LayerNode[]>;
};
/**
 * Pointer input on the page while editing: hover, click to select (Shift adds,
 * Alt cycles through what's beneath), a second click or double-click to write,
 * right-click and long-press for the context menu — and the guards that stop
 * the page from acting on the input itself (focus, native drags, disabled
 * controls, middle-click link opening).
 */
export declare function useCanvasPointer(options: CanvasPointerOptions): void;
export {};
//# sourceMappingURL=useCanvasPointer.d.ts.map