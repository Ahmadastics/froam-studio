import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import type { EditorStore, FroamOp } from '../collab/types'
import { appendProjectEvents, createProjectDocument, emptyProjectState, normalizeProjectState } from '../project/event-log'
import { legacyOpsToProjectEvents } from '../project/adapters'
import { editorStoreToLegacyDesign, type FroamProjectFile } from '../project/serialization'
import { loadProjectFromBridge, saveProjectToBridge } from '../project/bridge'
import type { FroamProjectDocument } from '../project/types'
import { loadProjectFromIndexedDb, persistProjectToLocalStorage, saveProjectToIndexedDb } from '../project/local-project-store'

function storageKey(projectId: string) { return `froam-connected-canvas-v2:${projectId}` }
function legacyStorageKey(projectId: string) { return `froam-connected-canvas-v1:${projectId}` }

type StoredProjectDocument = Omit<FroamProjectDocument, 'schemaVersion' | 'events'> & {
  schemaVersion: number
  events: Array<Omit<FroamProjectDocument['events'][number], 'schemaVersion'> & { schemaVersion: number }>
}

function upgradeLocalDocument(value: StoredProjectDocument, projectId: string): FroamProjectDocument | null {
  if (value.id !== projectId || !value.branches?.main || (value.schemaVersion !== 1 && value.schemaVersion !== 2)) return null
  if (value.schemaVersion === 2) return value as FroamProjectDocument
  const checkpoints = Object.fromEntries(Object.entries(value.checkpoints).map(([id, checkpoint]) => [id, {
    ...checkpoint, state: normalizeProjectState(checkpoint.state),
  }]))
  const branches = Object.fromEntries(Object.entries(value.branches).map(([id, branch]) => {
    const root = Object.values(checkpoints).filter((checkpoint) => checkpoint.branchId === id).sort((a, b) => a.createdAt - b.createdAt)[0]
    return [id, { ...branch, rootCheckpointId: root?.id ?? branch.baseCheckpointId }]
  }))
  return { ...value, schemaVersion: 2, branches, checkpoints, events: value.events.map((event) => ({ ...event, schemaVersion: 2 as const })) }
}

function loadDocument(projectId: string): FroamProjectDocument | null {
  try {
    const raw = window.localStorage.getItem(storageKey(projectId)) ?? window.localStorage.getItem(legacyStorageKey(projectId))
    const value = JSON.parse(raw ?? 'null') as StoredProjectDocument | null
    return value ? upgradeLocalDocument(value, projectId) : null
  } catch { return null }
}

function createDocument(projectId: string, actorId: string, ops: readonly FroamOp[]) {
  let document = createProjectDocument({ id: projectId, name: 'Froam project', actorId, initialState: emptyProjectState() })
  document = appendProjectEvents(document, legacyOpsToProjectEvents(ops, { projectId, branchId: 'main' }))
  return document
}

export type FroamProjectSession = { project: FroamProjectDocument; setProject: Dispatch<SetStateAction<FroamProjectDocument>> }

export function useFroamProjectDocument(input: { projectId: string; actorId: string; ops: readonly FroamOp[]; store: EditorStore; revision?: number }): FroamProjectSession {
  const [project, setProject] = useState(() => loadDocument(input.projectId) ?? createDocument(input.projectId, input.actorId, input.ops))
  useEffect(() => {
    void loadProjectFromBridge().then((file) => { if (file?.project.id === input.projectId) setProject((current) => file.project.updatedAt > current.updatedAt ? file.project : current) }).catch(() => undefined)
    void loadProjectFromIndexedDb(input.projectId).then((saved) => {
      if (saved?.id === input.projectId) setProject((current) => saved.updatedAt >= current.updatedAt ? saved : current)
    }).catch(() => undefined)
  }, [input.projectId])
  useEffect(() => {
    setProject((current) => {
      const known = new Set(current.events.map((event) => event.id))
      const incoming = input.ops.filter((op) => !known.has(op.id) && (current.events.length === 0 || op.actor !== 'baseline'))
      return incoming.length ? appendProjectEvents(current, legacyOpsToProjectEvents(incoming, { projectId: current.id, branchId: current.activeBranchId })) : current
    })
  }, [input.revision, input.projectId])
  useEffect(() => {
    void saveProjectToIndexedDb(project).catch(() => false)
    persistProjectToLocalStorage(window.localStorage, storageKey(project.id), project)
    const timer = window.setTimeout(() => {
      const file: FroamProjectFile = { kind: 'froam-project', schemaVersion: 2, project, design: editorStoreToLegacyDesign(input.store) }
      void saveProjectToBridge(file).catch(() => undefined)
    }, 800)
    return () => window.clearTimeout(timer)
  }, [project, input.store])
  return { project, setProject }
}
