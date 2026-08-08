/**
 * The shared seam between today's DOM/Intel scanners and future DNA consumers.
 * It performs no prediction: it only groups observed facts with provenance.
 */
export function dnaFromScan(record) {
    const dna = { nodeId: record.node.nodeId, capturedAt: record.capturedAt };
    for (const signal of record.signals) {
        const current = dna[signal.kind];
        dna[signal.kind] = {
            ...current,
            ...signal.values,
            _sources: [
                ...(current?._sources ?? []),
                { source: signal.source, confidence: signal.confidence ?? 1 },
            ],
        };
    }
    return dna;
}
//# sourceMappingURL=scan.js.map