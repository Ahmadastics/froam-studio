export type FroamSimulationEvent = {
    atMs: number;
    type: 'viewport';
    width: number;
    height: number;
} | {
    atMs: number;
    type: 'network';
    state: 'offline' | 'slow' | 'online';
    latencyMs?: number;
} | {
    atMs: number;
    type: 'data';
    state: 'empty' | 'partial' | 'full' | 'error';
} | {
    atMs: number;
    type: 'session';
    state: 'anonymous' | 'authenticated' | 'expired';
} | {
    atMs: number;
    type: 'input';
    targetId: string;
    action: string;
    value?: string;
};
export type FroamSimulationScenario = {
    id: string;
    name: string;
    seed?: number;
    events: FroamSimulationEvent[];
};
export type FroamSimulationAdapter = {
    apply: (event: FroamSimulationEvent) => void | Promise<void>;
};
/** Deterministic orchestration only. Products opt into effects through an adapter. */
export declare function runSimulationScenario(scenario: FroamSimulationScenario, adapter: FroamSimulationAdapter): Promise<{
    scenarioId: string;
    applied: number;
}>;
//# sourceMappingURL=simulation.d.ts.map