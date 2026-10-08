#!/usr/bin/env node
/**
 * The package has to run on Linux and macOS, not only on the Windows machine
 * that builds it. Runs before every `npm pack` / `npm publish` (prepack).
 *
 *   - Every file with a #! line gets LF line endings. With CRLF the kernel
 *     looks for a program called "node\r" and `npx @ahmadastic/froam` dies
 *     before Froam runs a line — 9.5.0 shipped exactly that.
 *   - Every relative import must match its file's case exactly. Windows and
 *     macOS find `./Foo.js` for foo.js; Linux does not.
 *
 *   node scripts/check-package.mjs           # fix line endings, fail on the rest
 *   node scripts/check-package.mjs --check   # fix nothing, fail on anything
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const checkOnly = process.argv.includes('--check')
const own = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'))

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out
  if (fs.statSync(dir).isFile()) return [...out, dir]
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full, out)
    else out.push(full)
  }
  return out
}

/* What npm ships: package.json "files" (globs are only used for plain names here). */
const shipped = own.files.flatMap((entry) => walk(path.join(ROOT, entry.replace(/\/\*\*?$/, ''))))
const problems = []
const fixed = []

/* 1. #! lines */
for (const file of new Set([...shipped, ...Object.values(own.bin ?? {}).map((bin) => path.join(ROOT, bin))])) {
  if (!/\.(m?js|cjs)$/.test(file) && !Object.values(own.bin ?? {}).some((bin) => path.join(ROOT, bin) === file)) continue
  const buffer = fs.readFileSync(file)
  if (buffer[0] !== 0x23 || buffer[1] !== 0x21) continue
  const text = buffer.toString('utf8')
  if (!text.includes('\r')) continue
  if (checkOnly) problems.push(`CRLF line endings in ${path.relative(ROOT, file)} — its #! line won't run on Linux or macOS`)
  else {
    fs.writeFileSync(file, text.replace(/\r\n/g, '\n'))
    fixed.push(path.relative(ROOT, file))
  }
}

/* 2. imports whose case doesn't match the file */
const listings = new Map()
function existsExactly(file) {
  let dir = ROOT
  for (const part of path.relative(ROOT, file).split(path.sep)) {
    if (!listings.has(dir)) listings.set(dir, new Set(fs.existsSync(dir) ? fs.readdirSync(dir) : []))
    if (!listings.get(dir).has(part)) return false
    dir = path.join(dir, part)
  }
  return true
}
const SPECIFIER = /(?:import\s[^'"`]*?from\s*|import\s*\(\s*|require\s*\(\s*|export\s[^'"`]*?from\s*)['"](\.{1,2}\/[^'"]+)['"]/g
for (const file of shipped.filter((name) => /\.(m?js|cjs)$/.test(name))) {
  const text = fs.readFileSync(file, 'utf8')
  for (const match of text.matchAll(SPECIFIER)) {
    const target = path.resolve(path.dirname(file), match[1])
    const candidates = [target, `${target}.js`, `${target}.mjs`, path.join(target, 'index.js')].filter((candidate) => fs.existsSync(candidate))
    if (candidates.length && !candidates.some(existsExactly)) {
      problems.push(`${path.relative(ROOT, file)} imports "${match[1]}" — the file's case differs, so Linux can't find it`)
    }
  }
}

if (fixed.length) console.log(`check-package: LF line endings for ${fixed.join(', ')}`)
if (problems.length) {
  console.error(`check-package: ${problems.length} problem${problems.length === 1 ? '' : 's'} that would break the package outside Windows:\n  ${problems.join('\n  ')}`)
  process.exit(1)
}
console.log(`check-package: ${shipped.length} shipped files are fine for Linux and macOS`)
