import { type LayerNode } from './types';
export declare function ensureFroamNodeId(element: HTMLElement): string;
export declare function layerDepthFromPath(path: string): number;
export declare function labelLayerElement(element: HTMLElement): string;
export declare function isStructuralLayerElement(element: HTMLElement): boolean;
/** A section's outline (an outline never moves anything); its name tag is drawn over the page — see boundary-tag.ts. */
export declare function syncStructureBoundaryLabel(element: HTMLElement): void;
export declare function buildLayerNode(element: HTMLElement, root: HTMLElement): LayerNode;
export declare const LAYER_MAX_DEPTH = 64;
export declare const LAYER_MAX_NODES = 6000;
/**
 * The whole tree, paths built top-down: a child's path is its parent's plus
 * one segment, so the tree costs one pass over the page instead of a walk
 * back up to the root for every node.
 */
export declare function collectLayers(root: HTMLElement, maxDepth?: number): LayerNode[];
//# sourceMappingURL=layers.d.ts.map