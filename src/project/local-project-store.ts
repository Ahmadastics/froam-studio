import type { FroamProjectDocument, FroamProjectEvent, FroamProjectState } from './types'
import { packProjectDocument, unpackProjectDocument, type FroamPackedProject } from './storage-codec'

export const FROAM_LOCAL_PROJECT_INLINE_LIMIT = 1_500_000
const DATABASE_NAME = 'froam-projects-v1'
const STORE_NAME = 'projects'
const saveSlots = new Map<string, { running: boolean; pending?: { project: FroamProjectDocument; resolve: Array<(value: boolean) => void> } }>()
let storageWorker: Worker | null | undefined; let workerRequestId = 0
const workerRequests = new Map<number, { resolve: (value: FroamPackedProject) => void; reject: (reason: unknown) => void }>()
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
      // This is the last-resort localStorage recovery shell; the complete
      // design system remains in IndexedDB/project files and normalizes back
      // to starter defaults if this shell is ever opened by itself.
      designSystem: { schemaVersion: 1, activeModeIds: [], modes: {}, variables: {}, styles: {}, componentFamilies: {}, siteKits: {}, libraries: {} },
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
  const packed = await packProjectOffThread(project); const stored = JSON.stringify(packed).length < JSON.stringify(project).length ? packed : project
  const database = await openProjectDatabase()
  if (!database) return false
  return new Promise<boolean>((resolve) => {
    try {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      transaction.objectStore(STORE_NAME).put(stored, project.id)
      transaction.oncomplete = () => resolve(true)
      transaction.onerror = () => resolve(false)
      transaction.onabort = () => resolve(false)
    } catch { resolve(false) }
  }).finally(() => database.close())
}

function getStorageWorker() {
  if (storageWorker !== undefined) return storageWorker
  if (typeof Worker === 'undefined') return storageWorker = null
  try { const worker = new Worker(new URL('./storage-worker.js', import.meta.url), { type: 'module', name: 'froam-project-storage' }); worker.onmessage = (event: MessageEvent<{ id: number; packed?: FroamPackedProject; error?: string }>) => { const pending = workerRequests.get(event.data.id); if (!pending) return; workerRequests.delete(event.data.id); event.data.packed ? pending.resolve(event.data.packed) : pending.reject(new Error(event.data.error ?? 'Project packing failed')) }; worker.onerror = () => { for (const pending of workerRequests.values()) pending.reject(new Error('Froam storage worker failed')); workerRequests.clear(); worker.terminate(); storageWorker = null }; return storageWorker = worker } catch { return storageWorker = null }
}
export async function packProjectOffThread(project: FroamProjectDocument): Promise<FroamPackedProject> { const worker = getStorageWorker(); if (!worker) { await new Promise<void>((resolve) => setTimeout(resolve, 0)); return packProjectDocument(project) } const id = ++workerRequestId; return new Promise<FroamPackedProject>((resolve, reject) => { workerRequests.set(id, { resolve, reject }); worker.postMessage({ id, project }) }).catch(async () => { await new Promise<void>((resolve) => setTimeout(resolve, 0)); return packProjectDocument(project) }) }

/** Coalesce pending writes and pack in a module Worker so older large saves cannot block or overwrite the latest state. */
export function saveProjectToIndexedDb(project: FroamProjectDocument): Promise<boolean> {
  let slot = saveSlots.get(project.id); if (!slot) { slot = { running: false }; saveSlots.set(project.id, slot) }
  const promise = new Promise<boolean>((resolve) => { if (slot!.pending) { slot!.pending.project = project; slot!.pending.resolve.push(resolve) } else slot!.pending = { project, resolve: [resolve] } })
  if (!slot.running) { slot.running = true; void (async () => { while (slot!.pending) { const pending = slot!.pending; slot!.pending = undefined; const result = await writeProjectToIndexedDb(pending.project).catch(() => false); pending.resolve.forEach((resolve) => resolve(result)) } slot!.running = false; saveSlots.delete(project.id) })() }
  return promise
}
