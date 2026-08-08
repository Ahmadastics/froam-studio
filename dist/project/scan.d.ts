import { type FroamNodeRegistry } from './node-registry';
import { type FroamDNA, type FroamNode, type FroamRelation, type FroamScanRecord } from './types';
import type { FroamViewport } from '../collab/types';
export type FroamScanBundle = {
    schemaVersion: 1;
    capturedAt: number;
    rootNodeId: string;
    records: FroamScanRecord[];
    nodes: FroamNode[];
    relations: FroamRelation[];
    registry: FroamNodeRegistry;
    families: Array<{
        id: string;
        memberNodeIds: string[];
        signature: string;
        confidence: number;
    }>;
};
export declare function detectComponentFamilies(records: readonly FroamScanRecord[]): {
    id: string;
    signature: string;
    memberNodeIds: string[];
    confidence: number;
}[];
/** Local-only DOM understanding. It never uploads source or credentials. */
export declare function scanDomTree(root: HTMLElement, registry: FroamNodeRegistry, options: {
    routeKey: string;
    viewport: FroamViewport;
    now?: number;
    maxNodes?: number;
    selectedRoot?: HTMLElement;
}): FroamScanBundle;
/** Convert evidence into versioned DNA without erasing uncertainty or provenance. */
export declare function dnaFromScan(record: FroamScanRecord): FroamDNA;
/** Fingerprint the exact derived DNA payload while excluding its own storage marker. */
export declare function dnaProjectionHash(dna: FroamDNA): string;
/** Re-scan only the highest changed roots; callers keep unaffected records/DNA. */
export declare function scanDomChanges(root: HTMLElement, changed: readonly HTMLElement[], registry: FroamNodeRegistry, options: {
    routeKey: string;
    viewport: FroamViewport;
    now?: number;
    maxNodesPerRegion?: number;
}): {
    records: FroamScanRecord[];
    dna: FroamDNA[];
    nodes: FroamNode[];
    relations: FroamRelation[];
    registry: FroamNodeRegistry;
    invalidatedNodeIds: string[];
};
//# sourceMappingURL=scan.d.ts.map