import type { FroamDNA } from './types'

export type FroamComponentFamilyEvidence = { id: string; memberNodeIds: string[]; signature: string; confidence: number; explicit?: boolean }
export type FroamFactoredComponentFamily = { definitionId: string; memberNodeIds: string[]; sharedDna: Partial<FroamDNA>; instanceOverrides: Record<string, Partial<FroamDNA>>; evidence: { signature: string; confidence: number; explicit: boolean } }
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
/** Only high-confidence observed families or explicit user choices are factored. */
export function factorComponentFamilies(families: readonly FroamComponentFamilyEvidence[], dna: Record<string, FroamDNA>, threshold = .85): FroamFactoredComponentFamily[] {
  return families.filter((family) => family.explicit || family.confidence >= threshold).map((family) => {
    const members = family.memberNodeIds.map((id) => dna[id]).filter(Boolean); const first = members[0]; const keys: Array<keyof FroamDNA> = ['identity','structure','layout','visual','semantics','behavior','motion','responsive','accessibility','provenance','history','usage','knowledge']; const sharedDna: Partial<FroamDNA> = {}; const instanceOverrides: Record<string, Partial<FroamDNA>> = {}
    if (first) for (const key of keys) if (members.every((item) => equal(item[key], first[key]))) (sharedDna as Record<string, unknown>)[key] = first[key]
    for (const member of members) { const overrides: Record<string, unknown> = {}; for (const key of keys) if (!(key in sharedDna) && member[key] !== undefined) overrides[key] = member[key]; instanceOverrides[member.nodeId] = overrides }
    return { definitionId: `component-definition:${family.id}`, memberNodeIds: family.memberNodeIds, sharedDna, instanceOverrides, evidence: { signature: family.signature, confidence: family.confidence, explicit: Boolean(family.explicit) } }
  })
}

