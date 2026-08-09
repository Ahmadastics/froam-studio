export function saveInteractionRecipe(library, recipe) { if (!recipe.id || !recipe.name.trim())
    throw new Error('Interaction recipes need an ID and name'); return { ...library, [recipe.id]: structuredClone(recipe) }; }
export function renameInteractionRecipe(library, id, name) { if (!library[id] || !name.trim())
    return library; return { ...library, [id]: { ...library[id], name: name.trim().slice(0, 80) } }; }
export function updateInteractionRecipe(library, id, patch) { const recipe = library[id]; if (!recipe)
    return library; return { ...library, [id]: { ...recipe, ...patch, id, interaction: patch.interaction ? { ...recipe.interaction, ...patch.interaction, id: recipe.interaction.id } : recipe.interaction } }; }
export function duplicateInteractionRecipe(library, id, nextId) { const source = library[id]; if (!source || library[nextId])
    return library; return saveInteractionRecipe(library, { ...source, id: nextId, name: `${source.name} copy`, interaction: { ...source.interaction, id: nextId } }); }
export function deleteInteractionRecipe(library, id) { const next = { ...library }; delete next[id]; return next; }
export function searchInteractionLibrary(library, input = {}) { const query = input.query?.trim().toLocaleLowerCase(); return Object.values(library).filter((recipe) => (!query || [recipe.name, recipe.description, recipe.category, ...(recipe.tags ?? [])].some((value) => value?.toLocaleLowerCase().includes(query))) && (!input.category || recipe.category === input.category) && (!input.provenance || recipe.provenance.kind === input.provenance) && (!input.trigger || recipe.interaction.trigger === input.trigger)).sort((a, b) => a.name.localeCompare(b.name)); }
export function interactionCategories(library) { return [...new Set(Object.values(library).map((recipe) => recipe.category).filter((value) => Boolean(value)))].sort(); }
export function validateInteractionBinding(recipe, binding) {
    const missing = recipe.bindings.targets.filter((target) => target.required && !binding.targetIds[target.role]);
    const sourceMissing = recipe.bindings.source.required && !binding.sourceId;
    return { valid: !sourceMissing && !missing.length, missingRoles: [...(sourceMissing ? [recipe.bindings.source.role] : []), ...missing.map((item) => item.role)] };
}
export function applyInteractionRecipe(recipe, binding) {
    const validation = validateInteractionBinding(recipe, binding);
    if (!validation.valid)
        throw new Error(`Missing interaction bindings: ${validation.missingRoles.join(', ')}`);
    return { ...structuredClone(recipe.interaction), id: `${recipe.id}:applied:${binding.sourceId}`, sourceId: binding.sourceId, targetIds: recipe.bindings.targets.map((target) => binding.targetIds[target.role]).filter(Boolean), metadata: { ...recipe.interaction.metadata, recipeId: recipe.id, bindings: structuredClone(binding), provenance: recipe.provenance } };
}
export function saveReusableBinding(recipe, binding, name) { if (!validateInteractionBinding(recipe, binding).valid)
    throw new Error('Cannot save an incomplete interaction mapping'); return { name: name.trim().slice(0, 80), recipeId: recipe.id, binding: structuredClone(binding), createdAt: Date.now() }; }
function interpolate(a, b, progress) { return typeof a === 'number' && typeof b === 'number' ? a + (b - a) * progress : progress < .5 ? a ?? b : b ?? a; }
export function previewInteractionRecipe(recipe, controls = {}) {
    const keyframes = [...recipe.interaction.timeline].sort((a, b) => a.at - b.at);
    const duration = controls.durationMs ?? recipe.interaction.durationMs ?? 300;
    const samples = Math.max(2, Math.min(120, controls.samples ?? 12));
    const frames = [];
    for (let index = 0; index <= samples; index += 1) {
        const progress = index / samples;
        const before = [...keyframes].reverse().find((frame) => frame.at <= progress) ?? keyframes[0];
        const after = keyframes.find((frame) => frame.at >= progress) ?? keyframes.at(-1);
        const span = Math.max(.0001, (after?.at ?? 1) - (before?.at ?? 0));
        const local = Math.max(0, Math.min(1, (progress - (before?.at ?? 0)) / span));
        const keys = new Set([...Object.keys(before?.values ?? {}), ...Object.keys(after?.values ?? {})]);
        const values = Object.fromEntries([...keys].map((key) => [key, interpolate(before?.values[key], after?.values[key], local)]).filter(([, value]) => value !== undefined));
        if (controls.distance !== undefined)
            values['--froam-distance'] = controls.distance;
        if (controls.scale !== undefined)
            values['--froam-scale'] = controls.scale;
        if (controls.blur !== undefined)
            values['--froam-blur'] = controls.blur;
        frames.push({ atMs: (controls.delayMs ?? recipe.interaction.delayMs ?? 0) + progress * duration, progress, values: values });
    }
    return frames;
}
export function trimInteractionTimeline(timeline, start, end) { const low = Math.max(0, Math.min(start, end)); const high = Math.min(1, Math.max(start, end)); if (high <= low)
    throw new Error('Interaction trim range must have duration'); return timeline.filter((frame) => frame.at >= low && frame.at <= high).map((frame) => ({ ...frame, at: (frame.at - low) / (high - low) })); }
//# sourceMappingURL=interaction-library.js.map