import type { FroamNode, FroamProjectState, FroamRelation } from './types'

export type FroamGraphRow = {
  node: FroamNode
  depth: number
  incoming: FroamRelation[]
  outgoing: FroamRelation[]
}

export function graphSelectionIndex(state: FroamProjectState) {
  const byNodeId = new Map<string, FroamNode>()
  const byPath = new Map<string, FroamNode>()
  for (const node of Object.values(state.nodes)) {
    byNodeId.set(node.id, node)
    if (node.locator?.path) byPath.set(node.locator.path, node)
  }
  return { byNodeId, byPath }
}

/** Stable tree projection; disconnected nodes remain visible at the root. */
export function materializeGraphRows(state: FroamProjectState): FroamGraphRow[] {
  const nodes = Object.values(state.nodes)
  const relations = Object.values(state.relations)
  const children = new Map<string, FroamNode[]>()
  const incoming = new Map<string, FroamRelation[]>()
  const outgoing = new Map<string, FroamRelation[]>()
  const childIds = new Set<string>()
  for (const relation of relations) {
    incoming.set(relation.to, [...(incoming.get(relation.to) ?? []), relation])
    outgoing.set(relation.from, [...(outgoing.get(relation.from) ?? []), relation])
    if (relation.kind !== 'contains') continue
    const child = state.nodes[relation.to]
    if (!child || !state.nodes[relation.from]) continue
    children.set(relation.from, [...(children.get(relation.from) ?? []), child])
    childIds.add(child.id)
  }
  const rows: FroamGraphRow[] = []
  const seen = new Set<string>()
  const visit = (node: FroamNode, depth: number) => {
    if (seen.has(node.id)) return
    seen.add(node.id)
    rows.push({
      node,
      depth,
      incoming: incoming.get(node.id) ?? [],
      outgoing: outgoing.get(node.id) ?? [],
    })
    for (const child of (children.get(node.id) ?? []).sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id))) visit(child, depth + 1)
  }
  for (const root of nodes.filter((node) => !childIds.has(node.id)).sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id))) visit(root, 0)
  for (const node of nodes) visit(node, 0)
  return rows
}
