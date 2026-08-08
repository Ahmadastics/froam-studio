import type {
  EditorStore,
  FroamActorId,
  FroamAnchorFingerprint,
  FroamOp,
  FroamViewport,
} from '../collab/types'

/** Schema version of the Connected Canvas project envelope (not the product version). */
export const FROAM_PROJECT_SCHEMA_VERSION = 1 as const

export type FroamId = string

export type FroamNodeKind =
  | 'project'
  | 'page'
  | 'screen'
  | 'frame'
  | 'element'
  | 'component-definition'
  | 'component-instance'
  | 'asset'
  | 'state'

export type FroamNodeLocator = {
  /** Last-known legacy path. Kept while the runtime and codegen remain path-based. */
  path?: string
  /** Recovery evidence for native host nodes whose structure moved. */
  fingerprint?: FroamAnchorFingerprint
  routeKey?: string
  viewport?: FroamViewport
}

export type FroamNodeRef = FroamNodeLocator & {
  nodeId: FroamId
}

export type FroamNode = {
  id: FroamId
  kind: FroamNodeKind
  name?: string
  parentId?: FroamId | null
  componentId?: FroamId | null
  source: 'host-dom' | 'froam' | 'imported'
  locator?: FroamNodeLocator
  metadata?: Record<string, unknown>
}

export type FroamRelationKind =
  | 'contains'
  | 'instance-of'
  | 'navigates-to'
  | 'transitions-to'
  | 'uses-asset'
  | 'derived-from'
  | 'custom'

export type FroamRelation = {
  id: FroamId
  kind: FroamRelationKind
  from: FroamId
  to: FroamId
  label?: string
  condition?: string
  metadata?: Record<string, unknown>
}

export type FroamTimelineKeyframe = {
  at: number
  values: Record<string, string | number>
  easing?: string
}

export type FroamInteraction = {
  id: FroamId
  name: string
  sourceId: FroamId
  targetIds: FroamId[]
  trigger: 'load' | 'hover' | 'press' | 'click' | 'focus' | 'scroll' | 'drag' | 'custom'
  fromState?: string
  toState?: string
  timeline: FroamTimelineKeyframe[]
  durationMs?: number
  delayMs?: number
  physics?: { preset?: string; stiffness?: number; damping?: number; mass?: number }
  feedback?: { soundAssetId?: FroamId; haptic?: string }
  metadata?: Record<string, unknown>
}

export type FroamFlow = {
  id: FroamId
  name: string
  nodeIds: FroamId[]
  edgeIds: FroamId[]
  entryNodeId?: FroamId
  metadata?: Record<string, unknown>
}

export type FroamDNA = {
  nodeId: FroamId
  capturedAt: number
  structure?: Record<string, unknown>
  layout?: Record<string, unknown>
  visual?: Record<string, unknown>
  behavior?: Record<string, unknown>
  motion?: Record<string, unknown>
  responsive?: Record<string, unknown>
  accessibility?: Record<string, unknown>
  provenance?: Record<string, unknown>
}

export type FroamAsset = {
  id: FroamId
  kind: 'image' | 'video' | 'audio' | 'font' | 'icon' | 'document' | 'other'
  name: string
  url?: string
  mimeType?: string
  hash?: string
  metadata?: Record<string, unknown>
}

/** A materialized view. Events are canonical; this shape makes reads fast. */
export type FroamProjectState = {
  legacyStore: EditorStore
  nodes: Record<FroamId, FroamNode>
  relations: Record<FroamId, FroamRelation>
  flows: Record<FroamId, FroamFlow>
  interactions: Record<FroamId, FroamInteraction>
  dna: Record<FroamId, FroamDNA>
  assets: Record<FroamId, FroamAsset>
}

export type FroamProjectEventType =
  | 'design.store.replaced'
  | 'design.op.appended'
  | 'node.upserted'
  | 'node.removed'
  | 'relation.upserted'
  | 'relation.removed'
  | 'flow.upserted'
  | 'flow.removed'
  | 'interaction.upserted'
  | 'interaction.removed'
  | 'dna.captured'
  | 'asset.upserted'
  | 'asset.removed'

export type FroamProjectEventPayload =
  | { store: EditorStore }
  | { op: FroamOp }
  | { node: FroamNode }
  | { nodeId: FroamId }
  | { relation: FroamRelation }
  | { relationId: FroamId }
  | { flow: FroamFlow }
  | { flowId: FroamId }
  | { interaction: FroamInteraction }
  | { interactionId: FroamId }
  | { dna: FroamDNA }
  | { asset: FroamAsset }
  | { assetId: FroamId }

export type FroamProjectEvent = {
  schemaVersion: typeof FROAM_PROJECT_SCHEMA_VERSION
  id: FroamId
  projectId: FroamId
  branchId: FroamId
  actorId: FroamActorId
  clock: number
  createdAt: number
  type: FroamProjectEventType
  targetIds: FroamId[]
  payload: FroamProjectEventPayload
  batchId?: FroamId
  label?: string
}

export type FroamCheckpoint = {
  id: FroamId
  projectId: FroamId
  branchId: FroamId
  createdAt: number
  createdBy: FroamActorId
  label?: string
  /** Events already folded into state. Late events remain detectable and replayable. */
  eventIds: FroamId[]
  state: FroamProjectState
}

export type FroamBranch = {
  id: FroamId
  name: string
  parentBranchId: FroamId | null
  forkEventId: FroamId | null
  baseCheckpointId: FroamId
  headEventId: FroamId | null
  createdAt: number
  createdBy: FroamActorId
}

export type FroamProjectDocument = {
  schemaVersion: typeof FROAM_PROJECT_SCHEMA_VERSION
  id: FroamId
  name: string
  activeBranchId: FroamId
  createdAt: number
  updatedAt: number
  branches: Record<FroamId, FroamBranch>
  checkpoints: Record<FroamId, FroamCheckpoint>
  events: FroamProjectEvent[]
  metadata?: Record<string, unknown>
}
