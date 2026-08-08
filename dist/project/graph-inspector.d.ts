import type { FroamNode, FroamProjectState, FroamRelation } from './types';
export type FroamGraphRow = {
    node: FroamNode;
    depth: number;
    incoming: FroamRelation[];
    outgoing: FroamRelation[];
};
export declare function graphSelectionIndex(state: FroamProjectState): {
    byNodeId: Map<string, FroamNode>;
    byPath: Map<string, FroamNode>;
};
/** Stable tree projection; disconnected nodes remain visible at the root. */
export declare function materializeGraphRows(state: FroamProjectState): FroamGraphRow[];
//# sourceMappingURL=graph-inspector.d.ts.map