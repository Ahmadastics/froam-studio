export type FroamIdentityTelemetryMethod = 'stable-id' | 'registry' | 'path' | 'fingerprint' | 'attribute-lost' | 'ambiguous' | 'failed' | 'duplicate-prevented'
export type FroamIdentityTelemetrySnapshot = { version: 1; local: true; startedAt: number; updatedAt: number; total: number; counts: Record<FroamIdentityTelemetryMethod, number> }

const methods: FroamIdentityTelemetryMethod[] = ['stable-id', 'registry', 'path', 'fingerprint', 'attribute-lost', 'ambiguous', 'failed', 'duplicate-prevented']
export function createIdentityTelemetry(now = Date.now()) {
  const snapshot: FroamIdentityTelemetrySnapshot = { version: 1, local: true, startedAt: now, updatedAt: now, total: 0, counts: Object.fromEntries(methods.map((method) => [method, 0])) as Record<FroamIdentityTelemetryMethod, number> }
  return {
    record(method: FroamIdentityTelemetryMethod, count = 1, at = Date.now()) { if (!methods.includes(method) || !Number.isFinite(count) || count <= 0) return; snapshot.counts[method] += Math.floor(count); snapshot.total += Math.floor(count); snapshot.updatedAt = at },
    snapshot(): FroamIdentityTelemetrySnapshot { return structuredClone(snapshot) },
  }
}
export function identityTelemetryRates(snapshot: FroamIdentityTelemetrySnapshot) { return Object.fromEntries(methods.map((method) => [method, snapshot.total ? snapshot.counts[method] / snapshot.total : 0])) as Record<FroamIdentityTelemetryMethod, number> }
/** Remote adapters may receive this aggregate only; no DOM text, paths, URLs or project data exist in the contract. */
export type FroamIdentityTelemetryExporter = { id: string; optInRequired: true; send(snapshot: FroamIdentityTelemetrySnapshot): Promise<void> }

export function aggregateIdentityDiagnostics(events: ReadonlyArray<{ type: string; at: number }>, startedAt = events[0]?.at ?? Date.now()): FroamIdentityTelemetrySnapshot {
  const telemetry = createIdentityTelemetry(startedAt)
  for (const event of events) {
    const method: FroamIdentityTelemetryMethod | null = event.type === 'stable-id-resolved' ? 'stable-id' : event.type === 'registry-resolved' ? 'registry' : event.type === 'duplicate-identity-prevented' ? 'duplicate-prevented' : event.type === 'identity-attribute-lost' ? 'attribute-lost' : event.type === 'resolved-by-path' ? 'path' : event.type === 'fingerprint-match' ? 'fingerprint' : event.type === 'ambiguous-match' ? 'ambiguous' : event.type === 'resolution-failed' ? 'failed' : null
    if (method) telemetry.record(method, 1, event.at)
  }
  return telemetry.snapshot()
}
