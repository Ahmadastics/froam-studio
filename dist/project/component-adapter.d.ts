import type { FroamNode, FroamRelation } from './types';
export type FroamComponentDescriptor = {
    id: string;
    title: string;
    category?: string;
    summary?: string;
    anatomy?: readonly string[];
};
/** Projects today's catalog metadata into the shared graph without changing its factories. */
export declare function componentCatalogGraphRecords(definitions: readonly FroamComponentDescriptor[]): {
    nodes: FroamNode[];
    relations: FroamRelation[];
};
//# sourceMappingURL=component-adapter.d.ts.map