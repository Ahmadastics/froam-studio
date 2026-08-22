import type { FroamComponentFamily, FroamNode, FroamRelation } from './types'

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

/** Groups today's numbered catalog entries into inherited component families. */
export function componentCatalogFamilies(definitions: readonly FroamComponentDescriptor[], now = Date.now()): FroamComponentFamily[] {
  const groups = new Map<string, FroamComponentDescriptor[]>()
  for (const definition of definitions) {
    const familyId = definition.id.replace(/-\d+$/, '')
    groups.set(familyId, [...(groups.get(familyId) ?? []), definition])
  }
  return [...groups.entries()].map(([familyId, members]) => ({
    id: `family:${familyId}`,
    name: members[0]?.category ?? members[0]?.title ?? familyId,
    category: members[0]?.category ?? 'Component',
    baseComponentId: members[0].id,
    props: [
      { id: `${familyId}:content`, name: 'Content', kind: 'text', required: false },
      { id: `${familyId}:visible`, name: 'Visible', kind: 'boolean', defaultValue: true },
    ],
    slots: (members[0]?.anatomy ?? []).map((name, index) => ({ id: `${familyId}:slot:${index}`, name, accepts: ['element', 'component'] })),
    variants: members.map((member) => ({ id: member.id, name: member.title, propDefaults: { summary: member.summary ?? '' } })),
    createdAt: now,
    updatedAt: now,
    version: 1,
  }))
}
