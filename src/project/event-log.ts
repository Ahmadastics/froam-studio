import {
  FROAM_PROJECT_SCHEMA_VERSION,
  type FroamBranch,
  type FroamCheckpoint,
  type FroamId,
  type FroamProjectDocument,
  type FroamProjectEvent,
  type FroamProjectEventPayload,
  type FroamProjectEventType,
  type FroamProjectState,
} from './types'
import { applyOp } from '../collab/oplog'

export type FroamIdFactory = () => string

function defaultId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `froam-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

export function emptyProjectState(): FroamProjectState {
  return { legacyStore: {}, nodes: {}, relations: {}, flows: {}, interactions: {}, dna: {}, assets: {} }
}

function cloneState(state: FroamProjectState): FroamProjectState {
  return {
    legacyStore: { ...state.legacyStore },
    nodes: { ...state.nodes },
    relations: { ...state.relations },
    flows: { ...state.flows },
    interactions: { ...state.interactions },
    dna: { ...state.dna },
    assets: { ...state.assets },
  }
}

export function compareProjectEvents(a: FroamProjectEvent, b: FroamProjectEvent) {
  if (a.clock !== b.clock) return a.clock - b.clock
  if (a.actorId !== b.actorId) return a.actorId < b.actorId ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

export function applyProjectEvent(current: FroamProjectState, event: FroamProjectEvent): FroamProjectState {
  const next = cloneState(current)
  const payload = event.payload as Record<string, unknown>
  switch (event.type) {
    case 'design.store.replaced':
      next.legacyStore = { ...((payload.store ?? {}) as FroamProjectState['legacyStore']) }
      break
    case 'design.op.appended':
      next.legacyStore = applyOp(next.legacyStore, payload.op as Parameters<typeof applyOp>[1])
      break
    case 'node.upserted': {
      const node = payload.node as FroamProjectState['nodes'][string]
      if (node?.id) next.nodes[node.id] = node
      break
    }
    case 'node.removed': {
      const nodeId = String(payload.nodeId ?? '')
      delete next.nodes[nodeId]
      delete next.dna[nodeId]
      for (const relation of Object.values(next.relations)) {
        if (relation.from === nodeId || relation.to === nodeId) delete next.relations[relation.id]
      }
      break
    }
    case 'relation.upserted': {
      const relation = payload.relation as FroamProjectState['relations'][string]
      if (relation?.id) next.relations[relation.id] = relation
      break
    }
    case 'relation.removed':
      delete next.relations[String(payload.relationId ?? '')]
      break
    case 'flow.upserted': {
      const flow = payload.flow as FroamProjectState['flows'][string]
      if (flow?.id) next.flows[flow.id] = flow
      break
    }
    case 'flow.removed':
      delete next.flows[String(payload.flowId ?? '')]
      break
    case 'interaction.upserted': {
      const interaction = payload.interaction as FroamProjectState['interactions'][string]
      if (interaction?.id) next.interactions[interaction.id] = interaction
      break
    }
    case 'interaction.removed':
      delete next.interactions[String(payload.interactionId ?? '')]
      break
    case 'dna.captured': {
      const dna = payload.dna as FroamProjectState['dna'][string]
      if (dna?.nodeId) next.dna[dna.nodeId] = dna
      break
    }
    case 'asset.upserted': {
      const asset = payload.asset as FroamProjectState['assets'][string]
      if (asset?.id) next.assets[asset.id] = asset
      break
    }
    case 'asset.removed':
      delete next.assets[String(payload.assetId ?? '')]
      break
  }
  return next
}

export function createProjectDocument(input: {
  id: FroamId
  name: string
  actorId: string
  branchId?: FroamId
  branchName?: string
  now?: number
  idFactory?: FroamIdFactory
  initialState?: FroamProjectState
}): FroamProjectDocument {
  const now = input.now ?? Date.now()
  const makeId = input.idFactory ?? defaultId
  const branchId = input.branchId ?? 'main'
  const checkpointId = makeId()
  const checkpoint: FroamCheckpoint = {
    id: checkpointId,
    projectId: input.id,
    branchId,
    createdAt: now,
    createdBy: input.actorId,
    label: 'Initial state',
    eventIds: [],
    state: cloneState(input.initialState ?? emptyProjectState()),
  }
  const branch: FroamBranch = {
    id: branchId,
    name: input.branchName ?? 'Main',
    parentBranchId: null,
    forkEventId: null,
    baseCheckpointId: checkpointId,
    headEventId: null,
    createdAt: now,
    createdBy: input.actorId,
  }
  return {
    schemaVersion: FROAM_PROJECT_SCHEMA_VERSION,
    id: input.id,
    name: input.name,
    activeBranchId: branchId,
    createdAt: now,
    updatedAt: now,
    branches: { [branchId]: branch },
    checkpoints: { [checkpointId]: checkpoint },
    events: [],
  }
}

export function createProjectEvent(input: {
  id?: FroamId
  projectId: FroamId
  branchId: FroamId
  actorId: string
  clock: number
  type: FroamProjectEventType
  payload: FroamProjectEventPayload
  targetIds?: FroamId[]
  createdAt?: number
  batchId?: FroamId
  label?: string
  idFactory?: FroamIdFactory
}): FroamProjectEvent {
  return {
    schemaVersion: FROAM_PROJECT_SCHEMA_VERSION,
    id: input.id ?? (input.idFactory ?? defaultId)(),
    projectId: input.projectId,
    branchId: input.branchId,
    actorId: input.actorId,
    clock: input.clock,
    createdAt: input.createdAt ?? Date.now(),
    type: input.type,
    targetIds: input.targetIds ?? [],
    payload: input.payload,
    batchId: input.batchId,
    label: input.label,
  }
}

export function appendProjectEvents(document: FroamProjectDocument, incoming: readonly FroamProjectEvent[]) {
  const known = new Set(document.events.map((event) => event.id))
  const accepted = incoming.filter((event) => (
    event.schemaVersion === FROAM_PROJECT_SCHEMA_VERSION
    && event.projectId === document.id
    && Boolean(document.branches[event.branchId])
    && !known.has(event.id)
    && (known.add(event.id) || true)
  ))
  if (!accepted.length) return document
  const events = [...document.events, ...accepted].sort(compareProjectEvents)
  const branches = { ...document.branches }
  for (const branchId of new Set(accepted.map((event) => event.branchId))) {
    const branch = branches[branchId]
    const head = events.filter((event) => event.branchId === branchId).at(-1)
    branches[branchId] = { ...branch, headEventId: head?.id ?? branch.headEventId }
  }
  return {
    ...document,
    events,
    branches,
    updatedAt: Math.max(document.updatedAt, ...accepted.map((event) => event.createdAt)),
  }
}

export function deriveBranchState(document: FroamProjectDocument, branchId = document.activeBranchId) {
  const branch = document.branches[branchId]
  if (!branch) throw new Error(`Unknown Froam branch: ${branchId}`)
  const checkpoint = document.checkpoints[branch.baseCheckpointId]
  if (!checkpoint) throw new Error(`Missing checkpoint for Froam branch: ${branchId}`)
  const folded = new Set(checkpoint.eventIds)
  return document.events
    .filter((event) => event.branchId === branchId && !folded.has(event.id))
    .sort(compareProjectEvents)
    .reduce(applyProjectEvent, checkpoint.state)
}

export function checkpointBranch(document: FroamProjectDocument, input: {
  branchId?: FroamId
  actorId: string
  label?: string
  now?: number
  idFactory?: FroamIdFactory
}) {
  const branchId = input.branchId ?? document.activeBranchId
  const branch = document.branches[branchId]
  if (!branch) throw new Error(`Unknown Froam branch: ${branchId}`)
  const checkpoint: FroamCheckpoint = {
    id: (input.idFactory ?? defaultId)(),
    projectId: document.id,
    branchId,
    createdAt: input.now ?? Date.now(),
    createdBy: input.actorId,
    label: input.label,
    eventIds: document.events.filter((event) => event.branchId === branchId).map((event) => event.id),
    state: deriveBranchState(document, branchId),
  }
  return {
    ...document,
    updatedAt: checkpoint.createdAt,
    checkpoints: { ...document.checkpoints, [checkpoint.id]: checkpoint },
    branches: {
      ...document.branches,
      [branchId]: { ...branch, baseCheckpointId: checkpoint.id },
    },
  }
}

export function createProjectBranch(document: FroamProjectDocument, input: {
  id: FroamId
  name: string
  actorId: string
  fromBranchId?: FroamId
  now?: number
  idFactory?: FroamIdFactory
}) {
  if (document.branches[input.id]) throw new Error(`Froam branch already exists: ${input.id}`)
  const parentId = input.fromBranchId ?? document.activeBranchId
  const parent = document.branches[parentId]
  if (!parent) throw new Error(`Unknown Froam branch: ${parentId}`)
  const now = input.now ?? Date.now()
  const checkpointId = (input.idFactory ?? defaultId)()
  const checkpoint: FroamCheckpoint = {
    id: checkpointId,
    projectId: document.id,
    branchId: input.id,
    createdAt: now,
    createdBy: input.actorId,
    label: `Forked from ${parent.name}`,
    eventIds: [],
    state: deriveBranchState(document, parentId),
  }
  const branch: FroamBranch = {
    id: input.id,
    name: input.name,
    parentBranchId: parentId,
    forkEventId: parent.headEventId,
    baseCheckpointId: checkpointId,
    headEventId: null,
    createdAt: now,
    createdBy: input.actorId,
  }
  return {
    ...document,
    activeBranchId: input.id,
    updatedAt: now,
    checkpoints: { ...document.checkpoints, [checkpointId]: checkpoint },
    branches: { ...document.branches, [input.id]: branch },
  }
}

export function switchProjectBranch(document: FroamProjectDocument, branchId: FroamId) {
  if (!document.branches[branchId]) throw new Error(`Unknown Froam branch: ${branchId}`)
  return { ...document, activeBranchId: branchId }
}
