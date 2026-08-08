import type { FroamInteraction } from './types';
export type FroamInteractionBindingRole = {
    role: string;
    originalNodeId?: string;
    required: boolean;
    semantics?: string;
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
        projectId: string;
        branchId: string;
        createdAt: number;
        sourceInteractionId?: string;
        provider?: string;
    };
    metadata?: Record<string, unknown>;
};
export type FroamInteractionLibrary = Record<string, FroamInteractionRecipe>;
export declare function saveInteractionRecipe(library: FroamInteractionLibrary, recipe: FroamInteractionRecipe): {
    [x: string]: FroamInteractionRecipe;
};
export declare function renameInteractionRecipe(library: FroamInteractionLibrary, id: string, name: string): FroamInteractionLibrary;
export declare function duplicateInteractionRecipe(library: FroamInteractionLibrary, id: string, nextId: string): FroamInteractionLibrary;
export declare function deleteInteractionRecipe(library: FroamInteractionLibrary, id: string): {
    [x: string]: FroamInteractionRecipe;
};
export declare function applyInteractionRecipe(recipe: FroamInteractionRecipe, binding: {
    sourceId: string;
    targetIds: Record<string, string>;
}): FroamInteraction;
//# sourceMappingURL=interaction-library.d.ts.map