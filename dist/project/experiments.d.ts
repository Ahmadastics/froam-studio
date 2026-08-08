export type FroamRoadmapFeature = 'froam-scan' | 'component-dna' | 'component-archive' | 'design-archaeology' | 'product-flow-intelligence' | 'visual-rhythm' | 'priority-responsive' | 'breakpoint-cinema' | 'interaction-library' | 'ui-sampling' | 'screenshot-to-ui' | 'attention-heatmap' | 'design-physics' | 'ui-gravity' | 'ui-sound' | 'chaos-testing' | 'synthetic-ux' | 'reality-mode' | 'mutate' | 'froam-space' | 'make-it-froam';
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
    designPhysics: boolean;
    uiGravity: boolean;
};
export declare const defaultFroamLabsFlags: () => FroamLabsFlags;
//# sourceMappingURL=experiments.d.ts.map