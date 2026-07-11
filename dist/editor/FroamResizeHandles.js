import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useCallback, useEffect, useRef, useState } from 'react';
const HANDLE_SIZE = 8;
const EDGE_SIZE = 6;
const CURSORS = {
    n: 'ns-resize',
    ne: 'nesw-resize',
    e: 'ew-resize',
    se: 'nwse-resize',
    s: 'ns-resize',
    sw: 'nesw-resize',
    w: 'ew-resize',
    nw: 'nwse-resize',
};
function getHandlePositions(rect) {
    const { left: l, top: t, width: w, height: h } = rect;
    const half = HANDLE_SIZE / 2;
    return {
        nw: { x: l - half, y: t - half },
        n: { x: l + w / 2 - half, y: t - half },
        ne: { x: l + w - half, y: t - half },
        e: { x: l + w - half, y: t + h / 2 - half },
        se: { x: l + w - half, y: t + h - half },
        s: { x: l + w / 2 - half, y: t + h - half },
        sw: { x: l - half, y: t + h - half },
        w: { x: l - half, y: t + h / 2 - half },
    };
}
function getEdgeSegments(rect) {
    const { left: l, top: t, width: w, height: h } = rect;
    const edgeHalf = EDGE_SIZE / 2;
    const inset = HANDLE_SIZE + 4;
    return [
        // top edge
        { dir: 'n', x: l + inset, y: t - edgeHalf, w: w - inset * 2, h: EDGE_SIZE, cursor: 'ns-resize' },
        // right edge
        { dir: 'e', x: l + w - edgeHalf, y: t + inset, w: EDGE_SIZE, h: h - inset * 2, cursor: 'ew-resize' },
        // bottom edge
        { dir: 's', x: l + inset, y: t + h - edgeHalf, w: w - inset * 2, h: EDGE_SIZE, cursor: 'ns-resize' },
        // left edge
        { dir: 'w', x: l - edgeHalf, y: t + inset, w: EDGE_SIZE, h: h - inset * 2, cursor: 'ew-resize' },
    ];
}
export default function FroamResizeHandles({ targetRect, onResizeStart, onResize, onResizeEnd, visible }) {
    const dragRef = useRef(null);
    const [activeCursor, setActiveCursor] = useState(null);
    const emitResize = useCallback((clientX, clientY, preserveAspectRatio, resizeFromCenter) => {
        if (!dragRef.current)
            return;
        const { direction, startX, startY } = dragRef.current;
        const dx = clientX - startX;
        const dy = clientY - startY;
        let deltaWidth = 0;
        let deltaHeight = 0;
        let deltaX = 0;
        let deltaY = 0;
        if (direction.includes('e'))
            deltaWidth = dx;
        if (direction.includes('w')) {
            deltaWidth = -dx;
            deltaX = dx;
        }
        if (direction === 's' || direction === 'se' || direction === 'sw')
            deltaHeight = dy;
        if (direction === 'n' || direction === 'ne' || direction === 'nw') {
            deltaHeight = -dy;
            deltaY = dy;
        }
        onResize({
            direction,
            deltaWidth,
            deltaHeight,
            deltaX,
            deltaY,
            preserveAspectRatio,
            resizeFromCenter,
        });
    }, [onResize]);
    const finishResize = useCallback(() => {
        if (!dragRef.current)
            return;
        dragRef.current = null;
        setActiveCursor(null);
        onResizeEnd?.();
    }, [onResizeEnd]);
    const handlePointerDown = useCallback((dir, e) => {
        e.preventDefault();
        e.stopPropagation();
        dragRef.current = { direction: dir, startX: e.clientX, startY: e.clientY };
        setActiveCursor(CURSORS[dir]);
        onResizeStart?.();
        e.target.setPointerCapture(e.pointerId);
    }, [onResizeStart]);
    const handlePointerMove = useCallback((e) => {
        if (!dragRef.current)
            return;
        e.preventDefault();
        emitResize(e.clientX, e.clientY, e.shiftKey, e.altKey);
    }, [emitResize]);
    const handlePointerUp = useCallback((e) => {
        if (!dragRef.current)
            return;
        if (e.target.hasPointerCapture(e.pointerId)) {
            ;
            e.target.releasePointerCapture(e.pointerId);
        }
        finishResize();
    }, [finishResize]);
    // Apply cursor override while dragging
    useEffect(() => {
        if (!activeCursor)
            return;
        const handleWindowMove = (event) => {
            emitResize(event.clientX, event.clientY, event.shiftKey, event.altKey);
        };
        const handleWindowEnd = () => finishResize();
        document.body.style.cursor = activeCursor;
        document.body.style.userSelect = 'none';
        window.addEventListener('pointermove', handleWindowMove);
        window.addEventListener('pointerup', handleWindowEnd);
        window.addEventListener('pointercancel', handleWindowEnd);
        window.addEventListener('blur', handleWindowEnd);
        return () => {
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            window.removeEventListener('pointermove', handleWindowMove);
            window.removeEventListener('pointerup', handleWindowEnd);
            window.removeEventListener('pointercancel', handleWindowEnd);
            window.removeEventListener('blur', handleWindowEnd);
        };
    }, [activeCursor, emitResize, finishResize]);
    if (!visible || !targetRect)
        return null;
    const handles = getHandlePositions(targetRect);
    const edges = getEdgeSegments(targetRect);
    return (_jsxs(_Fragment, { children: [edges.map((edge) => (_jsx("div", { className: "froam-resize-edge", "data-chef-editor-root": "true", style: {
                    position: 'fixed',
                    left: edge.x,
                    top: edge.y,
                    width: edge.w,
                    height: edge.h,
                    cursor: edge.cursor,
                    zIndex: 1305,
                }, onPointerDown: (e) => handlePointerDown(edge.dir, e), onPointerMove: handlePointerMove, onPointerUp: handlePointerUp, onPointerCancel: handlePointerUp }, edge.dir))), Object.entries(handles).map(([dir, pos]) => (_jsx("div", { className: `froam-resize-handle froam-resize-handle--${dir}`, "data-chef-editor-root": "true", style: {
                    position: 'fixed',
                    left: pos.x,
                    top: pos.y,
                    width: HANDLE_SIZE,
                    height: HANDLE_SIZE,
                    cursor: CURSORS[dir],
                    zIndex: 1306,
                }, onPointerDown: (e) => handlePointerDown(dir, e), onPointerMove: handlePointerMove, onPointerUp: handlePointerUp, onPointerCancel: handlePointerUp }, dir))), _jsx("div", { className: "froam-selection-outline", "data-chef-editor-root": "true", style: {
                    position: 'fixed',
                    left: targetRect.left - 1,
                    top: targetRect.top - 1,
                    width: targetRect.width + 2,
                    height: targetRect.height + 2,
                    zIndex: 1304,
                    pointerEvents: 'none',
                } }), _jsxs("div", { className: "froam-resize-size-badge", "data-chef-editor-root": "true", style: {
                    position: 'fixed',
                    left: Math.max(8, targetRect.left + targetRect.width / 2),
                    top: Math.min(window.innerHeight - 34, targetRect.bottom + 10),
                    zIndex: 1307,
                    pointerEvents: 'none',
                }, children: [Math.round(targetRect.width), " \u00D7 ", Math.round(targetRect.height)] })] }));
}
//# sourceMappingURL=FroamResizeHandles.js.map