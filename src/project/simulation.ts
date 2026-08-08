export type FroamSimulationEvent =
  | { atMs: number; type: 'viewport'; width: number; height: number }
  | { atMs: number; type: 'network'; state: 'offline' | 'slow' | 'online'; latencyMs?: number }
  | { atMs: number; type: 'data'; state: 'empty' | 'partial' | 'full' | 'error' }
  | { atMs: number; type: 'session'; state: 'anonymous' | 'authenticated' | 'expired' }
  | { atMs: number; type: 'input'; targetId: string; action: string; value?: string }
  | { atMs: number; type: 'assets'; state: 'available' | 'missing' | 'partial'; assetIds?: string[] }
  | { atMs: number; type: 'content'; state: 'normal' | 'long-text' | 'empty'; locale?: string }
  | { atMs: number; type: 'permissions'; state: 'granted' | 'denied' | 'prompt'; permission: string }
  | { atMs: number; type: 'api'; state: 'success' | 'failure' | 'timeout'; endpointId: string; status?: number }

export type FroamSimulationScenario = {
  id: string
  name: string
  seed?: number
  events: FroamSimulationEvent[]
}

export type FroamSimulationAdapter = {
  apply: (event: FroamSimulationEvent) => void | Promise<void>
}

/** Deterministic orchestration only. Products opt into effects through an adapter. */
export async function runSimulationScenario(scenario: FroamSimulationScenario, adapter: FroamSimulationAdapter) {
  const ordered = [...scenario.events].sort((a, b) => a.atMs - b.atMs)
  for (const event of ordered) await adapter.apply(event)
  return { scenarioId: scenario.id, applied: ordered.length }
}
