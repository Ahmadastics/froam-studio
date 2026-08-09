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
  | 'trailer-generator'
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
  { id: 'interaction-library', maturity: 'experimental', defaultEnabled: false, prerequisites: ['interaction model'] },
  { id: 'ui-sampling', maturity: 'experimental', defaultEnabled: false, prerequisites: ['Froam-controlled DOM', 'interaction model'] },
  { id: 'screenshot-to-ui', maturity: 'experimental', defaultEnabled: true, prerequisites: ['Scan', 'DNA', 'asset provenance'] },
  { id: 'attention-heatmap', maturity: 'experimental', defaultEnabled: true, prerequisites: ['Scan', 'validation corpus'] },
  { id: 'design-physics', maturity: 'experimental', defaultEnabled: false, prerequisites: ['interaction model', 'runtime adapter'] },
  { id: 'ui-gravity', maturity: 'experimental', defaultEnabled: false, prerequisites: ['design physics'] },
  { id: 'ui-sound', maturity: 'architecture-only', defaultEnabled: false, prerequisites: ['interaction model', 'assets'] },
  { id: 'chaos-testing', maturity: 'experimental', defaultEnabled: false, prerequisites: ['simulation adapter'] },
  { id: 'synthetic-ux', maturity: 'research-only', defaultEnabled: false, prerequisites: ['simulation adapter', 'flow graph'] },
  { id: 'reality-mode', maturity: 'research-only', defaultEnabled: false, prerequisites: ['simulation adapter', 'privacy model'] },
  { id: 'trailer-generator', maturity: 'experimental', defaultEnabled: false, prerequisites: ['Product Flow', 'interaction model', 'real render capture'] },
  { id: 'mutate', maturity: 'experimental', defaultEnabled: false, prerequisites: ['branches', 'history', 'DNA'] },
  { id: 'froam-space', maturity: 'architecture-only', defaultEnabled: false, prerequisites: ['project graph', 'stable identity'] },
  { id: 'make-it-froam', maturity: 'research-only', defaultEnabled: false, prerequisites: ['brand model'] },
] as const

export function defaultFroamFeatureFlags(): Record<FroamRoadmapFeature, boolean> {
  return Object.fromEntries(FROAM_ROADMAP_FEATURES.map((feature) => [feature.id, feature.defaultEnabled])) as Record<FroamRoadmapFeature, boolean>
}

export type FroamLabsFlags = { mutate: boolean; interactionLibrary: boolean; uiSampling: boolean; externalSampling: boolean; designPhysics: boolean; uiGravity: boolean; chaosTesting: boolean; syntheticUx: boolean; uiSound: boolean; trailerGenerator: boolean; realityMode: boolean }
export const defaultFroamLabsFlags = (): FroamLabsFlags => ({ mutate: false, interactionLibrary: false, uiSampling: false, externalSampling: false, designPhysics: false, uiGravity: false, chaosTesting: false, syntheticUx: false, uiSound: false, trailerGenerator: false, realityMode: false })
export const FROAM_LABS_FLAGS_KEY = 'froam-labs-flags-v2'
export function readFroamLabsFlags(storage?: Pick<Storage, 'getItem'>): FroamLabsFlags { try { return { ...defaultFroamLabsFlags(), ...JSON.parse(storage?.getItem(FROAM_LABS_FLAGS_KEY) ?? '{}') } as FroamLabsFlags } catch { return defaultFroamLabsFlags() } }
export function writeFroamLabsFlags(storage: Pick<Storage, 'setItem'> | undefined, flags: FroamLabsFlags) { try { storage?.setItem(FROAM_LABS_FLAGS_KEY, JSON.stringify(flags)); return true } catch { return false } }
