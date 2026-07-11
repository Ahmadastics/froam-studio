import { copyFileSync, cpSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(new URL('../package.json', import.meta.url)))
const src = join(root, 'src')
const dist = join(root, 'dist')

function copyFile(from, to) {
  mkdirSync(dirname(to), { recursive: true })
  copyFileSync(from, to)
}

function copyCssFiles(fromDir, toDir) {
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    const from = join(fromDir, entry.name)
    const to = join(toDir, entry.name)
    if (entry.isDirectory()) {
      copyCssFiles(from, to)
      continue
    }
    if (extname(entry.name) === '.css') copyFile(from, to)
  }
}

copyFile(join(src, 'froam-studio.css'), join(dist, 'froam-studio.css'))
copyFile(join(src, 'gate-css.css'), join(dist, 'gate-css.css'))
writeFileSync(join(dist, 'css.d.ts'), 'declare const stylesheet: string; export default stylesheet;\n')
writeFileSync(join(dist, 'gate-css.d.ts'), 'declare const stylesheet: string; export default stylesheet;\n')
copyCssFiles(join(src, 'editor'), join(dist, 'editor'))

const assetsDir = join(src, 'assets')
if (existsSync(assetsDir)) cpSync(assetsDir, join(dist, 'assets'), { recursive: true })
