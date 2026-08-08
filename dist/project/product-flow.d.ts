import type { FroamFlow, FroamNode, FroamRelation } from './types';
export type FroamFlowNodeInput = {
    id: string;
    name: string;
    routeKey?: string;
    kind?: 'page' | 'screen' | 'state';
    stateType?: 'normal' | 'success' | 'error';
};
export declare function createFlowGraph(name: string, nodes: readonly FroamFlowNodeInput[], transitions: readonly {
    id: string;
    from: string;
    to: string;
    name?: string;
    condition?: string;
}[]): {
    flow: FroamFlow;
    nodes: FroamNode[];
    relations: FroamRelation[];
};
export declare function extendFlow(flow: FroamFlow, node: FroamNode, relation?: FroamRelation): FroamFlow;
//# sourceMappingURL=product-flow.d.ts.map