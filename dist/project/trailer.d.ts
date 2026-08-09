import type { FroamAnalysis, FroamInteraction, FroamProjectState } from './types';
export type FroamTrailerDuration = 10 | 15 | 30;
export type FroamTrailerShot = {
    id: string;
    startMs: number;
    durationMs: number;
    kind: 'brand' | 'screen' | 'interaction' | 'component' | 'mutation' | 'mobile' | 'brand-end';
    nodeId?: string;
    interactionId?: string;
    branchId?: string;
    label: string;
    viewport?: {
        width: number;
        height: number;
    };
};
export type FroamTrailerStoryboard = {
    id: string;
    durationSeconds: FroamTrailerDuration;
    createdAt: number;
    shots: FroamTrailerShot[];
    source: {
        realProjectState: true;
        flowIds: string[];
        branchId: string;
    };
    editable: true;
};
export interface FroamTrailerCaptureProvider {
    id: string;
    local: boolean;
    capture(input: {
        shot: FroamTrailerShot;
        state: FroamProjectState;
        interaction?: FroamInteraction;
    }): Promise<{
        shotId: string;
        frames: number;
        artifact?: Blob;
        limitations: string[];
    }>;
}
export declare function createTrailerStoryboard(input: {
    state: FroamProjectState;
    branchId: string;
    durationSeconds: FroamTrailerDuration;
    now?: number;
    selectedNodeIds?: string[];
    mutationBranchId?: string;
}): FroamTrailerStoryboard;
export declare function reorderTrailerShot(storyboard: FroamTrailerStoryboard, shotId: string, toIndex: number): FroamTrailerStoryboard;
export declare function removeTrailerShot(storyboard: FroamTrailerStoryboard, shotId: string): FroamTrailerStoryboard;
export declare function trailerStoryboardAnalysis(storyboard: FroamTrailerStoryboard): FroamAnalysis;
//# sourceMappingURL=trailer.d.ts.map