/**
 * Named versions of a page: where they're kept and how they come back.
 *
 * Shared by the Versions panel (tags, notes, compare, go live) and the History
 * timeline (name this moment, restore) — one store, one format. A version is
 * kept by the server when there is one (/api/froam/versions), and in this
 * browser when there isn't.
 */
import { apiGetFresh, apiPost } from '../lib/api.js';
import { froamStorageKey } from '../project/storage-scope.js';
export const LOCAL_VERSION_PREFIX = 'local:';
export const LOCAL_VERSIONS_KEY = 'froam:local-versions:v1';
export function readLocalVersions(projectKey) {
    if (typeof window === 'undefined')
        return [];
    try {
        const raw = window.localStorage.getItem(froamStorageKey(LOCAL_VERSIONS_KEY, projectKey));
        if (!raw)
            return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter(isLocalVersion) : [];
    }
    catch {
        return [];
    }
}
export function writeLocalVersions(projectKey, versions) {
    if (typeof window === 'undefined')
        return;
    window.localStorage.setItem(froamStorageKey(LOCAL_VERSIONS_KEY, projectKey), JSON.stringify(versions.slice(0, 80)));
}
export function isLocalVersion(value) {
    if (!value || typeof value !== 'object')
        return false;
    const candidate = value;
    return (typeof candidate.id === 'string' &&
        candidate.id.startsWith(LOCAL_VERSION_PREFIX) &&
        typeof candidate.name === 'string' &&
        typeof candidate.routeKey === 'string' &&
        typeof candidate.viewportMode === 'string' &&
        typeof candidate.createdAt === 'string' &&
        !!candidate.store &&
        typeof candidate.store === 'object' &&
        !Array.isArray(candidate.store));
}
export function getScopedLocalVersions(projectKey, routeKey, viewportMode) {
    return readLocalVersions(projectKey)
        .filter((version) => version.routeKey === routeKey && version.viewportMode === viewportMode)
        .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
export function saveLocalVersion(projectKey, routeKey, viewportMode, store, name, description, tags = [], notes, changeSummary, imageRefs) {
    const version = {
        id: `${LOCAL_VERSION_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        routeKey,
        viewportMode,
        store,
        name,
        description: description || null,
        tags,
        notes: notes || null,
        changeSummary: changeSummary ?? summarizeStore(store),
        imageRefs: imageRefs ?? extractImageRefs(store),
        isLive: false,
        parentVersionId: null,
        createdAt: new Date().toISOString(),
        localOnly: true,
    };
    writeLocalVersions(projectKey, [version, ...readLocalVersions(projectKey)]);
    return version;
}
export function findLocalVersion(projectKey, versionId) {
    return readLocalVersions(projectKey).find((version) => version.id === versionId) ?? null;
}
export function deleteLocalVersion(projectKey, versionId) {
    writeLocalVersions(projectKey, readLocalVersions(projectKey).filter((version) => version.id !== versionId));
}
export function countInsertedBlocks(store) {
    return Object.keys(store).filter((key) => key.startsWith('__froam_injection__:')).length;
}
function isDraft(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function readBackgroundImageUrl(value) {
    const match = value.match(/url\((['"]?)(.*?)\1\)/i);
    return match?.[2] ?? null;
}
export function summarizeStore(store) {
    const changedPaths = Object.keys(store);
    let textCount = 0;
    let styleCount = 0;
    let imageCount = 0;
    for (const draftValue of Object.values(store)) {
        if (!isDraft(draftValue))
            continue;
        if (typeof draftValue.text === 'string')
            textCount += 1;
        if (typeof draftValue.imageUrl === 'string')
            imageCount += 1;
        if (draftValue.styles && typeof draftValue.styles === 'object' && !Array.isArray(draftValue.styles)) {
            const styles = draftValue.styles;
            styleCount += Object.keys(styles).length;
            if (typeof styles.backgroundImage === 'string' && readBackgroundImageUrl(styles.backgroundImage)) {
                imageCount += 1;
            }
        }
    }
    return {
        draftCount: changedPaths.length,
        insertedBlockCount: countInsertedBlocks(store),
        textCount,
        styleCount,
        imageCount,
        changedPaths: changedPaths.slice(0, 120),
    };
}
export function extractImageRefs(store) {
    const refs = [];
    for (const [path, draftValue] of Object.entries(store)) {
        if (!isDraft(draftValue))
            continue;
        if (typeof draftValue.imageUrl === 'string') {
            refs.push({ path, kind: 'image', size: draftValue.imageUrl.length, preview: draftValue.imageUrl.slice(0, 120) });
        }
        if (draftValue.styles && typeof draftValue.styles === 'object' && !Array.isArray(draftValue.styles)) {
            const styles = draftValue.styles;
            if (typeof styles.backgroundImage === 'string') {
                const src = readBackgroundImageUrl(styles.backgroundImage);
                if (src)
                    refs.push({ path, kind: 'background', size: src.length, preview: src.slice(0, 120) });
            }
        }
        if (refs.length >= 80)
            break;
    }
    return refs;
}
/** This page's versions, newest first: kept here, and on the server when it answers. */
export async function listRouteVersions(projectKey, routeKey, viewportMode) {
    const local = getScopedLocalVersions(projectKey, routeKey, viewportMode);
    try {
        const params = new URLSearchParams({ routeKey, viewportMode });
        const res = await apiGetFresh(`/api/froam/versions?${params}`);
        return [...local, ...(res.versions ?? [])].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    }
    catch {
        return local;
    }
}
/** Keep this moment as a named version — on the server, or here if it can't be reached. */
export async function createVersion(projectKey, routeKey, viewportMode, store, name) {
    try {
        const res = await apiPost('/api/froam/versions', { routeKey, viewportMode, store, name });
        if (!res.version?.id)
            throw new Error('No version id');
        return { id: res.version.id, local: false };
    }
    catch {
        const version = saveLocalVersion(projectKey, routeKey, viewportMode, store, name);
        return { id: version.id, local: true };
    }
}
/** A version's page, to put back. */
export async function fetchVersionStore(projectKey, versionId) {
    if (versionId.startsWith(LOCAL_VERSION_PREFIX))
        return findLocalVersion(projectKey, versionId)?.store ?? null;
    try {
        const res = await apiGetFresh(`/api/froam/versions/${versionId}`);
        return res.success && res.version?.store ? res.version.store : null;
    }
    catch {
        return null;
    }
}
//# sourceMappingURL=versions-store.js.map