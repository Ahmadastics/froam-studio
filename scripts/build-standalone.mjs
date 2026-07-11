/**
 * Bundle the standalone editor (React included) for the universal
 * `froam dev` bridge: dist/standalone/froam-editor.js + froam-editor.css.
 */
import { build } from 'esbuild'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

const result = await build({
  entryPoints: [join(root, 'src', 'standalone.tsx')],
  outfile: join(root, 'dist', 'standalone', 'froam-editor.js'),
  bundle: true,
  minify: true,
  format: 'iife',
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
