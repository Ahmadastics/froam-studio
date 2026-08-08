import type { FroamProjectDocument, FroamProjectEvent, FroamProjectState } from './types'
import { packProjectDocument, unpackProjectDocument, type FroamPackedProject } from './storage-codec'

export const FROAM_LOCAL_PROJECT_INLINE_LIMIT = 1_500_000
const DATABASE_NAME = 'froam-projects-v1'
const STORE_NAME = 'projects'
const saveQueues = new Map<string, Promise<boolean>>()
const DERIVED_EVENT_TYPES = new Set<FroamProjectEvent['type']>([
  'scan.captured',
  'dna.captured',
  'analysis.upserted',
  'analysis.removed',
])

export type FroamStorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
export type FroamLocalPersistenceResult = {
  mode: 'inline' | 'compact' | 'minimal' | 'memory-only'
  bytes: number
  quotaRecovered: boolean
}

function estimatedBytes(value: string) { return value.length * 2 }

function compactState(state: FroamProjectState, minimal: boolean): FroamProjectState {
  if (minimal) {
    return {
      legacyStore: { ...state.legacyStore }, nodes: { ...state.nodes }, relations: { ...state.relations },
      flows: { ...state.flows }, interactions: { ...state.interactions }, dna: {}, assets: {}, scans: {}, archive: {}, analyses: {}, responsive: {},
    }
  }
  const assets = Object.fromEntries(Object.entries(state.assets).map(([id, asset]) => [id, {
    ...asset,
    url: asset.url?.startsWith('data:') ? undefined : asset.url,
  }]))
  const archive = Object.fromEntries(Object.entries(state.archive).map(([id, item]) => [id, {
    ...item,
    snapshot: item.snapshot ? { ...item.snapshot, previewDataUrl: undefined } : undefined,
  }]))
  return {
    ...state,
    dna: {},
    scans: {},
    analyses: {},
    assets,
    archive,
  }
}

/** A recovery snapshot only. IndexedDB and project files retain the complete intelligence history. */
export function compactProjectForLocalStorage(project: FroamProjectDocument, minimal = false): FroamProjectDocument {
  const events = minimal ? project.events.filter((event) => event.type.startsWith('design.')) : project.events.filter((event) => !DERIVED_EVENT_TYPES.has(event.type))
  const persistedIds = new Set(events.map((event) => event.id))
  return {
    ...project,
    metadata: {
      ...project.metadata,
      localPersistence: { mode: minimal ? 'minimal' : 'compact', fullDocument: 'indexeddb', compactedAt: Date.now() },
    },
    checkpoints: Object.fromEntries(Object.entries(project.checkpoints).map(([id, checkpoint]) => [id, {
      ...checkpoint,
      eventIds: checkpoint.eventIds.filter((eventId) => persistedIds.has(eventId)),
      state: compactState(checkpoint.state, minimal),
    }])),
    events,
  }
}

/** Never throws: quota failure degrades to a compact recovery document, then memory-only. */
export function persistProjectToLocalStorage(storage: FroamStorageLike, key: string, project: FroamProjectDocument): FroamLocalPersistenceResult {
  const full = JSON.stringify(project)
  if (estimatedBytes(full) <= FROAM_LOCAL_PROJECT_INLINE_LIMIT) {
    try {
      storage.setItem(key, full)
      return { mode: 'inline', bytes: estimatedBytes(full), quotaRecovered: false }
    } catch { /* use a smaller recovery snapshot */ }
  }

  const attempts: Array<{ mode: 'compact' | 'minimal'; value: string }> = [
    { mode: 'compact', value: JSON.stringify(compactProjectForLocalStorage(project)) },
    { mode: 'minimal', value: JSON.stringify(compactProjectForLocalStorage(project, true)) },
  ]
  for (const attempt of attempts) {
    try {
      storage.setItem(key, attempt.value)
      return { mode: attempt.mode, bytes: estimatedBytes(attempt.value), quotaRecovered: true }
    } catch { /* try the next bounded fallback */ }
  }

  // An older value under this exact key can consume the space needed by the fallback.
  try { storage.removeItem(key) } catch { /* storage may be unavailable entirely */ }
  for (const attempt of attempts.reverse()) {
    try {
      storage.setItem(key, attempt.value)
      return { mode: attempt.mode, bytes: estimatedBytes(attempt.value), quotaRecovered: true }
    } catch { /* keep the live in-memory project usable */ }
  }
  return { mode: 'memory-only', bytes: 0, quotaRecovered: true }
}

function openProjectDatabase(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null)
  return new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = indexedDB.open(DATABASE_NAME, 1)
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => resolve(null)
      request.onblocked = () => resolve(null)
    } catch { resolve(null) }
  })
}

export async function loadProjectFromIndexedDb(projectId: string): Promise<FroamProjectDocument | null> {
  const database = await openProjectDatabase()
  if (!database) return null
  return new Promise<FroamProjectDocument | null>((resolve) => {
    try {
      const request = database.transaction(STORE_NAME, 'readonly').objectStore(STORE_NAME).get(projectId)
      request.onsuccess = () => {
        const saved = request.result as FroamProjectDocument | FroamPackedProject | undefined
        try { resolve(saved && 'kind' in saved && saved.kind === 'froam-packed-project' ? unpackProjectDocument(saved) : (saved as FroamProjectDocument | undefined) ?? null) } catch { resolve(null) }
      }
      request.onerror = () => resolve(null)
    } catch { resolve(null) }
  }).finally(() => database.close())
}

async function writeProjectToIndexedDb(project: FroamProjectDocument): Promise<boolean> {
  const database = await openProjectDatabase()
  if (!database) return false
  return new Promise<boolean>((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const packed = packProjectDocument(project); const stored = JSON.stringify(packed).length < JSON.stringify(project).length ? packed : project
      transaction.objectStore(STORE_NAME).put(stored, project.id)
      transaction.oncomplete = () => resolve(true)
      transaction.onerror = () => resolve(false)
      transaction.onabort = () => resolve(false)
    } catch { resolve(false) }
  }).finally(() => database.close())
}

/** Serialize writes per project so a slower older transaction cannot overwrite newer state. */
export function saveProjectToIndexedDb(project: FroamProjectDocument): Promise<boolean> {
  const previous = saveQueues.get(project.id) ?? Promise.resolve(true)
  const queued = previous.catch(() => false).then(() => writeProjectToIndexedDb(project))
  saveQueues.set(project.id, queued)
  void queued.finally(() => { if (saveQueues.get(project.id) === queued) saveQueues.delete(project.id) })
  return queued
}
