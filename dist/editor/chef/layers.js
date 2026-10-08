import { getElementPath, isPathElement, pathChildren, pathSegmentsOfChildren } from '../../collab/paths.js';
import { describeSelection } from '../selection-name.js';
import { shouldSkipElement } from './dom.js';
export function ensureFroamNodeId(element) {
    const existing = element.dataset.froamId;
    if (existing)
        return existing;
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    element.dataset.froamId = id;
    return id;
}
export function layerDepthFromPath(path) {
    return Math.max(0, path.split('/').filter(Boolean).length - 1);
}
export function labelLayerElement(element) {
    return element.dataset.froamMerged === 'true'
        ? 'Stamp group'
        : element.dataset.froamShape === 'true'
            ? 'Shape'
            : element.dataset.froamFrameLabel
                || element.getAttribute('aria-label')
                || element.dataset.froamComponentCategory
                || describeSelection(element.tagName.toLowerCase()).kind;
}
export function isStructuralLayerElement(element) {
    return ['section', 'header', 'footer', 'main', 'article', 'nav', 'aside'].includes(element.tagName.toLowerCase());
}
/** A section's outline (an outline never moves anything); its name tag is drawn over the page — see boundary-tag.ts. */
export function syncStructureBoundaryLabel(element) {
    element.removeAttribute('data-froam-static-boundary');
    if (isStructuralLayerElement(element))
        element.dataset.froamBoundaryLabel = labelLayerElement(element);
    else
        element.removeAttribute('data-froam-boundary-label');
}
export function buildLayerNode(element, root) {
    const children = pathChildren(element).filter((child) => isPathElement(child) && !shouldSkipElement(child));
    return layerNodeAt(element, getElementPath(element, root), children.length);
}
function layerNodeAt(element, path, childCount) {
    const computed = window.getComputedStyle(element);
    return {
        element,
        path,
        tag: element.tagName.toLowerCase(),
        label: labelLayerElement(element),
        kind: element.dataset.froamMerged === 'true' ? 'stamp' : element.dataset.froamShape === 'true' ? 'shape' : 'element',
        className: typeof element.className === 'string' ? element.className.split(' ').filter(Boolean).slice(0, 2).join(' ') : '',
        depth: layerDepthFromPath(path),
        hidden: computed.display === 'none',
        editorHidden: element.dataset.froamEditorHidden === 'true',
        exportHidden: element.dataset.froamExportHidden === 'true',
        hasChildren: childCount > 0,
        childCount,
        nodeId: element.dataset.froamId || undefined,
    };
}
// Every element should be reachable from Layers, however deeply it's nested;
// the cap only protects the panel on pathological pages.
export const LAYER_MAX_DEPTH = 64;
export const LAYER_MAX_NODES = 6000;
/**
 * The whole tree, paths built top-down: a child's path is its parent's plus
 * one segment, so the tree costs one pass over the page instead of a walk
 * back up to the root for every node.
 */
export function collectLayers(root, maxDepth = LAYER_MAX_DEPTH) {
    const nodes = [];
    function walk(el, path, depth) {
        if (depth > maxDepth || nodes.length >= LAYER_MAX_NODES)
            return;
        if (shouldSkipElement(el))
            return;
        const shown = pathSegmentsOfChildren(el).filter(([child]) => !shouldSkipElement(child));
        nodes.push(layerNodeAt(el, path, shown.length));
        for (const [child, segment] of shown)
            walk(child, `${path}/${segment}`, depth + 1);
    }
    for (const [child, segment] of pathSegmentsOfChildren(root))
        walk(child, segment, 0);
    return nodes;
}
//# sourceMappingURL=layers.js.map