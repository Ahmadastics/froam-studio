import type { FroamComponentFamily, FroamDesignMode, FroamDesignSystem, FroamDesignVariable, FroamLibrary, FroamReusableStyle, FroamSiteKit, FroamStyleState } from './types';
export declare function emptyDesignSystem(): FroamDesignSystem;
export declare function normalizeDesignSystem(value?: Partial<FroamDesignSystem>): FroamDesignSystem;
export declare function resolveDesignVariable(system: FroamDesignSystem, variableId: string, modeIds?: string[], seen?: Set<string>): string | undefined;
export declare function upsertDesignVariable(system: FroamDesignSystem, variable: FroamDesignVariable): {
    variables: {
        [x: string]: FroamDesignVariable;
    };
    schemaVersion: 1;
    activeModeIds: import("./types").FroamId[];
    modes: Record<import("./types").FroamId, FroamDesignMode>;
    styles: Record<import("./types").FroamId, FroamReusableStyle>;
    componentFamilies: Record<import("./types").FroamId, FroamComponentFamily>;
    siteKits: Record<import("./types").FroamId, FroamSiteKit>;
    libraries: Record<import("./types").FroamId, FroamLibrary>;
};
export declare function setActiveModes(system: FroamDesignSystem, modeIds: string[]): {
    activeModeIds: string[];
    schemaVersion: 1;
    modes: Record<import("./types").FroamId, FroamDesignMode>;
    variables: Record<import("./types").FroamId, FroamDesignVariable>;
    styles: Record<import("./types").FroamId, FroamReusableStyle>;
    componentFamilies: Record<import("./types").FroamId, FroamComponentFamily>;
    siteKits: Record<import("./types").FroamId, FroamSiteKit>;
    libraries: Record<import("./types").FroamId, FroamLibrary>;
};
export declare function designVariableCss(system: FroamDesignSystem, modeIds?: string[]): string;
export declare function createReusableStyle(input: {
    id: string;
    name: string;
    category?: string;
    states: Partial<Record<FroamStyleState, Record<string, string>>>;
    now?: number;
}): FroamReusableStyle;
export declare function saveReusableStyle(system: FroamDesignSystem, style: FroamReusableStyle): {
    styles: {
        [x: string]: FroamReusableStyle;
    };
    schemaVersion: 1;
    activeModeIds: import("./types").FroamId[];
    modes: Record<import("./types").FroamId, FroamDesignMode>;
    variables: Record<import("./types").FroamId, FroamDesignVariable>;
    componentFamilies: Record<import("./types").FroamId, FroamComponentFamily>;
    siteKits: Record<import("./types").FroamId, FroamSiteKit>;
    libraries: Record<import("./types").FroamId, FroamLibrary>;
};
export declare function recordStyleUse(system: FroamDesignSystem, styleId: string, nodeId: string): FroamDesignSystem;
export declare function upsertComponentFamily(system: FroamDesignSystem, family: FroamComponentFamily): {
    componentFamilies: {
        [x: string]: FroamComponentFamily;
    };
    schemaVersion: 1;
    activeModeIds: import("./types").FroamId[];
    modes: Record<import("./types").FroamId, FroamDesignMode>;
    variables: Record<import("./types").FroamId, FroamDesignVariable>;
    styles: Record<import("./types").FroamId, FroamReusableStyle>;
    siteKits: Record<import("./types").FroamId, FroamSiteKit>;
    libraries: Record<import("./types").FroamId, FroamLibrary>;
};
export declare function createSiteKit(input: Omit<FroamSiteKit, 'createdAt' | 'updatedAt' | 'version'> & {
    now?: number;
}): FroamSiteKit;
export declare function upsertSiteKit(system: FroamDesignSystem, kit: FroamSiteKit): {
    siteKits: {
        [x: string]: FroamSiteKit;
    };
    schemaVersion: 1;
    activeModeIds: import("./types").FroamId[];
    modes: Record<import("./types").FroamId, FroamDesignMode>;
    variables: Record<import("./types").FroamId, FroamDesignVariable>;
    styles: Record<import("./types").FroamId, FroamReusableStyle>;
    componentFamilies: Record<import("./types").FroamId, FroamComponentFamily>;
    libraries: Record<import("./types").FroamId, FroamLibrary>;
};
export declare function installLibrary(system: FroamDesignSystem, library: FroamLibrary): {
    libraries: {
        [x: string]: FroamLibrary;
    };
    schemaVersion: 1;
    activeModeIds: import("./types").FroamId[];
    modes: Record<import("./types").FroamId, FroamDesignMode>;
    variables: Record<import("./types").FroamId, FroamDesignVariable>;
    styles: Record<import("./types").FroamId, FroamReusableStyle>;
    componentFamilies: Record<import("./types").FroamId, FroamComponentFamily>;
    siteKits: Record<import("./types").FroamId, FroamSiteKit>;
};
export declare function publishLibraryRelease(system: FroamDesignSystem, libraryId: string, notes?: string, at?: number): FroamDesignSystem;
export declare function decideLibraryUpdate(system: FroamDesignSystem, libraryId: string, decision: 'accept' | 'postpone', at?: number): FroamDesignSystem;
export declare function seedStarterDesignSystem(system?: FroamDesignSystem, at?: number): FroamDesignSystem;
//# sourceMappingURL=design-system.d.ts.map