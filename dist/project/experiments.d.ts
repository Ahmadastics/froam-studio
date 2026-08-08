export type FroamRoadmapFeature = 'component-archive' | 'product-flow-intelligence' | 'interaction-library' | 'ui-sampling' | 'screenshot-to-ui' | 'attention-heatmap' | 'design-physics' | 'ui-gravity' | 'ui-sound' | 'chaos-testing' | 'synthetic-ux' | 'reality-mode' | 'mutate' | 'froam-space' | 'make-it-froam';
export type FroamFeatureMaturity = 'architecture-only' | 'experimental' | 'research-only' | 'production';
export type FroamFeatureDefinition = {
    id: FroamRoadmapFeature;
    maturity: FroamFeatureMaturity;
    defaultEnabled: boolean;
    prerequisites: string[];
};
export declare const FROAM_ROADMAP_FEATURES: readonly FroamFeatureDefinition[];
export declare function defaultFroamFeatureFlags(): Record<FroamRoadmapFeature, boolean>;
//# sourceMappingURL=experiments.d.ts.map