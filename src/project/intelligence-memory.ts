import { archiveItemKind } from './archive'
import type { FroamArchiveItem, FroamProjectState } from './types'

export type FroamMemoryInsight = { id: string; tone: 'signal' | 'opportunity' | 'warning'; title: string; detail: string; action?: 'scan-selection' | 'open-archive' | 'save-interaction' }

export type FroamIntelligenceMemory = {
  artifactCounts: Record<'component' | 'style' | 'motion' | 'interaction' | 'interface-pattern', number>
  learnedTriggers: Array<{ trigger: string; count: number }>
  learnedRoles: Array<{ role: string; count: number }>
  totalUses: number
  insights: FroamMemoryInsight[]
}

export function buildIntelligenceMemory(state: FroamProjectState): FroamIntelligenceMemory {
  const items = Object.values(state.archive)
  const artifactCounts: FroamIntelligenceMemory['artifactCounts'] = { component: 0, style: 0, motion: 0, interaction: 0, 'interface-pattern': 0 }
  const triggers = new Map<string, number>()
  const roles = new Map<string, number>()
  let totalUses = 0
  for (const item of items) {
    artifactCounts[archiveItemKind(item)] += 1
    const role = String(item.dna.semantics?.role ?? 'unknown')
    if (role !== 'unknown') roles.set(role, (roles.get(role) ?? 0) + 1)
    const interaction = item.artifact?.interaction
    if (interaction) triggers.set(interaction.trigger, (triggers.get(interaction.trigger) ?? 0) + 1)
    totalUses += Number(item.metadata?.useCount ?? item.usageNodeIds.length)
  }
  const ranked = (map: Map<string, number>) => [...map].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count || a.key.localeCompare(b.key))
  const learnedTriggers = ranked(triggers).map(({ key, count }) => ({ trigger: key, count }))
  const learnedRoles = ranked(roles).map(({ key, count }) => ({ role: key, count }))
  const insights: FroamMemoryInsight[] = []
  if (!items.length) insights.push({ id: 'empty-memory', tone: 'opportunity', title: 'Teach Froam your interface language', detail: 'Archive a component, style, motion, or complete pattern. Froam will summarize what you actually save and reuse.', action: 'open-archive' })
  if (Object.keys(state.interactions).length && artifactCounts.motion + artifactCounts.interaction === 0) insights.push({ id: 'unsaved-motion', tone: 'opportunity', title: 'Reusable behavior is waiting', detail: `${Object.keys(state.interactions).length} project interaction${Object.keys(state.interactions).length === 1 ? '' : 's'} exist, but none are in the Archive.`, action: 'save-interaction' })
  const unscanned = items.filter((item) => !state.dna[item.nodeId]).length
  if (unscanned) insights.push({ id: 'thin-dna', tone: 'warning', title: 'Some memories have shallow DNA', detail: `${unscanned} archived artifact${unscanned === 1 ? '' : 's'} came from direct capture. Scan their source when available for stronger recommendations.`, action: 'scan-selection' })
  if (learnedTriggers[0]) insights.push({ id: 'trigger-pattern', tone: 'signal', title: `${learnedTriggers[0].trigger} is your strongest behavior pattern`, detail: `It appears in ${learnedTriggers[0].count} saved artifact${learnedTriggers[0].count === 1 ? '' : 's'}. Froam reports this as observed project memory, not a universal design rule.` })
  if (learnedRoles[0]) insights.push({ id: 'role-pattern', tone: 'signal', title: `${learnedRoles[0].role} is your most archived role`, detail: `${learnedRoles[0].count} saved artifact${learnedRoles[0].count === 1 ? '' : 's'} share this semantic role.` })
  return { artifactCounts, learnedTriggers, learnedRoles, totalUses, insights }
}

export function archiveItemsForNode(items: FroamArchiveItem[], nodeId?: string) { return nodeId ? items.filter((item) => item.nodeId === nodeId) : [] }
