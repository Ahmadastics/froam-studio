export type FroamVersionMeta = {
    id: string;
    name: string;
    description?: string | null;
    tags?: string[];
    notes?: string | null;
    changeSummary?: FroamChangeSummary | null;
    imageRefs?: FroamImageRef[];
    isLive: boolean;
    parentVersionId?: string | null;
    createdAt: string;
    localOnly?: boolean;
    routeKey?: string;
    viewportMode?: string;
};
export type FroamChangeSummary = {
    draftCount: number;
    insertedBlockCount: number;
    textCount: number;
    styleCount: number;
    imageCount: number;
    changedPaths?: string[];
};
export type FroamImageRef = {
    path: string;
    kind: 'image' | 'background';
    sha256?: string;
    size?: number;
    mime?: string | null;
    preview?: string;
};
export type LocalFroamVersion = FroamVersionMeta & {
    routeKey: string;
    viewportMode: string;
    store: Record<string, unknown>;
    localOnly: true;
};
export declare const LOCAL_VERSION_PREFIX = "local:";
export declare const LOCAL_VERSIONS_KEY = "froam:local-versions:v1";
export declare function readLocalVersions(projectKey: string): LocalFroamVersion[];
export declare function writeLocalVersions(projectKey: string, versions: LocalFroamVersion[]): void;
export declare function isLocalVersion(value: unknown): value is LocalFroamVersion;
export declare function getScopedLocalVersions(projectKey: string, routeKey: string, viewportMode: string): LocalFroamVersion[];
export declare function saveLocalVersion(projectKey: string, routeKey: string, viewportMode: string, store: Record<string, unknown>, name: string, description?: string, tags?: string[], notes?: string, changeSummary?: FroamChangeSummary, imageRefs?: FroamImageRef[]): LocalFroamVersion;
export declare function findLocalVersion(projectKey: string, versionId: string): LocalFroamVersion | null;
export declare function deleteLocalVersion(projectKey: string, versionId: string): void;
export declare function countInsertedBlocks(store: Record<string, unknown>): number;
export declare function summarizeStore(store: Record<string, unknown>): FroamChangeSummary;
export declare function extractImageRefs(store: Record<string, unknown>): FroamImageRef[];
/** This page's versions, newest first: kept here, and on the server when it answers. */
export declare function listRouteVersions(projectKey: string, routeKey: string, viewportMode: string): Promise<FroamVersionMeta[]>;
/** Keep this moment as a named version — on the server, or here if it can't be reached. */
export declare function createVersion(projectKey: string, routeKey: string, viewportMode: string, store: Record<string, unknown>, name: string): Promise<{
    id: string;
    local: boolean;
}>;
/** A version's page, to put back. */
export declare function fetchVersionStore(projectKey: string, versionId: string): Promise<Record<string, unknown> | null>;
//# sourceMappingURL=versions-store.d.ts.map