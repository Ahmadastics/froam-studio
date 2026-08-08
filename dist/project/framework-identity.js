import { FROAM_NODE_ATTRIBUTE, resolveNodeRef } from './node-registry.js';
/** Uses only public DOM markers. React private fiber keys are intentionally ignored. */
export function detectFrameworkHost(root) {
    const evidence = [];
    if (root.hasAttribute('data-reactroot') || root.querySelector('[data-reactroot],[data-react-root]'))
        evidence.push('React root marker');
    if (root.hasAttribute('data-v-app') || root.querySelector('[data-v-app]'))
        evidence.push('Vue application marker');
    if (evidence.some((item) => item.startsWith('React')))
        return { framework: 'react', evidence, strategy: 'observable-dom-recovery', privateInternalsUsed: false };
    if (evidence.some((item) => item.startsWith('Vue')))
        return { framework: 'vue', evidence, strategy: 'observable-dom-recovery', privateInternalsUsed: false };
    return { framework: 'unknown', evidence: ['No public framework marker found'], strategy: 'observable-dom-recovery', privateInternalsUsed: false };
}
/**
 * Reattaches known IDs after host child-list replacement. It never patches a
 * framework renderer or reads fibers/component instances, so React/Vue remain
 * free to own the DOM and normal fingerprint safeguards still decide matches.
 */
export function createFrameworkIdentityObserver(input) {
    let frame = 0;
    let stopped = false;
    let pending = [];
    const recover = () => {
        frame = 0;
        if (stopped)
            return;
        let registry = input.registry();
        let changed = false;
        const batch = pending.splice(0, input.maxRecoveriesPerFrame ?? 250);
        for (const nodeId of batch) {
            const entry = registry[nodeId];
            if (!entry)
                continue;
            const escaped = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(entry.nodeId) : entry.nodeId.replace(/['"\\]/g, '\\$&');
            if (input.root.querySelector(`[${FROAM_NODE_ATTRIBUTE}="${escaped}"]`))
                continue;
            const result = resolveNodeRef(entry, input.root, registry, { onDiagnostic: input.onDiagnostic });
            if (result.registry !== registry) {
                registry = result.registry;
                changed = true;
            }
        }
        if (changed)
            input.onRegistry(registry);
        if (pending.length && !stopped)
            frame = requestAnimationFrame(recover);
    };
    const observer = new MutationObserver(() => { pending = Object.keys(input.registry()); if (!frame)
        frame = requestAnimationFrame(recover); });
    observer.observe(input.root, { childList: true, subtree: true });
    return { finding: detectFrameworkHost(input.root), disconnect() { stopped = true; if (frame)
            cancelAnimationFrame(frame); observer.disconnect(); } };
}
//# sourceMappingURL=framework-identity.js.map