import type { FroamResponsivePolicy, FroamScanRecord } from './types';
export type FroamResponsiveObservation = {
    width: number;
    overflowX: boolean;
    hiddenCritical: string[];
    collisions: Array<[string, string]>;
    clipped: string[];
    touchTargets: string[];
    markers: string[];
};
export declare function defaultResponsivePolicy(nodeId: string, actorId: string, now?: number): FroamResponsivePolicy;
export declare function responsiveSuggestions(records: readonly FroamScanRecord[], policies: Record<string, FroamResponsivePolicy>, width: number): {
    nodeId: string;
    action: string;
    reason: string;
}[];
export declare function observeResponsiveState(root: HTMLElement, registry: Record<string, {
    nodeId: string;
}>, policies: Record<string, FroamResponsivePolicy>, width: number): FroamResponsiveObservation;
export declare function cinemaWidths(min?: number, max?: number, step?: number): number[];
//# sourceMappingURL=responsive.d.ts.map