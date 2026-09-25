import { useEffect } from 'react';
import { getElementPath, isInPageScope } from '../../collab/paths.js';
import { buildSelection, getRoot } from './dom.js';
import { createHitTester } from './hit-test.js';
import { buildLayerNode, syncStructureBoundaryLabel } from './layers.js';
import { isWritableElement } from './writing.js';
/**
 * Pointer input on the page while editing: hover, click to select (Shift adds,
 * Alt cycles through what's beneath), a second click or double-click to write,
 * right-click and long-press for the context menu — and the guards that stop
 * the page from acting on the input itself (focus, native drags, disabled
 * controls, middle-click link opening).
 */
export function useCanvasPointer(options) {
    const { showPanel, routeKey, viewportStoreKey, inlineEditing, showToast, startWriting, updateSelectionsState, activeToolRef, currentHoverRef, currentSelectionRef, lastClickPointRef, panelOpenRef, selectionRef, selectionsRef, setActive, setClickPulse, setCommandPaletteOpen, setContextMenuPos, setInlineEditing, setMeasureRect, setPanelOpen, setQuickChatOpen, setSelectionCandidates, } = options;
    useEffect(() => {
        if (!showPanel)
            return;
        const root = getRoot();
        if (!root)
            return;
        const rootElement = root;
        const { resolveTarget, resolveClick, disconnect: disconnectHitTester } = createHitTester(rootElement, () => selectionRef.current?.path);
        function clearHover() {
            currentHoverRef.current?.removeAttribute('data-chef-hovered');
            currentHoverRef.current?.removeAttribute('data-froam-boundary-label');
            currentHoverRef.current?.removeAttribute('data-froam-static-boundary');
            currentHoverRef.current = null;
        }
        let hoverFrame = 0;
        function handlePointerOver(event) {
            cancelAnimationFrame(hoverFrame);
            hoverFrame = requestAnimationFrame(() => {
                const { target } = resolveClick(event);
                if (!target || target === currentSelectionRef.current)
                    return;
                if (currentHoverRef.current === target)
                    return;
                clearHover();
                currentHoverRef.current = target;
                target.setAttribute('data-chef-hovered', 'true');
                syncStructureBoundaryLabel(target);
            });
        }
        function handlePointerLeave() {
            cancelAnimationFrame(hoverFrame);
            hoverFrame = requestAnimationFrame(clearHover);
        }
        function handleClick(event) {
            // Clicks inside copy that's being written move the caret — the browser's job.
            const writing = currentSelectionRef.current;
            if (writing?.isContentEditable && event.target instanceof Node && writing.contains(event.target))
                return;
            const { target, stack } = resolveClick(event);
            if (!target) {
                if (!(event.target instanceof HTMLElement) || event.target.closest('[data-chef-editor-root="true"]'))
                    return;
                if (panelOpenRef.current) {
                    clearHover();
                    return;
                }
                setPanelOpen(false);
                setActive(false);
                setCommandPaletteOpen(false);
                return;
            }
            // Hand tool — suppress all selection; just let the page scroll/pan naturally
            if (activeToolRef.current === 'hand') {
                event.preventDefault();
                event.stopPropagation();
                return;
            }
            event.preventDefault();
            event.stopPropagation();
            // A second click on copy that's already selected means "let me write here".
            if (event.detail === 1
                && !event.shiftKey
                && !event.altKey
                && activeToolRef.current === 'pointer'
                && target === currentSelectionRef.current
                && isWritableElement(target)) {
                lastClickPointRef.current = { x: event.clientX, y: event.clientY };
                startWriting(target, { x: event.clientX, y: event.clientY });
                return;
            }
            // Exit inline editing if clicking something else
            if (inlineEditing && currentSelectionRef.current) {
                currentSelectionRef.current.contentEditable = 'false';
                setInlineEditing(false);
            }
            const path = getElementPath(target, rootElement);
            setSelectionCandidates(stack.map((element) => buildLayerNode(element, rootElement)));
            if (event.shiftKey) {
                const currentSels = selectionsRef.current;
                const isAlreadySelected = currentSels.some((sel) => sel.path === path);
                let nextSels;
                if (isAlreadySelected) {
                    nextSels = currentSels.filter((sel) => sel.path !== path);
                }
                else {
                    nextSels = [...currentSels, buildSelection(target, path)];
                }
                updateSelectionsState(nextSels);
            }
            else {
                updateSelectionsState([buildSelection(target, path)]);
            }
            // Real pointer clicks only (keyboard activation has no position). Disabled
            // controls arrive as pointerup, which reports detail 0.
            if (event.detail > 0 || event.type === 'pointerup') {
                setClickPulse({ key: window.performance.now(), x: event.clientX, y: event.clientY, rect: target.getBoundingClientRect() });
                lastClickPointRef.current = { x: event.clientX, y: event.clientY };
            }
            setMeasureRect(null);
            setContextMenuPos(null);
            // Text tool — single click writes where you clicked (no double-click required)
            if (activeToolRef.current === 'text' && isWritableElement(target)) {
                startWriting(target, { x: event.clientX, y: event.clientY });
                return;
            }
            // Left-click only selects. Quick Edit opens from an explicit user command.
        }
        function handleDblClick(event) {
            // Edit what the clicks selected (Alt-cycling included), not a re-resolution.
            const selected = currentSelectionRef.current;
            const target = selected && isInPageScope(selected, rootElement) ? selected : resolveClick(event).target;
            if (!target)
                return;
            const textTarget = target;
            // Already writing here: a double-click is the browser selecting a word.
            if (textTarget.isContentEditable)
                return;
            setQuickChatOpen(false);
            event.preventDefault();
            event.stopPropagation();
            if (!isWritableElement(textTarget)) {
                showToast('Select a text layer to edit copy');
                return;
            }
            if (textTarget.dataset.froamShape === 'true') {
                textTarget.querySelector('svg')?.setAttribute('aria-hidden', 'true');
                textTarget.style.placeItems = 'center';
                textTarget.style.textAlign = textTarget.style.textAlign || 'center';
                textTarget.style.alignContent = 'center';
                textTarget.style.justifyContent = 'center';
                textTarget.style.cursor = 'text';
            }
            startWriting(textTarget, textTarget.innerText.trim() ? { x: event.clientX, y: event.clientY, word: true } : 'end');
        }
        function handleContextMenu(event) {
            const { target } = resolveClick(event);
            if (!target)
                return;
            event.preventDefault();
            event.stopPropagation();
            const path = getElementPath(target, rootElement);
            const isAlreadySelected = selectionsRef.current.some((sel) => sel.path === path);
            if (!isAlreadySelected) {
                updateSelectionsState([buildSelection(target, path)]);
            }
            setContextMenuPos({ x: event.clientX, y: event.clientY });
        }
        /* ─── v4: long-press = right-click on touch ───
           iOS Safari never fires contextmenu for touches; Android fires it but
           we want consistent timing + haptics, so we recognize it ourselves.
           A duplicate native contextmenu just re-sets the same state. */
        const LONG_PRESS_MS = 450;
        const LONG_PRESS_SLOP = 10;
        let longPressTimer = 0;
        let longPressOrigin = null;
        let longPressFired = false;
        function cancelLongPress() {
            window.clearTimeout(longPressTimer);
            longPressOrigin = null;
        }
        function handleTouchStart(event) {
            if (event.touches.length !== 1) {
                cancelLongPress();
                return;
            }
            const touch = event.touches[0];
            const target = resolveTarget(event.target);
            if (!target)
                return;
            longPressOrigin = { x: touch.clientX, y: touch.clientY };
            longPressFired = false;
            window.clearTimeout(longPressTimer);
            longPressTimer = window.setTimeout(() => {
                longPressFired = true;
                longPressOrigin = null;
                const path = getElementPath(target, rootElement);
                if (!selectionsRef.current.some((sel) => sel.path === path)) {
                    updateSelectionsState([buildSelection(target, path)]);
                }
                setContextMenuPos({ x: touch.clientX, y: touch.clientY });
                if ('vibrate' in navigator)
                    navigator.vibrate?.(8);
            }, LONG_PRESS_MS);
        }
        function handleTouchMove(event) {
            if (!longPressOrigin)
                return;
            const touch = event.touches[0];
            if (Math.hypot(touch.clientX - longPressOrigin.x, touch.clientY - longPressOrigin.y) > LONG_PRESS_SLOP) {
                cancelLongPress();
            }
        }
        function handleTouchEnd(event) {
            cancelLongPress();
            if (longPressFired) {
                // Swallow the synthetic click so it can't immediately dismiss the menu
                if (event.cancelable)
                    event.preventDefault();
                longPressFired = false;
            }
        }
        /* ─── Page interaction guards while editing ───
           Design mode edits the page instead of using it. Browsers act on some
           controls before any click: inputs take focus and <select> opens its
           menu on mousedown, links and images start native drags, middle-click
           opens a link in a new tab. And a disabled control never receives a
           click at all — only pointer events — so it's selected on pointerup. */
        function isPageTarget(raw) {
            return raw instanceof Element && isInPageScope(raw, rootElement) && !raw.closest('[data-chef-editor-root="true"]');
        }
        function handleMouseDown(event) {
            if (activeToolRef.current === 'hand' || !isPageTarget(event.target))
                return;
            if (event.target.isContentEditable)
                return; // caret placement while typing
            if (event.target.closest('input, textarea, select, option, button, summary, label, video, audio, [contenteditable]')) {
                event.preventDefault();
            }
        }
        function handleDisabledPointerUp(event) {
            if (event.button !== 0 || !isPageTarget(event.target))
                return;
            if (!event.target.closest(':disabled'))
                return;
            handleClick(event);
        }
        function handleDragStart(event) {
            if (!isPageTarget(event.target) || event.target.isContentEditable)
                return;
            event.preventDefault();
        }
        function handleAuxClick(event) {
            if (event.button === 1 && isPageTarget(event.target) && event.target.closest('a[href]'))
                event.preventDefault();
        }
        document.addEventListener('mouseover', handlePointerOver, { capture: true, passive: true });
        document.addEventListener('mouseout', handlePointerLeave, { capture: true, passive: true });
        document.addEventListener('mousedown', handleMouseDown, true);
        document.addEventListener('pointerup', handleDisabledPointerUp, true);
        document.addEventListener('dragstart', handleDragStart, true);
        document.addEventListener('auxclick', handleAuxClick, true);
        document.addEventListener('click', handleClick, true);
        document.addEventListener('dblclick', handleDblClick, true);
        document.addEventListener('contextmenu', handleContextMenu, true);
        document.addEventListener('touchstart', handleTouchStart, { capture: true, passive: true });
        document.addEventListener('touchmove', handleTouchMove, { capture: true, passive: true });
        document.addEventListener('touchend', handleTouchEnd, { capture: true, passive: false });
        document.addEventListener('touchcancel', cancelLongPress, { capture: true, passive: true });
        return () => {
            cancelAnimationFrame(hoverFrame);
            disconnectHitTester();
            document.removeEventListener('mouseover', handlePointerOver, true);
            document.removeEventListener('mouseout', handlePointerLeave, true);
            document.removeEventListener('mousedown', handleMouseDown, true);
            document.removeEventListener('pointerup', handleDisabledPointerUp, true);
            document.removeEventListener('dragstart', handleDragStart, true);
            document.removeEventListener('auxclick', handleAuxClick, true);
            document.removeEventListener('click', handleClick, true);
            document.removeEventListener('dblclick', handleDblClick, true);
            document.removeEventListener('contextmenu', handleContextMenu, true);
            document.removeEventListener('touchstart', handleTouchStart, true);
            document.removeEventListener('touchmove', handleTouchMove, true);
            document.removeEventListener('touchend', handleTouchEnd, true);
            document.removeEventListener('touchcancel', cancelLongPress, true);
            cancelLongPress();
            clearHover();
        };
    }, [showPanel, routeKey, viewportStoreKey, inlineEditing, showToast]);
}
//# sourceMappingURL=useCanvasPointer.js.map