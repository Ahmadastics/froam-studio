# Changelog

## 7.1.0 - 2026-08-08

**Intelligence hardening.** This release strengthens the v7 substrate without
starting v8 systems or replacing proven live-DOM, Rooms or output behavior.

### Added

- Screenshot reconstruction v2 with multi-reference metadata, injectable OCR,
  browser-local `TextDetector` support where available, uncertain/missing-text
  handling, text hierarchy, repeated families and stable graph/DOM identities.
- Render/capture validation using disclosed normalized RGB mean absolute error,
  largest mismatch tiles and a maximum-four-pass geometry correction primitive.
- Framework identity maintenance through observable DOM markers and normal
  registry/fingerprint recovery. No React/Vue private internals are used.
- Project-level identity health metrics in Connected Canvas.
- Limited beta hosted project synchronization contract with reconnect cursors,
  branch/checkpoint isolation, event idempotency and canonical Room-sequence
  enforcement for design operations.
- Lazy checkpoint ancestry for Replay/Design Archaeology, incremental regional
  Scan, attention evaluation fixtures and large-page benchmark tooling.

### Hardened

- Graph materialization and Archive exact-similarity grouping avoid repeated
  full relation/pair scans.
- Responsive collisions use spatial buckets; clipping warnings require actual
  clipping overflow modes, reducing false positives.
- Scan uses indexed registry matching and owned batch mutation. A synthetic
  5,000-node Scan improved from roughly 10.3 seconds to about 76 milliseconds
  on the recorded Windows/Node fixture.
- DNA provenance metadata is compacted while retaining observed/inferred source
  markers; latest materialized scans replace older per-node scans.

### Compatibility

- Project schema remains v2 and DNA schema remains v1; no data migration is
  required. Screenshot analysis result fields are additive.
- Rooms ordering, operation-log reconnect, path-based runtime/code generation,
  Blueprint 2D/3D, Animator and existing v7 projects remain compatible.

## 7.0.0 - 2026-08-08

**Froam Understands.** A coherent Intelligence surface now reads the live DOM
as a structured product while preserving v6 collaboration, Blueprint,
live-DOM editing and path-based output.

### Added

- Local Froam Scan with identity, structure, layout, appearance, interaction,
  responsive and directly detectable accessibility observations. Facts,
  inferences and user-authored knowledge retain explicit provenance.
- Versioned Component DNA, conservative component-family detection, Component
  Archive, Design Archaeology and graph-backed Product Flow.
- Predicted Attention and Visual Rhythm local heuristic experiments, with
  confidence/disclaimer metadata instead of scientific or subjective claims.
- Priority Responsive survival constraints, designer-controlled suggestions,
  Breakpoint Cinema playback/scrubbing and conservative failure observations.
- Experimental local Screenshot → Live UI segmentation that creates ordinary
  Froam nodes, relations, DNA and analysis records.
- Replaceable intelligence-provider boundary with explicit remote-consent and
  privacy disclosure contracts.

### Changed

- Project envelope schema advances from v1 to v2 for scans, archive items,
  analyses and responsive metadata. v1 files migrate automatically without
  changing event IDs or the embedded legacy design.
- Checkpoints now record ancestry and branches retain a root checkpoint, so
  Replay can traverse the complete recorded branch timeline before the active
  checkpoint.
- Connected Canvas and Froam Intelligence consume one shared project document.

### Compatibility

- `froam.design.json`, live-DOM selection/editing, stable identity recovery,
  Rooms, operation-log undo/redo, Blueprint 2D/3D, Animator and generated
  path selectors remain intact.
- No AI model, remote analysis service or new runtime dependency is bundled.

All notable changes to froam-studio are documented here.

## 6.3.0 - 2026-08-08

**Connected Canvas becomes usable.** Collaboration identity, deterministic
history, prototype branches, stable node identity, the project graph and the
shared interaction model now meet in one editor surface.

### Added
- Avatar-first multiplayer presence with a collaborator rail and contextual
  selection/tool/action labels; avatar URLs remain member metadata rather than
  heartbeat payloads.
- Replay controls with scrub, restart, playback speeds and reliable actor and
  semantic-category filters.
- Prototype UI for fork, switch, rename and protected deletion, with parent and
  fork-point visibility and isolated materialized branch state.
- Advanced stable-node diagnostics and observable recovery outcomes.
- Experimental graph inspector with canvas selection synchronization.
- Interaction inspector and a compatibility adapter from the existing Animator
  configuration to `FroamInteraction`.

### Compatibility
- `froam.design.json`, path selectors, live-DOM editing, Blueprint, Rooms and
  generated output retain their existing behavior.
- No project schema bump is required; all v6.3 data additions are optional or
  expressed through existing schema-v1 events.

### Known limits
- No branch merge or MUTATE.
- Replay is reliable from the active checkpoint forward; host changes never
  represented in Froam history cannot be reconstructed.
- Graph and interaction inspectors remain explicitly experimental.

## 6.2.0 - 2026-08-08

**The Connected Canvas foundation.** Froam now has stable object identity and
a versioned project substrate beneath the existing live-DOM editor. Current
v3 design files, runtime CSS and path selectors remain fully compatible.

### Added
- Stable `FroamNodeRef` records with `data-froam-id`, legacy path and anchor
  fingerprint recovery, including native nodes and duplicate-ID prevention.
- A v1 project envelope preserving the existing v3 design verbatim, with
  additive migration for old design files.
- Deterministic project events, checkpoints and isolated branch primitives
  built around the existing operation log.
- Shared graph, Scan-to-DNA, interaction-runtime and simulation boundaries.
- Optional `froam.project.json` bridge and Vite-plugin load/save endpoints.
- Node-aware presence and comments, member avatars and tool/action metadata.
- A platform implementation ledger with explicit feature maturity.

### Compatibility
- Live editing, undo/redo, Rooms, Blueprint, generated CSS and runtime output
  retain their existing path-based behavior.
- Research-heavy roadmap features are disabled by default.

## 6.1.0 — 2026-08-08

**Froam Rooms is complete.** The review room introduced across v5 is now the
same room two designers can edit together. The page remains owned by the host
repo; only Froam's small design and collaboration layers travel over the wire.

### Added
- Server-ordered, idempotent operation streaming with cursor replay and an
  offline-first client queue. Reconnects start from the room log and duplicate
  submissions stay singular.
- Studio invites, live member presence, selection halos, cursors and soft locks.
- Authority-aware conflict handling: a concurrent owner write wins; an editor
  may still make a later change after observing it.
- Cross-user undo proposals. Guest editors propose; owners approve or decline;
  an approved revert is attributed to the owner who enacted it.
- Ephemeral room chat, distinct from persistent anchored review comments.
- Structural edit metadata on ordinary field ops, allowing insert, move,
  delete and wrap changes to travel through the same ordered log.
- Optimistic-concurrency support in the reusable room storage contract, used by
  the Run'Am reference host to avoid lost serverless writes.

### Security
- Room identities now receive a per-member session credential. A public actor
  id is no longer sufficient to impersonate another member.
- Op payloads, cursors, fields, roles and batch sizes are validated server-side.

### Changed
- Review, comments and revisions receive room events immediately; polling is a
  reconnect fallback rather than the source of truth.
- The package version now reflects the collaboration architecture already
  developed through the v5 commits.

## 4.9.3 — 2026-07-29

**A save reaches everywhere.** Publishing already worked end to end — client,
API and runtime — but three faults sat between pressing save and seeing it on
another device, and the design could only reach a git repo from the one machine
running `froam dev`. Both are fixed.

### Added
- **Publish straight to GitHub, from any device.** `createGitHubCommitter`
  commits `froam.design.json` and its generated CSS through the GitHub Contents
  API, so a design saved from a phone lands in the repo and whatever deploys
  from it redeploys. Pass it to `createFroamPublishApi({ commit })` and one save
  does both legs. Files are byte-identical to the ones the local bridge writes.
- **`prefer` on `FroamRuntime`.** `'repo'` (default) keeps the no-runtime-API
  promise; `'newest'` lets a design published after the last commit win, which
  is what you want when people publish from devices that can't reach a repo.
- `buildDesignArtifacts(design)` in the codegen — the three shipped files as
  strings, with no filesystem.

### Fixed
- **A device that had ever been edited never received a published design
  again.** The editor refused a publish outright if the route had any local
  draft. It now merges per field: a local edit made after the publish is kept,
  anything older gives way, and you're told how many changes were kept.
- **The published-design load never completed under React StrictMode** — the
  first mount claimed the route, the second skipped it, and the first response
  was discarded. A mount torn down before its answer arrives now releases the
  claim.
- **A committed design silently beat every publish for the same route**, with
  no feedback. See `prefer` above.

## 4.9.2 — 2026-07-27

**Undo stops forgetting.** History was twenty snapshots of the entire design,
held in memory and thrown away on refresh. It's now an append-only log of
individual edits, so undo goes back as far as the work does — and survives a
reload.

Under the hood this is the substrate for Froam Rooms (see `ROADMAP.md`):
recording *what changed* rather than *what everything looked like* is what
later lets two people edit the same design without overwriting each other.

### Added
- **Undo that survives a reload.** Close the tab, come back tomorrow, Ctrl+Z
  still walks back through yesterday's work. The log lives under
  `froam-oplog-v1` and compacts itself when space runs short — history is
  traded away before the design ever is.
- **Undo depth is no longer capped.** It was twenty steps; it's now bounded
  only by storage, because one edit costs a few hundred bytes instead of a
  copy of the whole page's design.
- **Labelled undo.** The toast names what it reverted — "Undone — Fill" — and
  a colour-picker drag is still a single step.
- **`npm test`** — 45 assertions over the op log, wired into CI.

### Fixed
- **Undoing a text edit left the typed words on screen.** The draft reverted
  but the page didn't, because inline editing writes into the DOM rather than
  into a style attribute. Froam now remembers the element's original copy and
  puts it back.
- **Edits made by inline text editing and drag-to-move weren't undoable at
  all.** Only three of the editor's mutation paths were tracked; every store
  change is now recorded, however it was made.
- **A restyle across a multi-selection took one undo per element.** It's one
  step, as it always looked like it should be.

### Changed
- Undo and redo no longer deep-copy the design on every edit, so editing a
  large page no longer gets slower the longer you work on it.

## 4.9.1 — 2026-07-25

**Quick Looks, second wave.** 29 more one-tap recipes (6 → 71 total) and
two new groups, so the gallery covers texture and text effects too.

### Added
- **29 new looks**, in ten groups now:
  - **Texture** *(new group)* — Stripes, Dots, Grid, Spotlight
  - **Effect** *(new group)* — Hollow (text outline via `-webkit-text-stroke`),
    Invert (`mix-blend-mode: difference`), Echo (offset text shadow)
  - **Depth** — Layered (stacked shadow), Halo (soft accent ring)
  - **Surface** — Sheen (top-light), Cream (warm card)
  - **Shape** — Chamfer (octagon), Ticket (side notches), Chevron, Diamond
  - **Line** — Edge (gradient border via `border-image`), Dotted, Quote
    (left bar), Rule (top bar)
  - **Accent** — Conic, Duotone (hard split), Gold, Fire
  - **Type** — Serif, Mono (both patch the font-family control), Neon (glow),
    Emboss (letterpress)
  - **Bold** — Punch (chunky uppercase button), Frame (inset keyline)
- More accent-aware recipes: Halo, Stripes, Dots, Grid, Spotlight, Edge,
  Dotted, Quote, Rule, Duotone, Neon, Hollow, Echo and Punch all derive
  their shades from the page's picked accent via `color-mix`.

### Changed
- **Reset look** now also clears `border-image`, `-webkit-text-stroke`,
  `text-transform` and `letter-spacing`, so it undoes any wave-two look too.

## 4.9.0 — 2026-07-25

**Quick Looks becomes a gallery.** The one-tap style recipes on the
contextual bar (the `✦` button) went from 6 to 42, organized into eight
browsable groups so a design that needs a shape, a shadow, or a fill is one
tap away — the popover now scrolls when the ideas outrun the screen.

### Added
- **36 new looks**, grouped for browsing:
  - **Depth** — Lift, Float, Soft (neumorphic), Inset, Ring, Glow
  - **Surface** — Glass, Frost, Ink, Paper, Slate, Tint
  - **Shape** — Pill, Slab, Squircle, Blob, Bevel, Tag, Arch, Leaf
  - **Line** — Outline, Hairline, Dashed, Double, Underline
  - **Accent** — Pop, Gradient, Sunset, Aurora, Ocean, Candy, Mesh
  - **Type** — Grad Text, Eyebrow, Display, Marker, Quiet
  - **Bold** — Sticker, Brutal, Comic, Retro
- **Accent-aware recipes.** Ring, Glow, Tint, Dashed, Double, Underline,
  Pop, Gradient, Grad Text, Marker and Retro derive their shades from the
  page's own picked accent via `color-mix`, so a look fits whatever palette
  it lands on.
- Grouped, scrollable Quick Looks popover with per-group labels
  (`froam-floating-bar__looks-scroll` / `__looks-section` / `__looks-label`).

### Changed
- **Reset look** is now thorough — besides shadow, border and backdrop, it
  clears gradients (`background-image`), clip-paths, text-clip
  (`-webkit-text-fill-color`, `background-clip`), filters, text-shadow and
  blend modes, so it fully undoes any of the new looks in one tap.

## 4.8.0 — 2026-07-21

**Publish, everywhere.** The publish path (edit on one device, refresh on
another — no commit, no build) used to require a custom backend. Now it's
a first-class part of Froam.

### Added
- **The bridge is a publish backend.** `froam dev` now serves
  `GET/POST /api/froam/published` itself (all modes, including `--app`
  proxy), persisting to `froam/froam.published.json` next to your design.
  Publish from the laptop, refresh on the phone (`--host`) — it's live.
  Previously the bridge refused publishes with a 501.
- **`froam-studio/server`** — `createFroamPublishApi({ file, authorize })`,
  a dependency-free Node handler (plain http or Express) so ANY backend can
  mount the same two-endpoint contract for production. Route keys are
  normalized with the same rule as everywhere else.
- README: "Publish — live designs across devices, no deploy" section
  documenting the flow and the endpoint contract for custom backends.

### Changed
- Standalone editor (script-tag / bridge mode) now passes the bridge origin
  as `apiBaseUrl` to both `FroamRuntime` and `FroamGate`, so published
  designs load and publishes land on the bridge even when the page is
  served by a different dev server.

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
