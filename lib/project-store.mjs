import fs from 'node:fs'
import path from 'node:path'

export const PROJECT_SCHEMA_VERSION = 2

function emptyIntelligence(state = {}) {
  return { legacyStore: {}, nodes: {}, relations: {}, flows: {}, interactions: {}, dna: {}, assets: {}, scans: {}, archive: {}, analyses: {}, responsive: {}, ...state }
}

export function migrateProjectFile(value) {
  if (!value || value.kind !== 'froam-project' || value.schemaVersion !== 1 || value.project?.schemaVersion !== 1) return value
  const checkpoints = Object.fromEntries(Object.entries(value.project.checkpoints ?? {}).map(([id, checkpoint]) => [id, { ...checkpoint, state: emptyIntelligence(checkpoint.state) }]))
  const branches = Object.fromEntries(Object.entries(value.project.branches ?? {}).map(([id, branch]) => {
    const oldest = Object.values(checkpoints).filter((checkpoint) => checkpoint.branchId === id).sort((a, b) => a.createdAt - b.createdAt)[0]
    return [id, { ...branch, rootCheckpointId: oldest?.id ?? branch.baseCheckpointId }]
  }))
  return { ...value, schemaVersion: 2, project: { ...value.project, schemaVersion: 2, checkpoints, branches, events: (value.project.events ?? []).map((event) => ({ ...event, schemaVersion: 2 })) } }
}

export function isProjectFile(value) {
  return Boolean(
    value
    && typeof value === 'object'
    && value.kind === 'froam-project'
    && value.schemaVersion === PROJECT_SCHEMA_VERSION
    && value.project?.schemaVersion === PROJECT_SCHEMA_VERSION
    && typeof value.project?.id === 'string'
    && value.design
    && typeof value.design === 'object'
    && value.design.routes
    && typeof value.design.routes === 'object',
  )
}

export function loadProjectFile(file) {
  try {
    const value = migrateProjectFile(JSON.parse(fs.readFileSync(file, 'utf8')))
    return isProjectFile(value) ? value : null
  } catch {
    return null
  }
}

export function writeProjectFile(file, value) {
  if (!isProjectFile(value)) throw new Error('Invalid Froam project file')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`)
  return file
}
