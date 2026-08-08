import type { FroamNodeLocator, FroamNodeRef } from './types';
/** The identity attribute Froam already ships on injected nodes. */
export declare const FROAM_NODE_ATTRIBUTE = "data-froam-id";
export type FroamNodeRegistryEntry = FroamNodeLocator & {
    nodeId: string;
    source: 'host-dom' | 'froam';
    updatedAt: number;
};
export type FroamNodeRegistry = Record<string, FroamNodeRegistryEntry>;
export declare function isValidFroamNodeId(value: string | null | undefined): value is string;
export declare function captureNodeRef(element: HTMLElement, root: HTMLElement, registry: FroamNodeRegistry, options?: {
    routeKey?: string;
    viewport?: FroamNodeLocator['viewport'];
    now?: number;
    idFactory?: () => string;
    attach?: boolean;
}): {
    ref: FroamNodeRef;
    registry: FroamNodeRegistry;
};
export declare function resolveNodeRef(ref: FroamNodeRef, root: HTMLElement, registry?: FroamNodeRegistry): {
    status: 'exact' | 'recovered';
    element: HTMLElement;
    ref: FroamNodeRef;
    registry: FroamNodeRegistry;
} | {
    status: 'orphaned';
    ref: FroamNodeRef;
    registry: FroamNodeRegistry;
};
export declare function registryRef(registry: FroamNodeRegistry, nodeId: string): FroamNodeRef | null;
//# sourceMappingURL=node-registry.d.ts.map