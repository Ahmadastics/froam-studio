import { useEffect, useRef } from 'react';
import { isInPageScope } from '../../collab/paths.js';
/** The drag payload a Library card carries: the pattern's id. */
export const FROAM_PATTERN_MIME = 'application/x-froam-pattern';
const SKIPPED_TAGS = new Set(['SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'LINK', 'META']);
function blockSiblings(parent) {
    return Array.from(parent.children).filter((child) => (child instanceof HTMLElement
        && !SKIPPED_TAGS.has(child.tagName)
        && child.getAttribute('data-chef-editor-root') !== 'true'
        && getComputedStyle(child).display !== 'none'));
}
/**
 * The section a pattern dropped at this point lands beside: the innermost
 * block at least half the page wide whose parent holds other blocks too —
 * a hero, a feature band, a footer — never a heading inside one of them.
 */
export function dropTargetFor(hit, root) {
    const rootWidth = root.getBoundingClientRect().width || window.innerWidth;
    let fallback = null;
    for (let element = hit; element && element !== root; element = element.parentElement) {
        if (!(element instanceof HTMLElement) || !isInPageScope(element, root))
            return fallback;
        const parent = element.parentElement;
        if (!parent)
            return fallback;
        const wide = element.getBoundingClientRect().width >= rootWidth * 0.5;
        if (wide && blockSiblings(parent).length >= 2)
            return element;
        if (parent === root)
            fallback = element;
    }
    return fallback;
}
const INDICATOR_ID = 'froam-drop-indicator';
/**
 * Drag a Library pattern over the page: a line shows exactly where it will
 * land — above or below the section under the pointer — and letting go puts
 * it there. Only drags that carry a pattern are touched; the page's own drop
 * zones (file uploads, sortable lists) never see a difference.
 */
export function usePatternDrop({ enabled, getRoot, onDrop }) {
    const onDropRef = useRef(onDrop);
    onDropRef.current = onDrop;
    const getRootRef = useRef(getRoot);
    getRootRef.current = getRoot;
    useEffect(() => {
        if (!enabled)
            return;
        let current = null;
        const carriesPattern = (event) => Array.from(event.dataTransfer?.types ?? []).includes(FROAM_PATTERN_MIME);
        function hide() {
            document.getElementById(INDICATOR_ID)?.remove();
            current = null;
        }
        function show(target, placement) {
            let indicator = document.getElementById(INDICATOR_ID);
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = INDICATOR_ID;
                indicator.setAttribute('data-chef-editor-root', 'true');
                indicator.setAttribute('aria-hidden', 'true');
                indicator.innerHTML = '<span></span>';
                document.body.appendChild(indicator);
            }
            const rect = target.getBoundingClientRect();
            indicator.style.left = `${Math.round(rect.left)}px`;
            indicator.style.width = `${Math.round(rect.width)}px`;
            indicator.style.top = `${Math.round(placement === 'before' ? rect.top : rect.bottom)}px`;
            const label = indicator.querySelector('span');
            if (label)
                label.textContent = placement === 'before' ? 'Insert above' : 'Insert below';
        }
        function onDragOver(event) {
            if (!carriesPattern(event))
                return;
            const root = getRootRef.current();
            const hit = document.elementFromPoint(event.clientX, event.clientY);
            // Over Froam's own panels there is nothing to drop onto.
            if (!root || !hit || hit.closest('[data-chef-editor-root="true"]')) {
                hide();
                return;
            }
            const target = dropTargetFor(hit, root);
            if (!target) {
                hide();
                return;
            }
            event.preventDefault();
            if (event.dataTransfer)
                event.dataTransfer.dropEffect = 'copy';
            const rect = target.getBoundingClientRect();
            const placement = event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
            if (current?.target !== target || current.placement !== placement)
                show(target, placement);
            current = { target, placement };
        }
        function onDropEvent(event) {
            if (!carriesPattern(event))
                return;
            const componentId = event.dataTransfer?.getData(FROAM_PATTERN_MIME);
            const landing = current;
            hide();
            if (!componentId || !landing)
                return;
            event.preventDefault();
            event.stopPropagation();
            onDropRef.current(componentId, landing.target, landing.placement);
        }
        function onDragLeave(event) {
            // Left the window entirely.
            if (!event.relatedTarget)
                hide();
        }
        document.addEventListener('dragover', onDragOver, true);
        document.addEventListener('drop', onDropEvent, true);
        document.addEventListener('dragleave', onDragLeave, true);
        document.addEventListener('dragend', hide, true);
        return () => {
            document.removeEventListener('dragover', onDragOver, true);
            document.removeEventListener('drop', onDropEvent, true);
            document.removeEventListener('dragleave', onDragLeave, true);
            document.removeEventListener('dragend', hide, true);
            hide();
        };
    }, [enabled]);
}
//# sourceMappingURL=pattern-drop.js.map