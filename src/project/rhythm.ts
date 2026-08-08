import type { FroamAnalysis, FroamScanRecord } from './types'

export function analyzeVisualRhythm(records: readonly FroamScanRecord[], viewportHeight: number, now = Date.now()): FroamAnalysis {
  const sections = records.map((record) => {
    const layout = record.signals.find((signal) => signal.kind === 'layout')?.values as { rect?: { y?: number; height?: number; width?: number }; padding?: string; gap?: string } | undefined
    const semantics = record.signals.find((signal) => signal.kind === 'semantics')?.values
    return { nodeId: record.node.nodeId, role: semantics?.role, y: Number(layout?.rect?.y ?? 0), height: Number(layout?.rect?.height ?? 0), width: Number(layout?.rect?.width ?? 0), spacing: `${layout?.padding ?? ''}|${layout?.gap ?? ''}` }
  }).filter((item) => item.height >= 100 && ['hero', 'card', 'unknown'].includes(String(item.role))).sort((a, b) => a.y - b.y)
  let longest = 1; let current = 1
  for (let index = 1; index < sections.length; index += 1) {
    const previous = sections[index - 1]; const item = sections[index]
    const same = Math.abs(item.height - previous.height) <= Math.max(16, previous.height * .08) && item.spacing === previous.spacing
    current = same ? current + 1 : 1; longest = Math.max(longest, current)
  }
  const span = sections.length ? (sections.at(-1)!.y + sections.at(-1)!.height - sections[0].y) / Math.max(1, viewportHeight) : 0
  const warnings = longest >= 4 ? [`${longest} consecutive regions use nearly identical layout rhythm.`] : span >= 2 && longest >= 3 ? [`Low compositional variation across ${span.toFixed(1)} viewport heights.`] : []
  return { schemaVersion: 1, id: `rhythm:${now}`, kind: 'visual-rhythm', targetIds: sections.map((item) => item.nodeId), createdAt: now, provider: 'froam-local-heuristics-v1', local: true, confidence: sections.length >= 4 ? .72 : .45, result: { sections, longestRepeatedRun: longest, viewportSpan: span, warnings } }
}
