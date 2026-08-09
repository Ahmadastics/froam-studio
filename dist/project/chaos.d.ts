import type { FroamAnalysis, FroamProjectState } from './types';
import { type FroamSimulationAdapter, type FroamSimulationEvent, type FroamSimulationScenario } from './simulation';
export type FroamChaosSeverity = 'info' | 'warning' | 'high' | 'critical';
export type FroamChaosNodeSnapshot = {
    nodeId: string;
    rect: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    visible: boolean;
    reachable?: boolean;
    clipped?: boolean;
    textOverflow?: boolean;
    hierarchyBroken?: boolean;
};
export type FroamChaosSnapshot = {
    viewport: {
        width: number;
        height: number;
    };
    nodes: FroamChaosNodeSnapshot[];
    state?: string;
};
export type FroamChaosFailure = {
    id: string;
    scenarioId: string;
    nodeId?: string;
    kind: 'overflow' | 'collision' | 'clipped' | 'hidden-critical' | 'unreachable-control' | 'broken-hierarchy' | 'invalid-state';
    severity: FroamChaosSeverity;
    message: string;
    evidence: Record<string, unknown>;
};
export type FroamChaosScenarioResult = {
    scenario: FroamSimulationScenario;
    status: 'passed' | 'warning' | 'failed';
    failures: FroamChaosFailure[];
    snapshot: FroamChaosSnapshot;
    replay: FroamSimulationEvent[];
};
export type FroamChaosReport = {
    id: string;
    createdAt: number;
    scenarios: FroamChaosScenarioResult[];
    passed: number;
    warnings: number;
    failed: number;
    total: number;
};
export interface FroamChaosAdapter extends FroamSimulationAdapter {
    capture(scenario: FroamSimulationScenario): FroamChaosSnapshot | Promise<FroamChaosSnapshot>;
    restore(): void | Promise<void>;
}
export declare function createDefaultChaosScenarios(): FroamSimulationScenario[];
export declare function evaluateChaosSnapshot(scenario: FroamSimulationScenario, snapshot: FroamChaosSnapshot, state: Pick<FroamProjectState, 'responsive'>): FroamChaosFailure[];
export declare function runChaosTesting(input: {
    scenarios: readonly FroamSimulationScenario[];
    adapter: FroamChaosAdapter;
    state: Pick<FroamProjectState, 'responsive'>;
    now?: number;
}): Promise<FroamChaosReport>;
export declare function chaosReportAnalysis(report: FroamChaosReport): FroamAnalysis;
//# sourceMappingURL=chaos.d.ts.map