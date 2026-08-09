import type { FroamScreenshotReconstruction } from './screenshot-reconstruction';
export type FroamScreenshotStateDifference = {
    fromReferenceId: string;
    toReferenceId: string;
    matched: number;
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