import { type FroamIdentityDiagnosticSink, type FroamNodeRegistry } from './node-registry';
export type FroamFrameworkFinding = {
    framework: 'react' | 'vue' | 'unknown';
    evidence: string[];
    strategy: 'observable-dom-recovery';
    privateInternalsUsed: false;
};
/** Uses only public DOM markers. React private fiber keys are intentionally ignored. */
export declare function detectFrameworkHost(root: HTMLElement): FroamFrameworkFinding;
/**
 * Reattaches known IDs after host child-list replacement. It never patches a
 * framework renderer or reads fibers/component instances, so React/Vue remain
 * free to own the DOM and normal fingerprint safeguards still decide matches.
 */
export declare function createFrameworkIdentityObserver(input: {
    root: HTMLElement;
    registry: () => FroamNodeRegistry;
    onRegistry: (registry: FroamNodeRegistry) => void;
    onDiagnostic?: FroamIdentityDiagnosticSink;
    maxRecoveriesPerFrame?: number;
}): {
    finding: FroamFrameworkFinding;
    disconnect(): void;
};
//# sourceMappingURL=framework-identity.d.ts.map