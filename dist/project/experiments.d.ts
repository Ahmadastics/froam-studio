export type FroamRoadmapFeature = 'froam-scan' | 'component-dna' | 'component-archive' | 'design-archaeology' | 'product-flow-intelligence' | 'visual-rhythm' | 'priority-responsive' | 'breakpoint-cinema' | 'interaction-library' | 'ui-sampling' | 'screenshot-to-ui' | 'attention-heatmap' | 'design-physics' | 'ui-gravity' | 'ui-sound' | 'chaos-testing' | 'synthetic-ux' | 'reality-mode' | 'trailer-generator' | 'mutate' | 'froam-space' | 'make-it-froam';
export type FroamFeatureMaturity = 'architecture-only' | 'experimental' | 'research-only' | 'beta' | 'production';
export type FroamFeatureDefinition = {
    id: FroamRoadmapFeature;
    maturity: FroamFeatureMaturity;
    defaultEnabled: boolean;
    prerequisites: string[];
};
export declare const FROAM_ROADMAP_FEATURES: readonly FroamFeatureDefinition[];
export declare function defaultFroamFeatureFlags(): Record<FroamRoadmapFeature, boolean>;
export type FroamLabsFlags = {
    mutate: boolean;
    interactionLibrary: boolean;
    uiSampling: boolean;
    externalSampling: boolean;
    designPhysics: boolean;
    uiGravity: boolean;
    chaosTesting: boolean;
    syntheticUx: boolean;
    uiSound: boolean;
    trailerGenerator: boolean;
    realityMode: boolean;
};
export declare const defaultFroamLabsFlags: () => FroamLabsFlags;
export declare const FROAM_LABS_FLAGS_KEY = "froam-labs-flags-v2";
export declare function readFroamLabsFlags(storage?: Pick<Storage, 'getItem'>): FroamLabsFlags;
export declare function writeFroamLabsFlags(storage: Pick<Storage, 'setItem'> | undefined, flags: FroamLabsFlags): boolean;
//# sourceMappingURL=experiments.d.ts.map