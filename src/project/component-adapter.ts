import type { FroamNode, FroamRelation } from './types'

export type FroamComponentDescriptor = {
  id: string
  title: string
  category?: string
  summary?: string
  anatomy?: readonly string[]
}

/** Projects today's catalog metadata into the shared graph without changing its factories. */
export function componentCatalogGraphRecords(definitions: readonly FroamComponentDescriptor[]) {
  const nodes: FroamNode[] = definitions.map((definition) => ({
    id: definition.id,
    kind: 'component-definition',
    name: definition.title,
    source: 'froam',
    metadata: {
      category: definition.category,
      summary: definition.summary,
      anatomy: definition.anatomy ? [...definition.anatomy] : undefined,
    },
  }))
  const relations: FroamRelation[] = []
  return { nodes, relations }
}

