import type { FroamDNA, FroamNodeRef } from './types';
export type FroamScanSignalKind = 'structure' | 'layout' | 'visual' | 'behavior' | 'motion' | 'responsive' | 'accessibility' | 'provenance';
export type FroamScanSignal = {
    kind: FroamScanSignalKind;
    source: 'dom' | 'computed-style' | 'react' | 'runtime' | 'import' | 'manual';
    values: Record<string, unknown>;
    confidence?: number;
};
export type FroamScanRecord = {
    node: FroamNodeRef;
    capturedAt: number;
    signals: FroamScanSignal[];
};
/**
 * The shared seam between today's DOM/Intel scanners and future DNA consumers.
 * It performs no prediction: it only groups observed facts with provenance.
 */
export declare function dnaFromScan(record: FroamScanRecord): FroamDNA;
//# sourceMappingURL=scan.d.ts.map