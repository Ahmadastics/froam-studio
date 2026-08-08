import type { FroamInteraction } from './types'

export type FroamInteractionBindingRole = { role: string; originalNodeId?: string; required: boolean; semantics?: string }
export type FroamInteractionRecipe = { id: string; name: string; interaction: FroamInteraction; bindings: { source: FroamInteractionBindingRole; targets: FroamInteractionBindingRole[] }; provenance: { kind: 'native' | 'sampled'; projectId: string; branchId: string; createdAt: number; sourceInteractionId?: string; provider?: string }; metadata?: Record<string, unknown> }
export type FroamInteractionLibrary = Record<string, FroamInteractionRecipe>

export function saveInteractionRecipe(library: FroamInteractionLibrary, recipe: FroamInteractionRecipe) { return { ...library, [recipe.id]: structuredClone(recipe) } }
export function renameInteractionRecipe(library: FroamInteractionLibrary, id: string, name: string) { if (!library[id] || !name.trim()) return library; return { ...library, [id]: { ...library[id], name: name.trim().slice(0, 80) } } }
export function duplicateInteractionRecipe(library: FroamInteractionLibrary, id: string, nextId: string) { const source = library[id]; if (!source || library[nextId]) return library; return saveInteractionRecipe(library, { ...source, id: nextId, name: `${source.name} copy`, interaction: { ...source.interaction, id: nextId } }) }
export function deleteInteractionRecipe(library: FroamInteractionLibrary, id: string) { const next = { ...library }; delete next[id]; return next }
export function applyInteractionRecipe(recipe: FroamInteractionRecipe, binding: { sourceId: string; targetIds: Record<string, string> }): FroamInteraction {
  const missing = recipe.bindings.targets.filter((target) => target.required && !binding.targetIds[target.role]); if (missing.length) throw new Error(`Missing interaction bindings: ${missing.map((item) => item.role).join(', ')}`)
  return { ...structuredClone(recipe.interaction), id: `${recipe.id}:applied:${binding.sourceId}`, sourceId: binding.sourceId, targetIds: recipe.bindings.targets.map((target) => binding.targetIds[target.role]).filter(Boolean), metadata: { ...recipe.interaction.metadata, recipeId: recipe.id, bindings: binding.targetIds, provenance: recipe.provenance } }
}

