export type FroamUIDensity = 'compact' | 'comfortable';
export type FroamUIAppearance = 'graphite' | 'midnight' | 'glass';
export type FroamUIAccent = 'mint' | 'blue' | 'violet' | 'coral';
export type FroamUIPanelLayout = 'standard' | 'mirrored';
export type FroamUIToolbarPosition = 'top' | 'bottom';
export type FroamUIWorkspacePosition = 'attached' | 'floating-bottom';
export type FroamUIPanelSize = 'narrow' | 'standard' | 'wide';
export type FroamUIPreference = {
    version: 1;
    toolbar: FroamUIToolbarPosition;
    workspace: FroamUIWorkspacePosition;
    panels: FroamUIPanelLayout;
    density: FroamUIDensity;
    appearance: FroamUIAppearance;
    accent: FroamUIAccent;
    leftSize: FroamUIPanelSize;
    inspectorSize: FroamUIPanelSize;
    scale: 0.9 | 1 | 1.1;
    labels: boolean;
};
export declare const FROAM_UI_PREFERENCE_KEY = "froam-ui-preference-v2";
export declare const DEFAULT_FROAM_UI_PREFERENCE: FroamUIPreference;
export declare function sanitizeFroamUIPreference(value: unknown): FroamUIPreference;
export declare function readFroamUIPreference(storage?: Pick<Storage, 'getItem'>): FroamUIPreference;
export declare function writeFroamUIPreference(storage: Pick<Storage, 'setItem'> | undefined, preference: FroamUIPreference): boolean;
export declare function froamUIPanelWidth(size: FroamUIPanelSize, kind: 'left' | 'inspector'): number;
//# sourceMappingURL=froamUIPreferences.d.ts.map