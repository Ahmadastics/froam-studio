import { useEffect, useState } from 'react';
import { appendProjectEvents, createProjectDocument, emptyProjectState, normalizeProjectState } from '../project/event-log.js';
import { legacyOpsToProjectEvents } from '../project/adapters.js';
import { editorStoreToLegacyDesign } from '../project/serialization.js';
import { loadProjectFromBridge, saveProjectToBridge } from '../project/bridge.js';
import { loadProjectFromIndexedDb, persistProjectToLocalStorage, saveProjectToIndexedDb } from '../project/local-project-store.js';
function storageKey(projectId) { return `froam-connected-canvas-v2:${projectId}`; }
function legacyStorageKey(projectId) { return `froam-connected-canvas-v1:${projectId}`; }
function upgradeLocalDocument(value, projectId) {
    if (value.id !== projectId || !value.branches?.main || (value.schemaVersion !== 1 && value.schemaVersion !== 2))
        return null;
    if (value.schemaVersion === 2)
        return value;
    const checkpoints = Object.fromEntries(Object.entries(value.checkpoints).map(([id, checkpoint]) => [id, {
            ...checkpoint, state: normalizeProjectState(checkpoint.state),
        }]));
    const branches = Object.fromEntries(Object.entries(value.branches).map(([id, branch]) => {
        const root = Object.values(checkpoints).filter((checkpoint) => checkpoint.branchId === id).sort((a, b) => a.createdAt - b.createdAt)[0];
        return [id, { ...branch, rootCheckpointId: root?.id ?? branch.baseCheckpointId }];
    }));
    return { ...value, schemaVersion: 2, branches, checkpoints, events: value.events.map((event) => ({ ...event, schemaVersion: 2 })) };
}
function loadDocument(projectId) {
    try {
        const raw = window.localStorage.getItem(storageKey(projectId)) ?? window.localStorage.getItem(legacyStorageKey(projectId));
        const value = JSON.parse(raw ?? 'null');
        return value ? upgradeLocalDocument(value, projectId) : null;
    }
    catch {
        return null;
    }
}
function createDocument(projectId, actorId, ops) {
    let document = createProjectDocument({ id: projectId, name: 'Froam project', actorId, initialState: emptyProjectState() });
    document = appendProjectEvents(document, legacyOpsToProjectEvents(ops, { projectId, branchId: 'main' }));
    return document;
}
export function useFroamProjectDocument(input) {
    const [project, setProject] = useState(() => loadDocument(input.projectId) ?? createDocument(input.projectId, input.actorId, input.ops));
    useEffect(() => {
        void loadProjectFromBridge().then((file) => { if (file?.project.id === input.projectId)
            setProject((current) => file.project.updatedAt > current.updatedAt ? file.project : current); }).catch(() => undefined);
        void loadProjectFromIndexedDb(input.projectId).then((saved) => {
            if (saved?.id === input.projectId)
                setProject((current) => saved.updatedAt >= current.updatedAt ? saved : current);
        }).catch(() => undefined);
    }, [input.projectId]);
    useEffect(() => {
        setProject((current) => {
            const known = new Set(current.events.map((event) => event.id));
            const incoming = input.ops.filter((op) => !known.has(op.id) && (current.events.length === 0 || op.actor !== 'baseline'));
            return incoming.length ? appendProjectEvents(current, legacyOpsToProjectEvents(incoming, { projectId: current.id, branchId: current.activeBranchId })) : current;
        });
    }, [input.revision, input.projectId]);
    useEffect(() => {
        void saveProjectToIndexedDb(project).catch(() => false);
        persistProjectToLocalStorage(window.localStorage, storageKey(project.id), project);
        const timer = window.setTimeout(() => {
            const file = { kind: 'froam-project', schemaVersion: 2, project, design: editorStoreToLegacyDesign(input.store) };
            void saveProjectToBridge(file).catch(() => undefined);
        }, 800);
        return () => window.clearTimeout(timer);
    }, [project, input.store]);
    return { project, setProject };
}
//# sourceMappingURL=useFroamProjectDocument.js.map