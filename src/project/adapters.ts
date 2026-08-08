import type { EditorStore, FroamOp } from '../collab/types'
import type { FroamWireframeSection } from '../editor/FroamPlannerTypes'
import { createProjectDocument, emptyProjectState } from './event-log'
import { FROAM_PROJECT_SCHEMA_VERSION } from './types'
import type {
  FroamNode,
  FroamProjectDocument,
  FroamProjectEvent,
  FroamProjectState,
  FroamRelation,
} from './types'
import type { FroamNodeRegistry } from './node-registry'

/** Carries today's proven field operations into project history unchanged. */
export function legacyOpsToProjectEvents(
  ops: readonly FroamOp[],
  input: { projectId: string; branchId: string },
): FroamProjectEvent[] {
  return ops.map((op) => ({
    schemaVersion: FROAM_PROJECT_SCHEMA_VERSION,
    id: op.id,
    projectId: input.projectId,
    branchId: input.branchId,
    actorId: op.actor,
    clock: op.clock,
    createdAt: op.ts,
    type: 'design.op.appended',
    targetIds: op.nodeId ? [op.nodeId] : [],
    payload: { op },
    batchId: op.batch,
    label: op.label,
  }))
}

export function createProjectFromLegacyStore(input: {
  projectId: string
  name: string
  actorId: string
  store: EditorStore
  now?: number
  idFactory?: () => string
}) {
  const initialState: FroamProjectState = { ...emptyProjectState(), legacyStore: input.store }
  return createProjectDocument({ ...input, id: input.projectId, initialState })
}

export type LegacySitePage = {
  id: string
  name: string
  path: string
  parentId: string | null
  status: string
  sections: FroamWireframeSection[]
}

/** Converts the current Site Planner tree into graph records without changing its UI storage. */
export function sitePlanGraphRecords(pages: readonly LegacySitePage[]) {
  const nodes: FroamNode[] = []
  const relations: FroamRelation[] = []
  for (const page of pages) {
    nodes.push({
      id: page.id,
      kind: 'page',
      name: page.name,
      parentId: page.parentId,
      source: 'froam',
      locator: { routeKey: page.path },
      metadata: { status: page.status },
    })
    if (page.parentId) {
      relations.push({ id: `contains:${page.parentId}:${page.id}`, kind: 'contains', from: page.parentId, to: page.id })
    }
    for (const section of page.sections) {
      nodes.push({
        id: section.id,
        kind: 'frame',
        name: section.name,
        parentId: page.id,
        componentId: section.componentId,
        source: 'froam',
        metadata: { frame: section.frame },
      })
      relations.push({ id: `contains:${page.id}:${section.id}`, kind: 'contains', from: page.id, to: section.id })
      if (section.componentId) {
        relations.push({ id: `instance:${section.id}:${section.componentId}`, kind: 'instance-of', from: section.id, to: section.componentId })
      }
    }
  }
  return { nodes, relations }
}

export function withActiveBranch(document: FroamProjectDocument, activeBranchId: string) {
  if (!document.branches[activeBranchId]) throw new Error(`Unknown Froam branch: ${activeBranchId}`)
  return { ...document, activeBranchId }
}

/** Materialize inspected DOM identities into the shared graph vocabulary. */
export function nodeRegistryGraphRecords(registry: FroamNodeRegistry): { nodes: FroamNode[]; relations: FroamRelation[] } {
  const nodes = Object.values(registry).map<FroamNode>((entry) => ({
    id: entry.nodeId,
    kind: 'element',
    name: entry.fingerprint?.id || entry.fingerprint?.text?.slice(0, 40) || entry.fingerprint?.tag || entry.nodeId,
    source: entry.source,
    locator: {
      path: entry.path,
      fingerprint: entry.fingerprint,
      routeKey: entry.routeKey,
      viewport: entry.viewport,
    },
    metadata: { lastResolution: entry.lastResolution, recoveryCount: entry.recoveryCount ?? 0 },
  }))
  const pageIds = new Set(nodes.map((node) => node.locator?.routeKey).filter((value): value is string => Boolean(value)))
  const pageNodes = [...pageIds].map<FroamNode>((routeKey) => ({ id: `page:${routeKey}`, kind: 'page', name: routeKey, source: 'froam', locator: { routeKey } }))
  const relations = nodes.flatMap<FroamRelation>((node) => node.locator?.routeKey ? [{
    id: `contains:page:${node.locator.routeKey}:${node.id}`,
    kind: 'contains',
    from: `page:${node.locator.routeKey}`,
    to: node.id,
  }] : [])
  return { nodes: [...pageNodes, ...nodes], relations }
}
