import type { FroamAnalysis, FroamFlow, FroamProjectState } from './types';
export type FroamSyntheticAction = {
    type: 'click' | 'input' | 'navigate' | 'wait' | 'back';
    targetId?: string;
    value?: string;
    routeKey?: string;
};
export type FroamSyntheticTask = {
    id: string;
    goal: string;
    startNodeId: string;
    successNodeIds: string[];
    maxSteps?: number;
    script?: FroamSyntheticAction[];
};
export type FroamSyntheticStep = {
    index: number;
    atMs: number;
    nodeId?: string;
    action: FroamSyntheticAction;
    outcome: 'advanced' | 'backtrack' | 'dead-end' | 'uncertain' | 'success';
    relationId?: string;
};
export type FroamSyntheticRun = {
    id: string;
    task: FroamSyntheticTask;
    provider: string;
    startedAt: number;
    finishedAt: number;
    success: boolean;
    steps: FroamSyntheticStep[];
    clicks: number;
    backtracks: number;
    deadEnds: number;
    finalNodeId?: string;
    importantFailures: string[];
};
export interface FroamSyntheticUxProvider {
    id: string;
    version: string;
    local: boolean;
    run(task: FroamSyntheticTask, context: {
        flow: FroamFlow;
        state: FroamProjectState;
        now: number;
    }): FroamSyntheticRun | Promise<FroamSyntheticRun>;
}
export declare const deterministicSyntheticUxProvider: FroamSyntheticUxProvider;
export declare function runSyntheticUx(task: FroamSyntheticTask, input: {
    flow: FroamFlow;
    state: FroamProjectState;
    provider?: FroamSyntheticUxProvider;
    now?: number;
}): Promise<FroamSyntheticRun>;
export declare function syntheticRunAnalysis(run: FroamSyntheticRun): FroamAnalysis;
export declare function syntheticReplay(run: FroamSyntheticRun): {
    atMs: number;
    label: string;
    nodeId: string | undefined;
    status: "success" | "uncertain" | "advanced" | "backtrack" | "dead-end";
}[];
//# sourceMappingURL=synthetic-ux.d.ts.map