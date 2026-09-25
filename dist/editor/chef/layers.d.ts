import { type LayerNode } from './types';
export declare function ensureFroamNodeId(element: HTMLElement): string;
export declare function layerDepthFromPath(path: string): number;
export declare function labelLayerElement(element: HTMLElement): string;
export declare function isStructuralLayerElement(element: HTMLElement): boolean;
export declare function syncStructureBoundaryLabel(element: HTMLElement): void;
export declare function buildLayerNode(element: HTMLElement, root: HTMLElement): LayerNode;
export declare const LAYER_MAX_DEPTH = 64;
export declare const LAYER_MAX_NODES = 6000;
export declare function collectLayers(root: HTMLElement, maxDepth?: number): LayerNode[];
//# sourceMappingURL=layers.d.ts.map