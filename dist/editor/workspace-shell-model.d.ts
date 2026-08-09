import type { FroamLabsFlags } from '../project/experiments';
export type FroamWorkspaceMode = 'create' | 'understand' | 'experiment';
export type FroamWorkspaceMaturity = 'production' | 'beta' | 'experimental' | 'research' | 'advanced';
export type FroamTemporalOwner = 'animator' | 'replay' | 'sampling' | 'breakpoint-cinema' | 'trailer' | null;
export type FroamWorkspaceSection = 'design' | 'plan' | 'layers' | 'blueprint' | 'animator' | 'interactions-create' | 'responsive-create' | 'scan' | 'dna' | 'archive' | 'archaeology' | 'flow' | 'attention' | 'rhythm' | 'responsive' | 'screenshot' | 'laboratory' | 'mutate' | 'sample' | 'interactions' | 'physics' | 'gravity' | 'break' | 'test-user' | 'sound' | 'trailer' | 'reality' | 'replay' | 'prototypes' | 'advanced';
export type FroamWorkspaceSectionDefinition = {
    id: FroamWorkspaceSection;
    mode: FroamWorkspaceMode;
    label: string;
    description: string;
    maturity: FroamWorkspaceMaturity;
    requiresSelection?: boolean;
    labFlag?: keyof FroamLabsFlags;
    temporalOwner?: Exclude<FroamTemporalOwner, null>;
    aliases?: string[];
};
export declare const FROAM_WORKSPACE_MODES: ReadonlyArray<{
    id: FroamWorkspaceMode;
    label: string;
    promise: string;
}>;
export declare const FROAM_WORKSPACE_SECTIONS: readonly FroamWorkspaceSectionDefinition[];
export declare function workspaceSections(mode: FroamWorkspaceMode, flags: FroamLabsFlags, hasSelection: boolean): {
    contextual: boolean;
    id: FroamWorkspaceSection;
    mode: FroamWorkspaceMode;
    label: string;
    description: string;
    maturity: FroamWorkspaceMaturity;
    requiresSelection?: boolean;
    labFlag?: keyof FroamLabsFlags;
    temporalOwner?: Exclude<FroamTemporalOwner, null>;
    aliases?: string[];
}[];
export declare function workspaceModeForSection(section: FroamWorkspaceSection): FroamWorkspaceMode;
export declare function workspaceProjectLabel(projectName: string, branchName: string, branchId: string): {
    projectName: string;
    branchName: string;
    prototype: boolean;
    label: string;
};
export declare function workspaceStatus(input: {
    mode: FroamWorkspaceMode;
    branchName: string;
    branchId: string;
    activity?: 'scanning' | 'screenshot' | 'mutating' | 'chaos' | 'synthetic' | null;
    sampling?: boolean;
    replay?: boolean;
    physics?: boolean;
}): {
    label: string;
    tone: "prototype";
} | {
    label: string;
    tone: "warning";
} | {
    label: string;
    tone: "research";
} | {
    label: string;
    tone: "live";
} | {
    label: string;
    tone: "create" | "understand" | "experiment";
};
export declare function workspaceCommandMatches(section: FroamWorkspaceSectionDefinition, query: string): boolean;
export declare function workspacePresenceSummary<T extends {
    actor: string;
    name: string;
}>(members: T[], limit?: number): {
    visible: T[];
    overflow: number;
    accessibleLabel: string;
};
export declare function workspaceTemporalSurface(owner: FroamTemporalOwner): {
    owner: "replay" | "animator" | "breakpoint-cinema" | "trailer" | "sampling";
    label: string;
} | null;
export declare const FROAM_WORKSPACE_PREFERENCE_KEY = "froam-workspace-shell-v1";
export type FroamWorkspacePreference = {
    mode: FroamWorkspaceMode;
    sections: Partial<Record<FroamWorkspaceMode, FroamWorkspaceSection>>;
    advancedOpen: boolean;
};
export declare const defaultWorkspacePreference: () => FroamWorkspacePreference;
export declare function transitionWorkspacePreference(preference: FroamWorkspacePreference, mode: FroamWorkspaceMode, section?: FroamWorkspaceSection): FroamWorkspacePreference;
export declare function readWorkspacePreference(storage?: Pick<Storage, 'getItem'>): FroamWorkspacePreference;
export declare function writeWorkspacePreference(storage: Pick<Storage, 'setItem'> | undefined, preference: FroamWorkspacePreference): boolean;
//# sourceMappingURL=workspace-shell-model.d.ts.map