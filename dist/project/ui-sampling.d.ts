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
    scroll?: {
        x: number;
        y: number;
    };
    animation?: {
        name?: string;
        durationMs?: number;
        easing?: string;
    };
};
export type FroamSamplingObservation = {
    atMs: number;
    type: 'event' | 'mutation' | 'frame';
    targetRole: string;
    detail: Record<string, unknown>;
};
export type FroamSamplingSession = {
    id: string;
    trigger: string;
    sourceRole: string;
    startedAt: number;
    frames: FroamSampleFrame[];
    observations: FroamSamplingObservation[];
    provenance: 'froam-controlled-dom';
    unsupportedEffects: string[];
};
export type FroamSamplingTimelineEntry = {
    atMs: number;
    label: string;
    kind: FroamSamplingObservation['type'];
    targetRole: string;
};
export declare function createSamplingSession(input: Omit<FroamSamplingSession, 'frames' | 'observations' | 'provenance' | 'unsupportedEffects'>): FroamSamplingSession;
export declare function recordSamplingFrame(session: FroamSamplingSession, frame: FroamSampleFrame): FroamSamplingSession;
export declare function recordSamplingEvent(session: FroamSamplingSession, input: {
    atMs: number;
    targetRole: string;
    event: string;
    key?: string;
    pointerType?: string;
}): FroamSamplingSession;
export declare function recordSamplingMutation(session: FroamSamplingSession, input: {
    atMs: number;
    targetRole: string;
    kind: 'attributes' | 'child-list' | 'visibility';
    attributeName?: string;
    added?: number;
    removed?: number;
}): FroamSamplingSession;
export declare function addUnsupportedSamplingEffect(session: FroamSamplingSession, effect: string): {
    unsupportedEffects: string[];
    id: string;
    trigger: string;
    sourceRole: string;
    startedAt: number;
    frames: FroamSampleFrame[];
    observations: FroamSamplingObservation[];
    provenance: "froam-controlled-dom";
};
export declare function captureElementFrame(element: HTMLElement, input: {
    atMs: number;
    targetRole: string;
    nodeId?: string;
}): FroamSampleFrame;
export declare function createNativeSamplingRecorder(input: {
    root: HTMLElement;
    targets: Array<{
        element: HTMLElement;
        role: string;
        nodeId?: string;
    }>;
    trigger: string;
    sourceRole: string;
    now?: () => number;
    frameIntervalMs?: number;
}): {
    start(): /*elided*/ any;
    stop(): FroamSamplingSession;
    session: () => FroamSamplingSession;
};
export declare function samplingTimeline(session: FroamSamplingSession): FroamSamplingTimelineEntry[];
export declare function trimSamplingSession(session: FroamSamplingSession, startMs: number, endMs: number): FroamSamplingSession;
export declare function samplingSessionToRecipe(session: FroamSamplingSession, input: {
    recipeId: string;
    name: string;
    projectId: string;
    branchId: string;
    confidence?: number;
}): FroamInteractionRecipe;
//# sourceMappingURL=ui-sampling.d.ts.map