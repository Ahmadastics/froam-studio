import type { EditorStore, ElementDraft, FroamViewport } from '../collab/types'
import { FROAM_VIEWPORTS } from '../collab/types'
import { createProjectFromLegacyStore } from './adapters'
import { FROAM_DNA_SCHEMA_VERSION, FROAM_PROJECT_SCHEMA_VERSION, type FroamProjectDocument, type FroamProjectState } from './types'
import { normalizeProjectState } from './event-log'

export type FroamLegacyDesignFile = {
  version: number
  updatedAt?: string | null
  meta?: Record<string, unknown>
  routes: Record<string, Partial<Record<FroamViewport, Record<string, ElementDraft>>>>
}

export type FroamProjectFile = {
  kind: 'froam-project'
  schemaVersion: typeof FROAM_PROJECT_SCHEMA_VERSION
  project: FroamProjectDocument
  /** Preserved verbatim so current runtime and codegen can keep consuming v3. */
  design: FroamLegacyDesignFile
}

export function isLegacyDesignFile(value: unknown): value is FroamLegacyDesignFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<FroamLegacyDesignFile>
  return Number.isFinite(candidate.version) && Boolean(candidate.routes && typeof candidate.routes === 'object')
}

export function isFroamProjectFile(value: unknown): value is FroamProjectFile {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Partial<FroamProjectFile>
  return candidate.kind === 'froam-project'
    && candidate.schemaVersion === FROAM_PROJECT_SCHEMA_VERSION
    && candidate.project?.schemaVersion === FROAM_PROJECT_SCHEMA_VERSION
    && isLegacyDesignFile(candidate.design)
}

function isV1ProjectFile(value: unknown): value is { kind: 'froam-project'; schemaVersion: 1; project: FroamProjectDocument & { schemaVersion: 1 }; design: FroamLegacyDesignFile } {
  if (!value || typeof value !== 'object') return false
  const candidate = value as Record<string, unknown>
  const project = candidate.project as Record<string, unknown> | undefined
  return candidate.kind === 'froam-project' && candidate.schemaVersion === 1 && project?.schemaVersion === 1 && isLegacyDesignFile(candidate.design)
}

/** Additive v6→v7 project migration. Existing event IDs and legacy design remain byte-for-byte meaningful. */
export function migrateProjectFileV1(value: unknown): FroamProjectFile | null {
  if (!isV1ProjectFile(value)) return null
  const oldProject = value.project as unknown as FroamProjectDocument
  const checkpoints = Object.fromEntries(Object.entries(oldProject.checkpoints).map(([id, checkpoint]) => [id, {
    ...checkpoint,
    state: normalizeProjectState(checkpoint.state as Partial<FroamProjectState>),
  }]))
  const branches = Object.fromEntries(Object.entries(oldProject.branches).map(([id, branch]) => {
    const oldest = Object.values(checkpoints)
      .filter((checkpoint) => checkpoint.branchId === id)
      .sort((a, b) => a.createdAt - b.createdAt)[0]
    return [id, { ...branch, rootCheckpointId: oldest?.id ?? branch.baseCheckpointId }]
  }))
  for (const checkpoint of Object.values(checkpoints)) {
    for (const [nodeId, dna] of Object.entries(checkpoint.state.dna)) {
      if (!dna.schemaVersion) checkpoint.state.dna[nodeId] = { ...dna, schemaVersion: FROAM_DNA_SCHEMA_VERSION }
    }
  }
  return {
    kind: 'froam-project',
    schemaVersion: FROAM_PROJECT_SCHEMA_VERSION,
    design: value.design,
    project: {
      ...oldProject,
      schemaVersion: FROAM_PROJECT_SCHEMA_VERSION,
      branches,
      checkpoints,
      events: oldProject.events.map((event) => ({ ...event, schemaVersion: FROAM_PROJECT_SCHEMA_VERSION })),
    },
  }
}

export function coerceFroamProjectFile(value: unknown): FroamProjectFile | null {
  return isFroamProjectFile(value) ? value : migrateProjectFileV1(value)
}

export function legacyDesignToEditorStore(design: FroamLegacyDesignFile): EditorStore {
  const store: EditorStore = {}
  for (const [routeKey, route] of Object.entries(design.routes)) {
    for (const viewport of FROAM_VIEWPORTS) {
      const drafts = route[viewport]
      if (drafts && typeof drafts === 'object') store[`${routeKey}@@${viewport}`] = drafts
    }
  }
  return store
}

export function editorStoreToLegacyDesign(store: EditorStore, previous?: FroamLegacyDesignFile): FroamLegacyDesignFile {
  const routes: FroamLegacyDesignFile['routes'] = {}
  for (const [scope, drafts] of Object.entries(store)) {
    const separator = scope.lastIndexOf('@@')
    if (separator < 0) continue
    const routeKey = scope.slice(0, separator)
    const viewport = scope.slice(separator + 2) as FroamViewport
    if (!FROAM_VIEWPORTS.includes(viewport)) continue
    routes[routeKey] = { ...(routes[routeKey] ?? {}), [viewport]: drafts }
  }
  return {
    version: previous?.version ?? 3,
    updatedAt: new Date().toISOString(),
    meta: previous?.meta,
    routes,
  }
}

export function createProjectFileFromLegacyDesign(
  design: FroamLegacyDesignFile,
  options: { projectId: string; actorId: string; name?: string; now?: number; idFactory?: () => string },
): FroamProjectFile {
  const project = createProjectFromLegacyStore({
    projectId: options.projectId,
    actorId: options.actorId,
    name: options.name ?? String(design.meta?.name ?? 'Froam project'),
    store: legacyDesignToEditorStore(design),
    now: options.now,
    idFactory: options.idFactory,
  })
  return { kind: 'froam-project', schemaVersion: FROAM_PROJECT_SCHEMA_VERSION, project, design }
}

export function parseFroamProjectFile(
  input: string | unknown,
  migration: { projectId: string; actorId: string; name?: string; now?: number; idFactory?: () => string },
): { file: FroamProjectFile; migrated: boolean } {
  const value: unknown = typeof input === 'string' ? JSON.parse(input) : input
  if (isFroamProjectFile(value)) return { file: value, migrated: false }
  const upgraded = migrateProjectFileV1(value)
  if (upgraded) return { file: upgraded, migrated: true }
  if (isLegacyDesignFile(value)) return { file: createProjectFileFromLegacyDesign(value, migration), migrated: true }
  throw new Error('Not a supported Froam project or design file')
}

export function serializeFroamProjectFile(file: FroamProjectFile) {
  if (!isFroamProjectFile(file)) throw new Error('Cannot serialize an invalid Froam project file')
  return JSON.stringify(file, null, 2)
}

/** Compatibility escape hatch: existing codegen/runtime receive the exact v3 snapshot. */
export function unwrapLegacyDesign(file: FroamProjectFile) {
  return file.design
}
