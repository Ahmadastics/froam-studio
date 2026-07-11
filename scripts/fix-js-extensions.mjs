import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = fileURLToPath(new URL('../dist', import.meta.url))

function hasExtension(specifier) {
  const [path] = specifier.split(/[?#]/)
  return Boolean(extname(path))
}

function withJsExtension(specifier) {
  if (!specifier.startsWith('./') && !specifier.startsWith('../')) return specifier
  if (hasExtension(specifier)) return specifier
  return `${specifier}.js`
}

function rewriteFile(filePath) {
  const current = readFileSync(filePath, 'utf8')
  const next = current
    .replace(/(from\s*['"])(\.{1,2}\/[^'"]+)(['"])/g, (_match, before, specifier, after) => {
      return `${before}${withJsExtension(specifier)}${after}`
    })
    .replace(/(import\s*\(\s*['"])(\.{1,2}\/[^'"]+)(['"]\s*\))/g, (_match, before, specifier, after) => {
      return `${before}${withJsExtension(specifier)}${after}`
    })

  if (next !== current) writeFileSync(filePath, next)
}

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      walk(path)
      continue
    }
    if (entry.name.endsWith('.js')) rewriteFile(path)
  }
}

walk(dist)
