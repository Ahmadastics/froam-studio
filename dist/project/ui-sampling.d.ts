import type { FroamInteractionRecipe } from './interaction-library';
export type FroamObservedStyle = Record<string, string | number>;
export type FroamSampleFrame = {
    atMs: number;
    targetRole: string;
    nodeId?: string;
    styles: FroamObservedStyle;
    geometry?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    visible?: boolean;
};
export type FroamSamplingSession = {
    id: string;
    trigger: string;
    sourceRole: string;
    startedAt: number;
    frames: FroamSampleFrame[];
    provenance: 'froam-controlled-dom';
};
export declare function createSamplingSession(input: Omit<FroamSamplingSession, 'frames' | 'provenance'>): FroamSamplingSession;
export declare function recordSamplingFrame(session: FroamSamplingSession, frame: FroamSampleFrame): FroamSamplingSession;
export declare function samplingSessionToRecipe(session: FroamSamplingSession, input: {
    recipeId: string;
    name: string;
    projectId: string;
    branchId: string;
}): FroamInteractionRecipe;
//# sourceMappingURL=ui-sampling.d.ts.map