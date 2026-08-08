import { type FroamPackedProject } from './storage-codec';
import type { FroamProjectDocument } from './types';
export type FroamHistoryCompactionReport = {
    beforeBytes: number;
    afterBytes: number;
    reductionPercent: number;
    applied: boolean;
    eventCount: number;
    eventIdsPreserved: boolean;
    checkpointIdsPreserved: boolean;
    canonicalEquivalent: boolean;
};
/**
 * Compacts the storage representation, never the canonical document. Events, IDs, payloads,
 * checkpoint states and branch fork references are restored exactly before use.
 */
export declare function compactProjectHistory(document: FroamProjectDocument): {
    packed: FroamPackedProject;
    report: FroamHistoryCompactionReport;
};
//# sourceMappingURL=history-compaction.d.ts.map