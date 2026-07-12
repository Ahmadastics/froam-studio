# Changelog

All notable changes to froam-studio are documented here.

## 3.2.0 — 2026-07-12

### Added
- `froam dev --host [addr]` — expose the bridge on your local network and
  print the LAN URLs, so you can open the edited site on a phone over the
  same Wi-Fi. The bridge now binds to localhost by default (safer); `--host`
  opts into network exposure.
- First-open quick tips: a one-time dismissible card in the editor showing
  the three moves that matter — click to select, `Ctrl+K` palette,
  `Ctrl+Shift+S` save to repo.

### Changed
- The floating trigger button is completely redesigned: a code-drawn orb
  with a rotating teal→coral conic ring, glass core, F monogram, sheen
  sweep, and a hover hint pill with the `Ctrl+.` shortcut. The old image
  asset is gone from the button (custom persona avatars still supported);
  everything animates with `prefers-reduced-motion` respected.

## 3.1.0 — 2026-07-11

First standalone release. Froam Studio now lives in its own repository and
installs directly from GitHub — no npm registry needed:

```bash
npm install git+https://github.com/Ahmadastics/froam-studio.git
```

The prebuilt `dist/` (including the standalone editor bundle used by
`froam dev`) is committed to the repo, so installs need no build step and no
TypeScript toolchain on the consumer side.

### Added
- `froam version` (also `--version` / `-v`) — prints the installed version.
- `froam dev --open` — opens the browser automatically once the bridge is up
  (proxy and static modes).
- MIT license, changelog, and CI workflow that builds the package on every push.

### Changed
- Fully product-neutral editor: the save button, export filenames, site-planner
  presets, and placeholder copy no longer reference Run'Am.
- Editor localStorage keys renamed from `runam-*` to `froam-*`. Existing drafts,
  history, and local versions migrate automatically on first load.
- Package metadata: repository, author, license, keywords, and Node >= 18
  engines field.

## 3.0.0

Froam goes universal: works with **any** project that serves a page.

- New `froam` CLI: `init`, `dev`, `build`, `status`, `doctor`, `migrate`.
- Universal dev bridge (`froam dev`) with three modes: proxy an existing dev
  server, serve a static folder, or script-tag-only.
- Standalone editor bundle (React included) injected into any page.
- Repo Mode: every save compiles the design to committable files —
  `froam.design.json`, `froam.generated.css`, and a zero-dependency
  `froam.runtime.js` (~2 kB gzipped) for non-React production sites.
- Design file format v3 (adds `meta`, generated runtime); automatic migration
  from v2.

## 2.x

- Figma-style editor overlay for Vite + React apps: layers, smart guides,
  resize handles, shape library, animator, versions panel, site planner,
  PNG/SVG/JPEG export, per-viewport editing (desktop / tablet / mobile).
- `FroamGate` + `FroamRuntime` React API and `froam-studio/vite` plugin.
