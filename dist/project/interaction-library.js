export function saveInteractionRecipe(library, recipe) { return { ...library, [recipe.id]: structuredClone(recipe) }; }
export function renameInteractionRecipe(library, id, name) { if (!library[id] || !name.trim())
    return library; return { ...library, [id]: { ...library[id], name: name.trim().slice(0, 80) } }; }
export function duplicateInteractionRecipe(library, id, nextId) { const source = library[id]; if (!source || library[nextId])
    return library; return saveInteractionRecipe(library, { ...source, id: nextId, name: `${source.name} copy`, interaction: { ...source.interaction, id: nextId } }); }
export function deleteInteractionRecipe(library, id) { const next = { ...library }; delete next[id]; return next; }
export function applyInteractionRecipe(recipe, binding) {
    const missing = recipe.bindings.targets.filter((target) => target.required && !binding.targetIds[target.role]);
    if (missing.length)
        throw new Error(`Missing interaction bindings: ${missing.map((item) => item.role).join(', ')}`);
    return { ...structuredClone(recipe.interaction), id: `${recipe.id}:applied:${binding.sourceId}`, sourceId: binding.sourceId, targetIds: recipe.bindings.targets.map((target) => binding.targetIds[target.role]).filter(Boolean), metadata: { ...recipe.interaction.metadata, recipeId: recipe.id, bindings: binding.targetIds, provenance: recipe.provenance } };
}
//# sourceMappingURL=interaction-library.js.map