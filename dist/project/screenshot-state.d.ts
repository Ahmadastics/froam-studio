import type { FroamScreenshotReconstruction, FroamScreenshotRegion } from './screenshot-reconstruction';
export type FroamScreenshotMatchEvidence = {
    signal: 'kind' | 'semantic-role' | 'ocr-text' | 'ordering' | 'geometry' | 'component-family' | 'visual' | 'hierarchy';
    score: number;
    detail: string;
};
export type FroamScreenshotRegionMatch = {
    fromRegionId: string;
    toRegionId: string;
    fromNodeId: string;
    toNodeId: string;
    confidence: number;
    evidence: FroamScreenshotMatchEvidence[];
};
export type FroamScreenshotAmbiguousMatch = {
    fromRegionId: string;
    candidateRegionIds: string[];
    confidence: number;
    reason: string;
};
export type FroamScreenshotRegionMatching = {
    matches: FroamScreenshotRegionMatch[];
    unmatchedFromRegionIds: string[];
    unmatchedToRegionIds: string[];
    ambiguous: FroamScreenshotAmbiguousMatch[];
};
export type FroamScreenshotStateDifference = {
    fromReferenceId: string;
    toReferenceId: string;
    matched: number;
    matches: FroamScreenshotRegionMatch[];
    ambiguousMatches: FroamScreenshotAmbiguousMatch[];
    appearedNodeIds: string[];
    disappearedNodeIds: string[];
    geometryChanges: Array<{
        fromNodeId: string;
        toNodeId: string;
        distance: number;
    }>;
    styleChanges: Array<{
        fromNodeId: string;
        toNodeId: string;
        colorChanged: boolean;
    }>;
    interactionHypotheses: Array<{
        kind: 'reveal' | 'hide' | 'move' | 'restyle';
        confidence: number;
        evidence: string[];
    }>;
    limitations: string[];
};
export declare function normalizedScreenshotGeometry(region: FroamScreenshotRegion, viewport: {
    width: number;
    height: number;
}): {
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
};
/**
 * Match regions using observable evidence. Region/node IDs are returned as locators,
 * but are intentionally never scored as correspondence proof.
 */
export declare function matchScreenshotRegions(from: FroamScreenshotReconstruction, to: FroamScreenshotReconstruction): FroamScreenshotRegionMatching;
export declare function compareScreenshotStates(from: FroamScreenshotReconstruction, to: FroamScreenshotReconstruction): FroamScreenshotStateDifference;
export declare function inferResponsiveScreenshotReferences(reconstructions: readonly FroamScreenshotReconstruction[]): {
    references: {
        id: string;
        width: number;
        height: number;
        regionCount: number;
    }[];
    observations: {
        from: string;
        to: string;
        difference: FroamScreenshotStateDifference;
    }[];
    confidence: number;
    limitation: string;
};
//# sourceMappingURL=screenshot-state.d.ts.map