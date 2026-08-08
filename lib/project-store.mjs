import fs from 'node:fs'
import path from 'node:path'

export const PROJECT_SCHEMA_VERSION = 1

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
    const value = JSON.parse(fs.readFileSync(file, 'utf8'))
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

