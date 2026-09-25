import { getElementPath, isPathElement } from '../../collab/paths'
import { type LayerNode } from './types'
import { shouldSkipElement } from './dom'

export function ensureFroamNodeId(element: HTMLElement) {
  const existing = element.dataset.froamId
  if (existing) return existing
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  element.dataset.froamId = id
  return id
}

export function layerDepthFromPath(path: string) {
  return Math.max(0, path.split('/').filter(Boolean).length - 1)
}

export function labelLayerElement(element: HTMLElement) {
  return element.dataset.froamMerged === 'true'
    ? 'Stamp group'
    : element.dataset.froamShape === 'true'
      ? 'Shape'
      : element.dataset.froamFrameLabel
        || element.getAttribute('aria-label')
        || element.dataset.froamComponentCategory
        || element.tagName.toLowerCase()
}

export function isStructuralLayerElement(element: HTMLElement) {
  return ['section', 'header', 'footer', 'main', 'article', 'nav', 'aside'].includes(element.tagName.toLowerCase())
}

export function syncStructureBoundaryLabel(element: HTMLElement) {
  if (isStructuralLayerElement(element)) {
    element.dataset.froamBoundaryLabel = labelLayerElement(element)
    if (window.getComputedStyle(element).position === 'static') element.dataset.froamStaticBoundary = 'true'
    else element.removeAttribute('data-froam-static-boundary')
  } else {
    element.removeAttribute('data-froam-boundary-label')
    element.removeAttribute('data-froam-static-boundary')
  }
}

export function buildLayerNode(element: HTMLElement, root: HTMLElement): LayerNode {
  const path = getElementPath(element, root)
  const computed = window.getComputedStyle(element)
  const elementChildren = Array.from(element.children).filter((child): child is HTMLElement => isPathElement(child) && !shouldSkipElement(child))
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
    hasChildren: elementChildren.length > 0,
    childCount: elementChildren.length,
    nodeId: element.dataset.froamId || undefined,
  }
}

// Every element should be reachable from Layers, however deeply it's nested;
// the cap only protects the panel on pathological pages.
export const LAYER_MAX_DEPTH = 64

export const LAYER_MAX_NODES = 6000

export function collectLayers(root: HTMLElement, maxDepth = LAYER_MAX_DEPTH): LayerNode[] {
  const nodes: LayerNode[] = []
  function walk(el: HTMLElement, depth: number) {
    if (depth > maxDepth || nodes.length >= LAYER_MAX_NODES) return
    if (shouldSkipElement(el)) return
    const elementChildren = Array.from(el.children).filter((child): child is HTMLElement => isPathElement(child) && !shouldSkipElement(child))
    nodes.push(buildLayerNode(el, root))
    elementChildren.forEach((child) => walk(child, depth + 1))
  }
  for (const child of Array.from(root.children)) {
    if (isPathElement(child)) walk(child, 0)
  }
  return nodes
}
