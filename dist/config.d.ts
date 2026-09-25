export type FroamAuthUser = {
    email?: string | null;
} | null;
export type FroamAuthProvider = () => FroamAuthUser | Promise<FroamAuthUser>;
export type FroamStudioConfig = {
    apiBaseUrl?: string;
    authProvider?: FroamAuthProvider;
    enabled?: boolean;
    fetch?: typeof globalThis.fetch;
    ownerEmails?: readonly string[];
    rootSelector?: string | (() => HTMLElement | null);
    /** 'page' when the whole <body> is the editable root (see designRootScope in lib/codegen.mjs). */
    rootScope?: 'page' | 'auto';
    runtimeRoutes?: readonly string[] | '*';
};
export declare function configureFroamStudio(next?: FroamStudioConfig): FroamStudioConfig;
export declare function getFroamStudioConfig(): FroamStudioConfig;
export declare function resetFroamStudioConfig(): void;
export declare function normalizeOwnerEmails(value?: readonly string[] | string | null): any[];
export declare function getFroamRootElement(): HTMLElement | null;
//# sourceMappingURL=config.d.ts.map