type HandleDirection = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw';
type ResizePayload = {
    direction: HandleDirection;
    deltaWidth: number;
    deltaHeight: number;
    deltaX: number;
    deltaY: number;
    preserveAspectRatio: boolean;
    resizeFromCenter: boolean;
};
type Props = {
    targetRect: DOMRect | null;
    onResizeStart?: () => void;
    onResize: (payload: ResizePayload) => void;
    onResizeEnd?: () => void;
    visible: boolean;
};
export default function FroamResizeHandles({ targetRect, onResizeStart, onResize, onResizeEnd, visible }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=FroamResizeHandles.d.ts.map