import type { FroamProjectDocument } from './types';
export type FroamArchaeologyRecord = {
    nodeId: string;
    creation: {
        eventId: string;
        actorId: string;
        branchId: string;
        at: number;
    } | null;
    edits: Array<{
        eventId: string;
        actorId: string;
        branchId: string;
        at: number;
        label: string;
        category: string;
        rationale?: {
            text: string;
            origin: 'recorded';
        };
    }>;
    branchLineage: string[];
    derivedFrom: string[];
    authors: string[];
    checkpointLineage: Array<{
        id: string;
        branchId: string;
        at: number;
        label?: string;
    }>;
};
export declare function archaeologyForNode(document: FroamProjectDocument, nodeId: string): FroamArchaeologyRecord;
//# sourceMappingURL=archaeology.d.ts.map