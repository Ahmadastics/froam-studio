import { jsx as _jsx } from "react/jsx-runtime";
const SNAP_THRESHOLD = 4;
/**
 * Compute alignment guides between a moving element rect and a list of sibling rects.
 * Returns guide lines where edges or centers align.
 */
export function computeAlignmentGuides(movingRect, siblingRects, threshold = SNAP_THRESHOLD) {
    const guides = [];
    let snapX = null;
    let snapY = null;
    const movingCenterX = movingRect.left + movingRect.width / 2;
    const movingCenterY = movingRect.top + movingRect.height / 2;
    for (const sibling of siblingRects) {
        const sibCenterX = sibling.left + sibling.width / 2;
        const sibCenterY = sibling.top + sibling.height / 2;
        // Vertical guides (x-axis alignment)
        const xChecks = [
            { moving: movingRect.left, sib: sibling.left, type: 'edge' },
            { moving: movingRect.right, sib: sibling.right, type: 'edge' },
            { moving: movingRect.left, sib: sibling.right, type: 'edge' },
            { moving: movingRect.right, sib: sibling.left, type: 'edge' },
            { moving: movingCenterX, sib: sibCenterX, type: 'center' },
        ];
        for (const check of xChecks) {
            if (Math.abs(check.moving - check.sib) < threshold) {
                const minY = Math.min(movingRect.top, sibling.top);
                const maxY = Math.max(movingRect.bottom, sibling.bottom);
                guides.push({ axis: 'x', position: check.sib, start: minY, end: maxY, type: check.type });
                // Snap delta: how far we need to shift left so check.moving aligns with check.sib
                if (snapX === null)
                    snapX = check.sib - check.moving;
            }
        }
        // Horizontal guides (y-axis alignment)
        const yChecks = [
            { moving: movingRect.top, sib: sibling.top, type: 'edge' },
            { moving: movingRect.bottom, sib: sibling.bottom, type: 'edge' },
            { moving: movingRect.top, sib: sibling.bottom, type: 'edge' },
            { moving: movingRect.bottom, sib: sibling.top, type: 'edge' },
            { moving: movingCenterY, sib: sibCenterY, type: 'center' },
        ];
        for (const check of yChecks) {
            if (Math.abs(check.moving - check.sib) < threshold) {
                const minX = Math.min(movingRect.left, sibling.left);
                const maxX = Math.max(movingRect.right, sibling.right);
                guides.push({ axis: 'y', position: check.sib, start: minX, end: maxX, type: check.type });
                // Snap delta: how far we need to shift up so check.moving aligns with check.sib
                if (snapY === null)
                    snapY = check.sib - check.moving;
            }
        }
    }
    // Deduplicate guides that are very close
    const uniqueGuides = [];
    for (const guide of guides) {
        const isDuplicate = uniqueGuides.some((g) => g.axis === guide.axis && Math.abs(g.position - guide.position) < 1);
        if (!isDuplicate)
            uniqueGuides.push(guide);
    }
    return { guides: uniqueGuides, snapX, snapY };
}
/**
 * Get bounding rects of all sibling elements in the same parent,
 * excluding the moving element itself and editor UI elements.
 */
export function getSiblingRects(movingElement) {
    const parent = movingElement.parentElement;
    if (!parent)
        return [];
    const rects = [];
    for (const child of Array.from(parent.children)) {
        if (child === movingElement)
            continue;
        if (!(child instanceof HTMLElement))
            continue;
        if (child.dataset.chefEditorRoot === 'true')
            continue;
        rects.push(child.getBoundingClientRect());
    }
    return rects;
}
export default function FroamSmartGuides({ guides, visible }) {
    if (!visible || guides.length === 0)
        return null;
    return (_jsx("svg", { className: "froam-smart-guides", "data-chef-editor-root": "true", style: {
            position: 'fixed',
            inset: 0,
            width: '100vw',
            height: '100vh',
            pointerEvents: 'none',
            zIndex: 1308,
        }, children: guides.map((guide, i) => {
            if (guide.axis === 'x') {
                return (_jsx("line", { className: `froam-smart-guide froam-smart-guide--${guide.type}`, x1: guide.position, y1: guide.start - 20, x2: guide.position, y2: guide.end + 20 }, `v${i}`));
            }
            return (_jsx("line", { className: `froam-smart-guide froam-smart-guide--${guide.type}`, x1: guide.start - 20, y1: guide.position, x2: guide.end + 20, y2: guide.position }, `h${i}`));
        }) }));
}
//# sourceMappingURL=FroamSmartGuides.js.map