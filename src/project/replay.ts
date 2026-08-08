import { applyProjectEvent, compareProjectEvents } from './event-log'
import type { FroamOp } from '../collab/types'
import type { FroamProjectDocument, FroamProjectEvent, FroamProjectState } from './types'

export type FroamReplayCategory = 'structural' | 'styling' | 'text' | 'interaction' | 'other'
export type FroamReplayFilter = {
  actorId?: string
  category?: FroamReplayCategory
  includeBaseline?: boolean
}

export function replayCategory(event: FroamProjectEvent): FroamReplayCategory {
  if (event.type.startsWith('interaction.')) return 'interaction'
  if (event.type.startsWith('node.') || event.type.startsWith('relation.') || event.type.startsWith('flow.')) return 'structural'
  if (event.type !== 'design.op.appended') return 'other'
  const op = (event.payload as { op?: FroamOp }).op
  if (op?.structure) return 'structural'
  if (op?.field === 'text') return 'text'
  if (op?.field?.startsWith('style:') || op?.field === 'imageUrl') return 'styling'
  return 'other'
}

export function filterReplayEvents(events: readonly FroamProjectEvent[], filter: FroamReplayFilter = {}) {
  return events.filter((event) => {
    if (!filter.includeBaseline && event.actorId === 'baseline') return false
    if (filter.actorId && event.actorId !== filter.actorId) return false
    if (filter.category && replayCategory(event) !== filter.category) return false
    return true
  }).sort(compareProjectEvents)
}

export function branchReplayEvents(document: FroamProjectDocument, branchId = document.activeBranchId, filter: FroamReplayFilter = {}) {
  const branch = document.branches[branchId]
  if (!branch) throw new Error(`Unknown Froam branch: ${branchId}`)
  const folded = new Set(document.checkpoints[branch.baseCheckpointId]?.eventIds ?? [])
  return filterReplayEvents(document.events.filter((event) => event.branchId === branchId && !folded.has(event.id)), filter)
}

/** Fold to a cursor without mutating the project. Checkpoints make the initial state cheap. */
export function replayStateAt(
  document: FroamProjectDocument,
  cursor: number,
  branchId = document.activeBranchId,
  filter: FroamReplayFilter = { includeBaseline: true },
): FroamProjectState {
  const branch = document.branches[branchId]
  if (!branch) throw new Error(`Unknown Froam branch: ${branchId}`)
  const checkpoint = document.checkpoints[branch.baseCheckpointId]
  if (!checkpoint) throw new Error(`Missing checkpoint for Froam branch: ${branchId}`)
  const folded = new Set(checkpoint.eventIds)
  const baseline = document.events
    .filter((event) => event.branchId === branchId && event.actorId === 'baseline' && !folded.has(event.id))
    .sort(compareProjectEvents)
    .reduce(applyProjectEvent, checkpoint.state)
  const events = branchReplayEvents(document, branchId, { ...filter, includeBaseline: false })
  return events.slice(0, Math.max(0, Math.min(cursor, events.length))).reduce(applyProjectEvent, baseline)
}

export function replayActors(events: readonly FroamProjectEvent[]) {
  return [...new Set(events.map((event) => event.actorId).filter((actor) => actor !== 'baseline'))].sort()
}

export function replayEventLabel(event: FroamProjectEvent) {
  const op = event.type === 'design.op.appended' ? (event.payload as { op?: FroamOp }).op : undefined
  return event.label || op?.label || event.type.replaceAll('.', ' ')
}
