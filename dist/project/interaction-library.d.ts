import type { FroamInteraction, FroamTimelineKeyframe } from './types';
export type FroamInteractionBindingRole = {
    role: string;
    originalNodeId?: string;
    required: boolean;
    semantics?: string;
    compatibleKinds?: string[];
};
export type FroamInteractionRecipe = {
    id: string;
    name: string;
    interaction: FroamInteraction;
    bindings: {
        source: FroamInteractionBindingRole;
        targets: FroamInteractionBindingRole[];
    };
    provenance: {
        kind: 'native' | 'sampled';
        source: 'froam' | 'external';
        projectId: string;
        branchId: string;
        createdAt: number;
        sourceInteractionId?: string;
        provider?: string;
        confidence?: number;
        unsupportedEffects?: string[];
        originalImplementation: 'froam' | 'unknown';
    };
    category?: string;
    tags?: string[];
    description?: string;
    responsive?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
};
export type FroamInteractionLibrary = Record<string, FroamInteractionRecipe>;
export type FroamInteractionBinding = {
    sourceId: string;
    targetIds: Record<string, string>;
};
export type FroamInteractionPreviewFrame = {
    atMs: number;
    progress: number;
    values: Record<string, string | number>;
};
export declare function saveInteractionRecipe(library: FroamInteractionLibrary, recipe: FroamInteractionRecipe): {
    [x: string]: FroamInteractionRecipe;
};
export declare function renameInteractionRecipe(library: FroamInteractionLibrary, id: string, name: string): FroamInteractionLibrary;
export declare function updateInteractionRecipe(library: FroamInteractionLibrary, id: string, patch: Partial<Pick<FroamInteractionRecipe, 'name' | 'category' | 'tags' | 'description' | 'responsive' | 'metadata'>> & {
    interaction?: Partial<FroamInteraction>;
}): FroamInteractionLibrary;
export declare function duplicateInteractionRecipe(library: FroamInteractionLibrary, id: string, nextId: string): FroamInteractionLibrary;
export declare function deleteInteractionRecipe(library: FroamInteractionLibrary, id: string): {
    [x: string]: FroamInteractionRecipe;
};
export declare function searchInteractionLibrary(library: FroamInteractionLibrary, input?: {
    query?: string;
    category?: string;
    provenance?: FroamInteractionRecipe['provenance']['kind'];
    trigger?: FroamInteraction['trigger'];
}): FroamInteractionRecipe[];
export declare function interactionCategories(library: FroamInteractionLibrary): string[];
export declare function validateInteractionBinding(recipe: FroamInteractionRecipe, binding: FroamInteractionBinding): {
    valid: boolean;
    missingRoles: string[];
};
export declare function applyInteractionRecipe(recipe: FroamInteractionRecipe, binding: FroamInteractionBinding): FroamInteraction;
export declare function saveReusableBinding(recipe: FroamInteractionRecipe, binding: FroamInteractionBinding, name: string): {
    name: string;
    recipeId: string;
    binding: FroamInteractionBinding;
    createdAt: number;
};
export declare function previewInteractionRecipe(recipe: FroamInteractionRecipe, controls?: {
    durationMs?: number;
    delayMs?: number;
    distance?: number;
    scale?: number;
    blur?: number;
    samples?: number;
}): FroamInteractionPreviewFrame[];
export declare function trimInteractionTimeline(timeline: readonly FroamTimelineKeyframe[], start: number, end: number): {
    at: number;
    values: Record<string, string | number>;
    easing?: string;
}[];
//# sourceMappingURL=interaction-library.d.ts.map