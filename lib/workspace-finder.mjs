/**
 * Which Froam folder does the site actually load?
 *
 * A project can hold more than one: the one an app is wired to (the Vite
 * plugin's src/froam, a page linking froam/froam.generated.css) and strays (an
 * old `froam dev` run from the repo root). Saving into a stray looks fine in
 * the editor and goes nowhere: the deployed site never reads it. This reads
 * the project — as text, never running anything — for what loads each folder:
 *
 *   - a vite.config using Froam's plugin (its `dir`, or src/froam);
 *   - an import whose path lands in the folder (`import design from '../froam'`);
 *   - a page or script naming froam.generated.css / froam.runtime.js at a path
 *     that lands in the folder, or in the public copy it ships to (shipDir).
 *
 * `froam dev` uses it to pick the folder the app loads instead of making or
 * reusing a stray; Go Live uses it to warn before sending edits nobody will see.
 */
import fs from 'node:fs'
import path from 'node:path'
import { findShipDir } from './codegen.mjs'

const SKIP = new Set(['node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt', '.output', '.vercel', '.netlify', '.froam', 'coverage', '.turbo', '.svelte-kit', '.astro', '.cache', 'vendor'])
const CODE = /\.(html?|[cm]?[jt]sx?|astro|vue|svelte)$/i
const VITE_CONFIG = /^vite\.config\.[cm]?[jt]s$/
const MAX_FILES = 6000
const MAX_BYTES = 1_000_000

const real = (file) => { try { return fs.realpathSync.native(file) } catch { return path.resolve(file) } }
const same = process.platform === 'win32' ? (a, b) => a.toLowerCase() === b.toLowerCase() : (a, b) => a === b
const within = (file, dir) => {
  const rel = path.relative(dir, file)
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

/** Files under `root` worth reading, nearest first. */
function listFiles(root, { maxDepth = 6, match = () => true } = {}) {
  const found = []
  const queue = [[root, 0]]
  while (queue.length && found.length < MAX_FILES) {
    const [dir, depth] = queue.shift()
    let entries
    try { entries = fs.readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        if (!SKIP.has(entry.name) && !entry.name.startsWith('.') && depth < maxDepth) queue.push([full, depth + 1])
      } else if (match(entry.name, full)) {
        found.push(full)
      }
    }
  }
  return found
}

const readSmall = (file) => {
  try {
    if (fs.statSync(file).size > MAX_BYTES) return null
    return fs.readFileSync(file, 'utf8')
  } catch { return null }
}

/** Folders the Vite plugin is told to use, whether or not they exist yet. */
export function viteWorkspaces(root) {
  return listFiles(root, { maxDepth: 4, match: (name) => VITE_CONFIG.test(name) }).flatMap((config) => {
    const text = readSmall(config)
    if (!text || !/@ahmadastic\/froam\/vite|froam-studio\/vite|froamStudio\s*\(/.test(text)) return []
    const dir = /froamStudio\s*\(\s*\{[^}]*?\bdir\s*:\s*['"`]([^'"`]+)['"`]/.exec(text)?.[1] ?? 'src/froam'
    return [real(path.resolve(path.dirname(config), dir))]
  })
}

/** Every folder in the project holding a Froam design. */
export function existingWorkspaces(root) {
  return listFiles(root, { match: (name) => name === 'froam.design.json' }).map((file) => real(path.dirname(file)))
}

/**
 * Every place in the project's code that names something Froam: the file,
 * and each path it could mean. Read once per call and shared by every folder
 * being asked about — a monorepo has thousands of files.
 */
function froamReferences(root) {
  const refs = []
  for (const file of listFiles(root, { match: (name) => CODE.test(name) })) {
    const text = readSmall(file)
    if (!text || !text.includes('froam')) continue
    const from = real(file)
    for (const [, spec] of text.matchAll(/['"`]([^'"`\n]*froam[^'"`\n]*)['"`]/g)) {
      const clean = spec.split(/[?#]/)[0]
      if (clean.startsWith('.') || /^froam\/froam\.(generated\.css|runtime\.js)$/.test(clean)) {
        refs.push({ from, paths: [path.resolve(path.dirname(file), clean)] })
      } else if (clean.startsWith('/') && /froam\.(generated\.css|runtime\.js)$/.test(clean)) {
        // A path from the site's root: served from the page's folder, or a public/static folder.
        const bases = [path.dirname(file), ...[root, path.dirname(file)].flatMap((dir) => [path.join(dir, 'public'), path.join(dir, 'static')])]
        refs.push({ from, paths: bases.map((base) => path.join(base, clean)) })
      }
    }
  }
  return refs
}

/** Is `workspace` loaded by anything in the project under `root`? (`known` saves re-reading the project.) */
export function workspaceIsLoaded(workspace, root, known = null) {
  const target = real(workspace)
  const vite = known?.vite ?? viteWorkspaces(root)
  if (vite.some((dir) => same(dir, target))) return true
  const ship = findShipDir(target)
  const lands = (file) => within(file, target) || Boolean(ship && within(file, real(ship)))
  return (known?.refs ?? froamReferences(root)).some((ref) => !within(ref.from, target) && ref.paths.some(lands))
}

/** The Froam folders the site actually loads, nearest the root first. */
export function findLoadedWorkspaces(root) {
  const known = { vite: viteWorkspaces(root), refs: froamReferences(root) }
  const seen = []
  for (const dir of [...known.vite, ...existingWorkspaces(root)]) if (!seen.some((other) => same(other, dir))) seen.push(dir)
  return seen
    .filter((dir) => workspaceIsLoaded(dir, root, known))
    .sort((a, b) => path.relative(root, a).split(path.sep).length - path.relative(root, b).split(path.sep).length)
}
