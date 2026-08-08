export type FroamRoadmapFeature =
  | 'froam-scan'
  | 'component-dna'
  | 'component-archive'
  | 'design-archaeology'
  | 'product-flow-intelligence'
  | 'visual-rhythm'
  | 'priority-responsive'
  | 'breakpoint-cinema'
  | 'interaction-library'
  | 'ui-sampling'
  | 'screenshot-to-ui'
  | 'attention-heatmap'
  | 'design-physics'
  | 'ui-gravity'
  | 'ui-sound'
  | 'chaos-testing'
  | 'synthetic-ux'
  | 'reality-mode'
  | 'mutate'
  | 'froam-space'
  | 'make-it-froam'

export type FroamFeatureMaturity = 'architecture-only' | 'experimental' | 'research-only' | 'beta' | 'production'

export type FroamFeatureDefinition = {
  id: FroamRoadmapFeature
  maturity: FroamFeatureMaturity
  defaultEnabled: boolean
  prerequisites: string[]
}

export const FROAM_ROADMAP_FEATURES: readonly FroamFeatureDefinition[] = [
  { id: 'froam-scan', maturity: 'beta', defaultEnabled: true, prerequisites: ['stable identity', 'live DOM'] },
  { id: 'component-dna', maturity: 'beta', defaultEnabled: true, prerequisites: ['Scan', 'project graph'] },
  { id: 'component-archive', maturity: 'beta', defaultEnabled: true, prerequisites: ['stable identity', 'DNA'] },
  { id: 'design-archaeology', maturity: 'beta', defaultEnabled: true, prerequisites: ['history', 'branches', 'stable identity'] },
  { id: 'product-flow-intelligence', maturity: 'beta', defaultEnabled: true, prerequisites: ['project graph', 'flows'] },
  { id: 'visual-rhythm', maturity: 'experimental', defaultEnabled: true, prerequisites: ['Scan'] },
  { id: 'priority-responsive', maturity: 'beta', defaultEnabled: true, prerequisites: ['DNA', 'Scan'] },
  { id: 'breakpoint-cinema', maturity: 'beta', defaultEnabled: true, prerequisites: ['responsive observations', 'live DOM'] },
  { id: 'interaction-library', maturity: 'architecture-only', defaultEnabled: false, prerequisites: ['interaction model'] },
  { id: 'ui-sampling', maturity: 'research-only', defaultEnabled: false, prerequisites: ['extension boundary', 'interaction model'] },
  { id: 'screenshot-to-ui', maturity: 'experimental', defaultEnabled: true, prerequisites: ['Scan', 'DNA', 'asset provenance'] },
  { id: 'attention-heatmap', maturity: 'experimental', defaultEnabled: true, prerequisites: ['Scan', 'validation corpus'] },
  { id: 'design-physics', maturity: 'architecture-only', defaultEnabled: false, prerequisites: ['interaction model', 'runtime adapter'] },
  { id: 'ui-gravity', maturity: 'research-only', defaultEnabled: false, prerequisites: ['design physics'] },
  { id: 'ui-sound', maturity: 'architecture-only', defaultEnabled: false, prerequisites: ['interaction model', 'assets'] },
  { id: 'chaos-testing', maturity: 'experimental', defaultEnabled: false, prerequisites: ['simulation adapter'] },
  { id: 'synthetic-ux', maturity: 'research-only', defaultEnabled: false, prerequisites: ['simulation adapter', 'flow graph'] },
  { id: 'reality-mode', maturity: 'research-only', defaultEnabled: false, prerequisites: ['simulation adapter', 'privacy model'] },
  { id: 'mutate', maturity: 'architecture-only', defaultEnabled: false, prerequisites: ['branches', 'history', 'DNA'] },
  { id: 'froam-space', maturity: 'architecture-only', defaultEnabled: false, prerequisites: ['project graph', 'stable identity'] },
  { id: 'make-it-froam', maturity: 'research-only', defaultEnabled: false, prerequisites: ['brand model'] },
] as const

export function defaultFroamFeatureFlags(): Record<FroamRoadmapFeature, boolean> {
  return Object.fromEntries(FROAM_ROADMAP_FEATURES.map((feature) => [feature.id, feature.defaultEnabled])) as Record<FroamRoadmapFeature, boolean>
}
