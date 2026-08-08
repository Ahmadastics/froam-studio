import type { FroamDNA, FroamNodeRef } from './types'

export type FroamScanSignalKind =
  | 'structure'
  | 'layout'
  | 'visual'
  | 'behavior'
  | 'motion'
  | 'responsive'
  | 'accessibility'
  | 'provenance'

export type FroamScanSignal = {
  kind: FroamScanSignalKind
  source: 'dom' | 'computed-style' | 'react' | 'runtime' | 'import' | 'manual'
  values: Record<string, unknown>
  confidence?: number
}

export type FroamScanRecord = {
  node: FroamNodeRef
  capturedAt: number
  signals: FroamScanSignal[]
}

/**
 * The shared seam between today's DOM/Intel scanners and future DNA consumers.
 * It performs no prediction: it only groups observed facts with provenance.
 */
export function dnaFromScan(record: FroamScanRecord): FroamDNA {
  const dna: FroamDNA = { nodeId: record.node.nodeId, capturedAt: record.capturedAt }
  for (const signal of record.signals) {
    const current = dna[signal.kind] as Record<string, unknown> | undefined
    dna[signal.kind] = {
      ...current,
      ...signal.values,
      _sources: [
        ...((current?._sources as unknown[] | undefined) ?? []),
        { source: signal.source, confidence: signal.confidence ?? 1 },
      ],
    }
  }
  return dna
}

