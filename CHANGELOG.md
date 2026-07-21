# Changelog

All notable changes to froam-studio are documented here.

## 4.7.0 — 2026-07-21

**Perfect fidelity.** The whole point of Froam is that what you design is
what ships. Two silent gaps broke that promise; both are closed, verified
end-to-end (edit → Save to Repo → plain production page, no editor code).

### Fixed
- **Fonts now actually ship with the design.** The font picker offered 23
  families but nothing ever loaded them — pick Poppins on a site that
  doesn't bundle it and both the preview and production silently fell back
  to a system font. Now every layer loads exactly the fonts the design
  references (draft styles *and* inline styles inside injected blocks):
  `froam.generated.css` gets `@import` lines (Google Fonts + Fontshare
  sources with correct per-family weights), and the editor + React
  `<FroamRuntime/>` inject matching `<link data-froam-fonts>` tags live.
  New shared source map: `src/editor/fontSources.ts` (TS) mirrored in
  `lib/codegen.mjs` (CLI/bridge).
- **Trailing slashes can no longer hide a shipped design.** Route keys were
  raw `location.pathname`, so a design saved at `/page` never applied at
  `/page/` or `/page/index.html` (and vice versa) — servers disagree about
  trailing slashes, and the design silently vanished. One canonical
  `normalizeRouteKey` now runs everywhere: the editor's route hook, the
  React runtime (with a legacy-key fallback for committed designs), the
  vanilla runtime, `mergeSave`, `migrateDesign` (normalizes + merges legacy
  keys on load), and the `data-froam-route` scope in generated CSS.

## 4.6.0 — 2026-07-21

**The Blueprint goes 3D.** The scan already recreates the edited page —
every change, the images, the new fonts, the moved elements — but a flat
sheet can't show *structure*. The new 3D mode can.

### Added
- **3D Blueprint.** A **3D** toggle in the blueprint overlay (next to close)
  lifts every scanned element off the paper by its DOM nesting depth — an
  exploded x-ray of the page where you can *see* what's nested inside what.
  Same category colours, same live scan (reopen after any edit and the 3D
  sheet redraws the current page), same tap-a-part-to-edit jump. Drag to
  orbit, scroll to zoom, double-tap to reset the view. Planes rise level by
  level on entry; `prefers-reduced-motion` renders them already risen. The
  spec card gains a **depth levels** line while in 3D.
- `BlueprintNode.depth` and `BlueprintData.maxDepth`: the scan now records
  each element's normalised DOM nesting depth, so any consumer of
  `computeBlueprintData()` can reason about structure, not just layout.

## 4.5.1 — 2026-07-19

**The Blueprint gets a home.** The right-panel **Prototype** tab was a dead
placeholder; it now holds the Blueprint as a persistent, full-page picture.

### Added
- **Prototype tab = Blueprint.** Clicking **Prototype** in the design panel
  shows a live, scaled-down picture of the *entire* page (true document
  height, not just the viewport), with a category legend, the page's colour
  swatches, and page dimensions. Click the picture or **Open** to launch the
  full interactive blueprint. It's there anytime — no need to wait for the
  first-scan reveal.
- Extracted `computeBlueprintData()` and a reusable `<BlueprintSheet>`
  (`mode="full" | "mini"`) so the overlay and the tab thumbnail draw from one
  source of truth.

### Changed
- The Design / Prototype tabs are now real, switchable buttons (they were
  inert `<span>`s that always showed Design).

## 4.5.0 — 2026-07-19

**The Blueprint, and See-Through controls.** Two things: the first scan now
recreates the page as an engineering drawing, and visibility/opacity/depth
become first-class, thumb-reachable controls.

### Added
- **Blueprint (`FroamBlueprint`).** When the first-open scan finishes it
  transitions into a full schematic of the site: drafting-blue grid paper,
  a wireframe recreation of every element at true *document* scale (the whole
  page, not just the viewport), category-coded strokes that draw themselves
  in like a pen plotter, part labels with live dimensions, and — on wide
  sheets — callout leader lines out to a gutter naming the primary headline,
  navigation, hero media, primary action and footer. A spec card carries the
  site's own colour palette (from the page-palette scanner) and fonts; a
  bottom-right title block carries the page title, route, date and per-category
  element counts. **Tap any part to close the sheet and select that element
  in the editor** — a navigable x-ray. Auto-opens once after the first scan
  (`froam:blueprint-seen:v1`), replayable anytime from the command palette
  (**Blueprint**, drafting-compass icon). Honours `prefers-reduced-motion`
  (everything renders already-drawn) and adapts on mobile.
- **See-Through — opacity.** An opacity chip on the contextual bar: press and
  drag the `%` to fade any element (text, box, container, image), with a live
  read-out and haptic ticks. Accumulates in a ref so fast drags don't lose
  steps to render lag.
- **See-Through — show / hide.** A one-tap eye toggle on the bar. Hiding sets
  `display:none` but remembers the prior display so Show restores the layout;
  the element stays in the Layers panel (and the DOM) to bring back, and the
  whole thing is undoable.
- **Blend modes.** Full `mix-blend-mode` picker (multiply / screen / overlay /
  darken / lighten / dodge / burn / hard- & soft-light / difference /
  exclusion / hue / saturation / colour / luminosity) in the expanded panel.
- **Depth.** A z-index field plus **Bring to front** / **Send to back** on the
  contextual bar's Depth & blend section.

### Fixed
- The Layers-panel visibility eye wrote `display` straight to the DOM, so
  hiding an element there didn't persist to the draft store or ship to the
  repo — now routed through the store (persisted + undoable), matching the
  contextual-bar eye.

## 4.0.0 — 2026-07-18

**Froam v4: phone-first editing.** People have wanted to edit their sites
from their phones for decades; v4 makes the editor genuinely usable on
touch. Pair it with `froam dev --host` (v3.2) and you can fix your mobile
layout on the actual device where mobile bugs live, with every edit still
compiling to committable files on your machine.

### Added
- **Touch canvas (Phase 1).** The canvas is no longer hidden below 640px —
  on a phone, the page itself is the canvas. Long-press any element for
  the context menu (own recognizer with a 450ms hold, 10px slop and
  haptics — iOS Safari never fires `contextmenu` for touches). Move-tool
  drags lock page scrolling (`touch-action`) so elements move instead of
  the page. Double-tap-to-zoom is disabled while editing so double-tap
  reaches inline text editing. Resize handles grow to 26px on coarse
  pointers, with `touch-action: none` so resizing never scrolls.
- **Mobile chrome (Phase 2).** Below 768px the layout collapses to
  toolbar + full-bleed canvas. The design panel moves into a swipeable
  bottom sheet with peek / half / full detents (drag the grabber, or tap
  it to cycle); the Plan/Layers panel becomes a slide-over drawer; the
  toolbar condenses to touch-sized essentials and scrolls horizontally.
- **Selection walker.** Parent / previous / next / first-child steppers
  on the contextual bar — tap near the element you want, then walk the
  DOM to it. Ends the fat-finger selection problem, on desktop too.
- **Scrub to adjust.** Press any numeric control (font size in the bar,
  plus Line/Tracking/Words/Width/Height/Padding/Radius/Gap fields) and
  drag horizontally to change it, with haptic ticks per step. Plain taps
  still focus the input — scrubbing engages after a 6px slop.
- **Page palette.** A pipette button that reads the colors the page
  already uses (computed styles, ranked by frequency), and offers them as
  one-tap chips with a Fill/Text switch. Text mode marks chips that pass
  WCAG 4.5:1 contrast against the current fill.
- **Quick looks.** One-tap style recipes on the contextual bar: Lift,
  Glass, Outline, Pill, Pop (uses the page's own accent color) and
  Reset look.
- **Aa — one-tap text editing.** A dedicated button that starts inline
  copy editing without double-tapping; the bar hides while the keyboard
  is up.
- **Thumb dock.** On mobile the contextual bar docks above the bottom
  sheet in thumb reach (with an Undo button), horizontally scrollable,
  and auto-hides while the sheet is expanded.

### Changed
- Narrow desktop windows (≤900px) now slim the side panels instead of
  hiding the canvas and left panel entirely.
- The floating contextual bar's popovers render in-flow (they were
  clipped by the bar's own scroll container).

## 3.3.0 — 2026-07-14

### Added
- **Page scan.** The first time the editor opens on a project, Froam runs a
  quick laser sweep down the page that outlines every element it maps —
  headings, media, actions and containers, each colour-coded — with a live
  HUD counting them. It's a show, but the numbers are real: they come from
  the actual DOM. Runs once (remembered in `localStorage`), is skippable
  with a click, and can be replayed any time from the command palette
  (**Scan page**). Honors `prefers-reduced-motion`.

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
