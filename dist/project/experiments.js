export const FROAM_ROADMAP_FEATURES = [
    { id: 'component-archive', maturity: 'architecture-only', defaultEnabled: false, prerequisites: ['stable identity', 'DNA'] },
    { id: 'product-flow-intelligence', maturity: 'architecture-only', defaultEnabled: false, prerequisites: ['project graph', 'flows'] },
    { id: 'interaction-library', maturity: 'architecture-only', defaultEnabled: false, prerequisites: ['interaction model'] },
    { id: 'ui-sampling', maturity: 'research-only', defaultEnabled: false, prerequisites: ['extension boundary', 'interaction model'] },
    { id: 'screenshot-to-ui', maturity: 'research-only', defaultEnabled: false, prerequisites: ['Scan', 'DNA', 'asset provenance'] },
    { id: 'attention-heatmap', maturity: 'research-only', defaultEnabled: false, prerequisites: ['Scan', 'validation corpus'] },
    { id: 'design-physics', maturity: 'architecture-only', defaultEnabled: false, prerequisites: ['interaction model', 'runtime adapter'] },
    { id: 'ui-gravity', maturity: 'research-only', defaultEnabled: false, prerequisites: ['design physics'] },
    { id: 'ui-sound', maturity: 'architecture-only', defaultEnabled: false, prerequisites: ['interaction model', 'assets'] },
    { id: 'chaos-testing', maturity: 'experimental', defaultEnabled: false, prerequisites: ['simulation adapter'] },
    { id: 'synthetic-ux', maturity: 'research-only', defaultEnabled: false, prerequisites: ['simulation adapter', 'flow graph'] },
    { id: 'reality-mode', maturity: 'research-only', defaultEnabled: false, prerequisites: ['simulation adapter', 'privacy model'] },
    { id: 'mutate', maturity: 'architecture-only', defaultEnabled: false, prerequisites: ['branches', 'history', 'DNA'] },
    { id: 'froam-space', maturity: 'architecture-only', defaultEnabled: false, prerequisites: ['project graph', 'stable identity'] },
    { id: 'make-it-froam', maturity: 'research-only', defaultEnabled: false, prerequisites: ['brand model'] },
];
export function defaultFroamFeatureFlags() {
    return Object.fromEntries(FROAM_ROADMAP_FEATURES.map((feature) => [feature.id, feature.defaultEnabled]));
}
//# sourceMappingURL=experiments.js.map