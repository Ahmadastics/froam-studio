/**
 * Browser storage is shared by every page served from the same origin. Froam's
 * proxy normally lives at localhost:4600, so the origin alone cannot identify
 * a project. The bridge supplies an opaque project key; embedded integrations
 * can pass their own key through FroamGate.
 */
export declare function normalizeFroamProjectKey(value: string | null | undefined): string;
export declare function fallbackFroamProjectKey(): string;
export declare function resolveFroamProjectKey(value?: string | null): string;
export declare function froamStorageKey(baseKey: string, projectKey: string): string;
export declare function froamProjectId(projectKey: string): string;
//# sourceMappingURL=storage-scope.d.ts.map