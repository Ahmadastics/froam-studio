import type { EditorStore, ElementDraft, FroamViewport } from '../collab/types'
import { FROAM_VIEWPORTS } from '../collab/types'
import { createProjectFromLegacyStore } from './adapters'
import { FROAM_PROJECT_SCHEMA_VERSION, type FroamProjectDocument } from './types'

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
