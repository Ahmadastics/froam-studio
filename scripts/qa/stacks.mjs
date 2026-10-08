/**
 * The same small site — Kola Logistics, the ship-gate fixture — written the
 * way each stack writes it. Identical ids and copy, so one edit script runs
 * against all of them and the results are comparable.
 *
 * Each stack says how to install, run, build and serve it, where its static
 * files go, and where its <head> lives — the two places a user has to touch
 * to follow Froam's "Ship it (production)" instructions.
 */
import fs from 'node:fs'
import path from 'node:path'

export const COPY = {
  eyebrow: 'Same-day delivery in Abuja',
  headline: 'Send anything across the city before lunch.',
  subtitle: 'Riders you can track, prices you can see, and a receipt for every drop.',
  cta: 'Book a rider',
  ghost: 'See how it works',
}

const CARDS = [
  ['card-1', '', 'Pickup pin', 'Pick up', 'A rider is at your door in under 20 minutes.'],
  ['card-2', '', 'Route pin', 'Track', 'Watch the route live, share the link with anyone.'],
  ['card-3', ' odd', 'Drop pin', 'Drop off', 'Photo proof and a signed receipt, every time.'],
]

/** The page body as HTML. `jsx` swaps class→className and closes void tags. */
export function bodyMarkup({ jsx = false } = {}) {
  const c = jsx ? 'className' : 'class'
  const img = (alt) => `<img src="/pin.svg" alt="${alt}" width="40" height="40"${jsx ? ' />' : '>'}`
  return `<header ${c}="top" id="site-header">
  <a ${c}="brand" id="brand" href="/">Kola</a>
  <nav><a href="#how">How it works</a> <a href="#pricing">Pricing</a></nav>
</header>
<main>
  <section ${c}="hero">
    <p ${c}="eyebrow">${COPY.eyebrow}</p>
    <h1 id="headline">${COPY.headline}</h1>
    <p id="subtitle">${COPY.subtitle}</p>
    <a ${c}="cta" id="cta" href="#pricing">${COPY.cta}</a>
    <a ${c}="ghost" id="ghost" href="#how">${COPY.ghost}</a>
  </section>
  <section ${c}="cards" id="how">
${CARDS.map(([id, odd, alt, h, p]) => `    <article ${c}="card${odd}" id="${id}">${img(alt)}<h3>${h}</h3><p>${p}</p></article>`).join('\n')}
  </section>
  <section ${c}="pricing" id="pricing">
    <h2 id="pricing-title">One flat price per zone</h2>
    <p id="faint">No surge pricing. No hidden fees. Cancel free until pickup.</p>
  </section>
</main>`
}

const indent = (s, n) => s.split('\n').map((l) => ' '.repeat(n) + l).join('\n')
const shipSite = (root) => path.join(root, 'fixtures', 'ship-site')

/** Shared assets every stack serves: the stylesheet and the icon. */
function assets(qaRoot) {
  return {
    css: fs.readFileSync(path.join(shipSite(qaRoot), 'site.css'), 'utf8'),
    svg: fs.readFileSync(path.join(shipSite(qaRoot), 'pin.svg'), 'utf8'),
  }
}

const viteIndex = (body, entry) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kola Logistics</title>
    <link rel="stylesheet" href="/site.css">
  </head>
  <body>
${body}
    <script type="module" src="${entry}"></script>
  </body>
</html>
`

const viteCommands = {
  dev: (port) => ['npx', ['vite', '--port', String(port), '--strictPort', '--host', '127.0.0.1']],
  build: () => ['npx', ['vite', 'build']],
  out: 'dist',
  publicDir: 'public',
}

/** Inserts the two Froam tags before </head> in an HTML-ish file. */
export function addTagsToHead(file, froamUrlBase, { jsx = false } = {}) {
  let src = fs.readFileSync(file, 'utf8')
  if (src.includes('froam.runtime.js')) return false
  const tags = jsx
    ? `<link rel="stylesheet" href="${froamUrlBase}/froam.generated.css" />\n        <script src="${froamUrlBase}/froam.runtime.js" defer></script>`
    : `<link rel="stylesheet" href="${froamUrlBase}/froam.generated.css">\n    <script src="${froamUrlBase}/froam.runtime.js" defer></script>`
  if (!/<\/head>/i.test(src)) throw new Error(`no </head> in ${file}`)
  src = src.replace(/<\/head>/i, `  ${tags}\n  </head>`)
  fs.writeFileSync(file, src)
  return true
}

export function stacks(qaRoot) {
  const { css, svg } = assets(qaRoot)
  const late = `setTimeout(() => { const n = document.createElement('p'); n.id = 'late'; n.textContent = 'Riders online now: 42'; document.getElementById('pricing')?.appendChild(n) }, 300)`

  return [
    {
      id: 'static',
      label: 'Static HTML',
      deps: {},
      files: () => ({
        'index.html': fs.readFileSync(path.join(shipSite(qaRoot), 'index.html'), 'utf8'),
        'site.css': css,
        'pin.svg': svg,
      }),
      static: true,
      copySource: 'index.html',
      out: '.',
    },
    {
      id: 'vite',
      label: 'Vite (vanilla)',
      deps: { devDependencies: { vite: '^8.0.0' } },
      files: () => ({
        'index.html': viteIndex(indent(bodyMarkup(), 4), '/main.js'),
        'main.js': `${late}\n`,
        'public/site.css': css,
        'public/pin.svg': svg,
        'vite.config.js': `import { defineConfig } from 'vite'\nexport default defineConfig({ plugins: [] })\n`,
      }),
      ...viteCommands,
      head: 'index.html',
      copySource: 'index.html',
    },
    {
      id: 'vite-react',
      label: 'Vite + React',
      deps: { dependencies: { react: '^19.1.0', 'react-dom': '^19.1.0' }, devDependencies: { vite: '^8.0.0', '@vitejs/plugin-react': '^6.0.0' } },
      files: () => ({
        'index.html': viteIndex('    <div id="root"></div>', '/src/main.jsx'),
        'src/main.jsx': `import { createRoot } from 'react-dom/client'\nimport App from './App.jsx'\ncreateRoot(document.getElementById('root')).render(<App />)\n${late}\n`,
        'src/App.jsx': `export default function App() {\n  return (\n    <>\n${indent(bodyMarkup({ jsx: true }), 6)}\n    </>\n  )\n}\n`,
        'public/site.css': css,
        'public/pin.svg': svg,
        'vite.config.js': `import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({ plugins: [react()] })\n`,
      }),
      ...viteCommands,
      head: 'index.html',
      ship: 'react-runtime',
      copySource: 'src/App.jsx',
    },
    {
      id: 'vite-vue',
      label: 'Vite + Vue',
      deps: { dependencies: { vue: '^3.5.0' }, devDependencies: { vite: '^8.0.0', '@vitejs/plugin-vue': '^6.0.0' } },
      files: () => ({
        'index.html': viteIndex('    <div id="app"></div>', '/src/main.js'),
        'src/main.js': `import { createApp } from 'vue'\nimport App from './App.vue'\ncreateApp(App).mount('#app')\n${late}\n`,
        'src/App.vue': `<template>\n${indent(bodyMarkup(), 2)}\n</template>\n`,
        'public/site.css': css,
        'public/pin.svg': svg,
        'vite.config.js': `import { defineConfig } from 'vite'\nimport vue from '@vitejs/plugin-vue'\nexport default defineConfig({ plugins: [vue()] })\n`,
      }),
      ...viteCommands,
      head: 'index.html',
      copySource: 'src/App.vue',
    },
    {
      id: 'vite-svelte',
      label: 'Vite + Svelte',
      deps: { devDependencies: { vite: '^8.0.0', svelte: '^5.38.0', '@sveltejs/vite-plugin-svelte': '^7.0.0' } },
      files: () => ({
        'index.html': viteIndex('    <div id="app"></div>', '/src/main.js'),
        'src/main.js': `import { mount } from 'svelte'\nimport App from './App.svelte'\nmount(App, { target: document.getElementById('app') })\n${late}\n`,
        'src/App.svelte': `${bodyMarkup()}\n`,
        'public/site.css': css,
        'public/pin.svg': svg,
        'vite.config.js': `import { defineConfig } from 'vite'\nimport { svelte } from '@sveltejs/vite-plugin-svelte'\nexport default defineConfig({ plugins: [svelte()] })\n`,
      }),
      ...viteCommands,
      head: 'index.html',
      copySource: 'src/App.svelte',
    },
    {
      id: 'astro',
      label: 'Astro',
      deps: { dependencies: { astro: '^7.0.0' } },
      files: () => ({
        'src/pages/index.astro': `---\n---\n<html lang="en">\n  <head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>Kola Logistics</title>\n    <link rel="stylesheet" href="/site.css">\n  </head>\n  <body>\n${indent(bodyMarkup(), 4)}\n    <script is:inline>${late}</script>\n  </body>\n</html>\n`,
        'public/site.css': css,
        'public/pin.svg': svg,
        'astro.config.mjs': `import { defineConfig } from 'astro/config'\nexport default defineConfig({ devToolbar: { enabled: false } })\n`,
      }),
      dev: (port) => ['npx', ['astro', 'dev', '--port', String(port), '--host', '127.0.0.1']],
      stop: ['npx', ['astro', 'dev', 'stop']],
      build: () => ['npx', ['astro', 'build']],
      out: 'dist',
      publicDir: 'public',
      head: 'src/pages/index.astro',
      copySource: 'src/pages/index.astro',
    },
    {
      id: 'next',
      label: 'Next.js (App Router)',
      deps: { dependencies: { next: '^16.0.0', react: '^19.1.0', 'react-dom': '^19.1.0' } },
      files: () => ({
        'app/layout.jsx': `export const metadata = { title: 'Kola Logistics' }\nexport default function RootLayout({ children }) {\n  return (\n    <html lang="en">\n      <head>\n        <link rel="stylesheet" href="/site.css" />\n      </head>\n      <body>{children}</body>\n    </html>\n  )\n}\n`,
        'app/page.jsx': `import Late from './late.jsx'\nexport default function Page() {\n  return (\n    <>\n${indent(bodyMarkup({ jsx: true }), 6)}\n      <Late />\n    </>\n  )\n}\n`,
        'app/late.jsx': `'use client'\nimport { useEffect } from 'react'\nexport default function Late() {\n  useEffect(() => { ${late} }, [])\n  return null\n}\n`,
        'public/site.css': css,
        'public/pin.svg': svg,
        'next.config.mjs': `export default { output: 'export', devIndicators: false }\n`,
      }),
      dev: (port) => ['npx', ['next', 'dev', '-p', String(port), '-H', '127.0.0.1']],
      build: () => ['npx', ['next', 'build']],
      out: 'out',
      publicDir: 'public',
      head: 'app/layout.jsx',
      headJsx: true,
      copySource: 'app/page.jsx',
      env: { NEXT_TELEMETRY_DISABLED: '1' },
    },
  ]
}
