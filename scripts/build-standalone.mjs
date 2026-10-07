/**
 * Bundle the standalone editor (React included) for the universal
 * `froam dev` bridge.
 *
 *   dist/standalone/froam-editor.js     a tiny classic loader — what /froam.js serves
 *   dist/standalone/modules/…           the editor, split: a small boot module (the
 *                                       Froam button, the runtime) and the full editor
 *                                       as a chunk that loads behind it
 *   dist/standalone/froam-editor.css    every style, one file
 *
 * Split because the button should appear as soon as the page can show it: a
 * phone on a share link was downloading 1.4 MB before anything showed. The
 * loader stays a classic script so a plain `<script src=".../froam.js">`
 * keeps working everywhere.
 */
import { build } from 'esbuild'
import { readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const out = join(root, 'dist', 'standalone')
const modules = join(out, 'modules')
rmSync(modules, { recursive: true, force: true })

const result = await build({
  absWorkingDir: root,
  entryPoints: { 'froam-editor': join(root, 'src', 'standalone.tsx') },
  outdir: modules,
  entryNames: '[name]',
  chunkNames: 'chunks/[name]-[hash]',
  splitting: true,
  format: 'esm',
  outExtension: { '.js': '.mjs' },
  tsconfig: join(root, 'tsconfig.json'),
  bundle: true,
  minify: true,
  platform: 'browser',
  target: ['es2020'],
  jsx: 'automatic',
  legalComments: 'none',
  logLevel: 'info',
  define: {
    'process.env.NODE_ENV': '"production"',
    // FroamGate probes import.meta.env?.VITE_FROAM_OWNER_EMAILS — there
    // is no bundler env in standalone mode.
    'import.meta.env': 'undefined',
  },
  loader: {
    '.webp': 'dataurl',
    '.png': 'dataurl',
    '.svg': 'dataurl',
    '.woff': 'dataurl',
    '.woff2': 'dataurl',
  },
})
if (result.errors.length) process.exit(1)

// The project store packs in a module worker found by
// `new URL('./storage-worker.js', import.meta.url)`. esbuild leaves that URL
// alone and never emits the worker, so it's built here and the bridge serves
// it under that name from whichever chunk asks.
const worker = await build({
  absWorkingDir: root,
  entryPoints: [join(root, 'src', 'project', 'storage-worker.ts')],
  outfile: join(modules, 'storage-worker.js'),
  tsconfig: join(root, 'tsconfig.json'),
  bundle: true,
  minify: true,
  platform: 'browser',
  format: 'esm',
  target: ['es2020'],
  legalComments: 'none',
  logLevel: 'info',
  define: { 'process.env.NODE_ENV': '"production"' },
})
if (worker.errors.length) process.exit(1)

// Every stylesheet the split produced becomes one file, loaded once.
const cssFiles = []
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full)
    else if (name.endsWith('.css')) cssFiles.push(full)
  }
}
walk(modules)
cssFiles.sort((a, b) => (a.endsWith('froam-editor.css') ? -1 : b.endsWith('froam-editor.css') ? 1 : a.localeCompare(b)))
writeFileSync(join(out, 'froam-editor.css'), cssFiles.map((file) => readFileSync(file, 'utf8')).join('\n'))
for (const file of cssFiles) rmSync(file)

// The loader: remembers how the page asked for the editor (the script's
// origin is the bridge; its data- attributes are the options), then imports
// the boot module from next to itself.
const loader = `/* Froam — loads the editor; see dist/standalone/modules */
(function () {
  var script = document.currentScript;
  if (!script || window.__FROAM_BOOT__) return;
  var src = new URL(script.src, location.href);
  window.__FROAM_BOOT__ = {
    origin: src.origin,
    open: script.dataset.open === 'true',
    routes: script.dataset.routes || '*',
    projectKey: script.dataset.froamProject || null,
  };
  import(new URL('froam-modules/froam-editor.mjs', src.origin + '/').href).catch(function (error) {
    console.error('[froam] could not load the editor', error);
  });
})();
`
writeFileSync(join(out, 'froam-editor.js'), loader)

const sizes = readdirSync(modules).filter((name) => name.endsWith('.mjs')).map((name) => `${name} ${(statSync(join(modules, name)).size / 1024).toFixed(0)}KB`)
console.log(`standalone: loader + ${sizes.join(', ')} + chunks`)
