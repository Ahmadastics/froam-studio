import { build } from 'esbuild'

await build({
  entryPoints: ['lib/publish-store.mjs'],
  outfile: 'server.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  sourcemap: false,
  logLevel: 'info',
})
