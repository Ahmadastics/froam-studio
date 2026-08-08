import type { FroamNodeLocator, FroamNodeRef } from './types';
/** The identity attribute Froam already ships on injected nodes. */
export declare const FROAM_NODE_ATTRIBUTE = "data-froam-id";
export type FroamNodeRegistryEntry = FroamNodeLocator & {
    nodeId: string;
    source: 'host-dom' | 'froam';
    updatedAt: number;
    lastResolution?: FroamNodeResolutionMethod;
    recoveryCount?: number;
};
export type FroamNodeRegistry = Record<string, FroamNodeRegistryEntry>;
export type FroamNodeResolutionMethod = 'attribute' | 'host-id' | 'path' | 'fingerprint' | 'ambiguous' | 'failed';
export type FroamIdentityDiagnostic = {
    type: 'identity-attribute-lost' | 'resolved-by-path' | 'path-stale' | 'fingerprint-match' | 'registry-updated' | 'ambiguous-match' | 'resolution-failed';
    nodeId: string;
    at: number;
    path?: string;
    score?: number;
    detail?: string;
};
export type FroamIdentityDiagnosticSink = (event: FroamIdentityDiagnostic) => void;
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
export declare function resolveNodeRef(ref: FroamNodeRef, root: HTMLElement, registry?: FroamNodeRegistry, options?: {
    onDiagnostic?: FroamIdentityDiagnosticSink;
    now?: number;
    ambiguityDelta?: number;
}): {
    status: 'exact' | 'recovered';
    resolvedBy: Exclude<FroamNodeResolutionMethod, 'ambiguous' | 'failed'>;
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