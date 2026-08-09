# Froam Platform Implementation Ledger

## v8.0.4 — Personal Froam and expressive motion

- **Completed systems:** versioned browser-local UI preferences; right-click
  UI customizer; toolbar top/bottom placement; attached/floating navigation;
  standard/mirrored panels; panel sizing; compact/comfortable density; UI
  scale; label visibility; surface and accent selection; 34 searchable Animator
  quick motions; shared preset-to-interaction adapter; Gravity force diagram,
  strength/radius controls and temporary live preview.
- **Partially completed systems:** the interaction runtime continues to support
  only the compiler/runtime targets already implemented. Preset authoring is
  broader, but not every possible host trigger or physical relationship has a
  production runtime adapter yet.
- **Experimental prototypes:** Interaction Library, Design Physics and UI
  Gravity remain independently flagged and disabled by default. Their visible
  previews are real and deterministic, but the maturity label has not changed.
- **Architecture-only foundations:** animation quick options adapt into the
  shared `FroamInteraction` model; no parallel behavior format was introduced.
- **Research-only features:** unchanged; Reality, external Sampling and other
  previously bounded experiments were not promoted by this release.
- **Migrations introduced:** none. UI preference version 1 is separate from the
  project envelope; project schema remains v2 and legacy path output is intact.
- **Tests added:** UI preference sanitization/persistence/quota tolerance,
  motion family/catalog coverage, preset interaction adaptation, right-click
  customizer reachability and Physics preview wiring. Existing deterministic
  Gravity tests cover direction and Lab-only safeguards.
- **Known limitations:** Gravity still needs an explicit runtime target/host
  relationship for deployed multi-object force behavior; preview uses a safe,
  temporary Web Animations effect on the current selection. UI customization is
  local to the browser by design and does not sync through project Rooms.
- **Architectural decisions:** editor chrome preferences never mutate canvas
  content; animation and Interaction Library share one preset vocabulary;
  physical preview and persisted metadata use the same `gravityForce` inputs.
- **Remaining work:** harden additional host runtime adapters and relationship
  pickers before promoting Gravity or the Interaction Library from Experimental.

## v8.0.3 — Connected structure workspace

- **Completed:** Plan/Layers reorganized as Build/Outline; selection-aware
  quick insertion; project/branch/route context; Archive reuse inside Build;
  deeper live hierarchy; keyboard tree semantics; direct DNA, Responsive,
  Interaction and Archive routes from a selected layer.
- **Architecture:** the existing Site Planner adapter now writes owned page,
  frame and relation records into the active event-sourced project branch.
  Outline reads stable DOM identity and decorates it from the same materialized
  graph, DNA, interaction, responsive and archive state.
- **Compatibility:** `froam-site-plan-v1` still loads and saves. Planner writes
  tolerate quota failure. Live DOM, Blueprint 2D/3D, collaboration, operation-
  log undo/redo and path-based runtime/code generation are unchanged.
- **Migration:** none. Project schema remains v2; the adapter marks its graph
  records for safe updates/removals.
- **Tests:** Site Planner graph ownership, shared-graph wiring, connected labels,
  Archive shelf, stable identity presentation and keyboard tree reachability.
- **Known limitation:** a host node only shows project knowledge after it has a
  stable ID (selection or Scan captures one). The planner keeps its small local
  authoring model as a compatibility view over the shared graph for now.

## v8.0.2 unified-chrome status — 2026-08-09

- **Completed:** toolbar/workspace merge; single contextual rail; one docked
  inspector lane for Intelligence, Connected Canvas, Labs and Advanced; shared
  panel-toggle semantics; mode/panel restoration; neutral Laboratory home;
  feature-flag-derived Experiment tools; desktop, narrow and mobile geometry.
- **Partially completed:** Advanced remains the preserved legacy editor surface,
  now reachable and docked, but its internal controls have not been rewritten.
- **Experimental prototypes:** unchanged. Existing v8 flags and maturity labels
  remain authoritative; no experiment was promoted by this release.
- **Architecture-only foundations:** contextual modes select a single visual
  owner while Connected Canvas retains its necessary history/graph sub-tabs.
- **Research-only features:** unchanged; Synthetic UX and Reality remain
  explicitly research-labelled and disabled by default.
- **Migrations:** none. Project schema remains v2; workspace/Labs preferences
  remain additive, browser-local and quota-safe.
- **Tests added:** neutral Laboratory availability, merged chrome ownership,
  duplicate-action removal, inspector reservation and hidden redundant panel
  tabs. Full project/collaboration suites remain green.
- **Known limitations:** the narrow chrome rail intentionally scrolls when all
  enabled capabilities cannot fit. Advanced still carries its legacy v4 label
  internally for compatibility.
- **Decisions:** preserve live-DOM editing and existing feature internals; merge
  navigation and ownership around them. Only one context inspector owns the
  right lane at a time; mobile uses a bounded panel above the bottom rail.
- **Remaining:** deeper semantic contextuality and arbitrary graph/archive
  command indexing remain future hardening, not part of this organization pass.

## v8.0.1 editor-shell status — 2026-08-09

- **Completed:** one Create / Understand / Experiment workspace shell; persistent
  mode/section state; project/prototype anchor; native compact presence;
  selection-contextual rails; explicit maturity; shared temporal ownership;
  workspace/prototype command search; keyboard, reduced-motion and mobile shell.
- **Preserved through Advanced:** history, review, notes, chat, tokens, assets,
  transitions, diagnostics and Connected Canvas developer inspection remain
  reachable without competing with normal editing by default.
- **Architecture-only:** temporal tools share shell ownership and status, not
  incompatible internal models. Command entity indexing is deliberately bounded.
- **Migrations:** none. Project schema remains v2. Shell and Labs preferences are
  browser-local, quota-safe, additive keys.
- **Tests:** mode switching, contextual selection, independent flag visibility,
  project/prototype identity, avatar overflow/accessibility, temporal switching,
  preference recovery/quota behavior, command aliases, keyboard semantics,
  reduced motion, mobile behavior and legacy reachability.
- **Known limitations:** arbitrary graph/archive entity search and deeper semantic
  contextuality remain future hardening work. No v8.1 feature work was started.

See `FROAM_V8_EDITOR_SHELL.md`.

## v8.0 release status — 2026-08-09

- **Completed foundations:** one Interface Laboratory shell; shared provider,
  provenance, branch, graph, analysis and interaction boundaries; worker-backed
  exact project packing with latest-write coalescing; screenshot-state comparison.
- **Experimental implementations:** protected/conflict-aware MUTATE; Interaction
  Library; native observable Sampling; explicit-permission External Sampling
  extension prototype; Physics; Gravity; isolated Chaos; UI Sound; real-state
  Trailer storyboards.
- **Research implementations:** deterministic Synthetic UX provider/runner and
  bounded probable-screen Reality rectification. Neither is represented as
  production intelligence.
- **Migrations:** none. Project schema remains v2; added relation/analysis kinds
  and metadata are additive. Old full and packed documents remain readable.
- **Tests:** mutation isolation/protection/adoption/conflicts; library CRUD/search/
  preview/rebinding; native/external sampling privacy and limits; deterministic
  physics/gravity; chaos restoration and critical priority; synthetic replay;
  sound safeguards; trailer editing; screenshot-state inference; Reality bounds;
  exact async packing.
- **Known limits:** external sampling cannot recover source or inaccessible DOM;
  physics is approximate; Synthetic UX is not human evidence; Reality needs
  manual confirmation; Worker cloning and peak transient allocation remain
  measurable; runtime export adapters are not universal.
- **Decisions:** all Labs default off independently; mutation prototypes fork
  before events; adoption refuses diverged targets; observable sampling never
  claims original implementation; v9/Froam Space remains untouched.
- **Remaining:** browser corpus/e2e evaluation, distributed external-sampling
  privacy review, incremental/transferable packing, evaluated synthetic agents,
  broader sound/runtime export, and screenshot-state accuracy fixtures.

See `FROAM_V8_EXPERIMENTS.md`, `FROAM_V8_PERFORMANCE.md`, and
`FROAM_UI_SAMPLING_FEASIBILITY.md`.

## v7.2 release status — 2026-08-09

- **Production/Beta:** exact-round-trip packed storage, scan-derived DNA
  projection, repeated-content addressing, quota-safe recovery, aggregate-only
  identity telemetry, and an Advanced identity-health dashboard.
- **Beta:** hosted project sync now has a vendor-neutral durable-store contract,
  revision transactions, branch/checkpoint validation, stale-cursor recovery,
  idempotent retry, and concurrency coverage. Rooms remain canonical for design
  operations. Authorization and a multi-process database are host concerns.
- **Experimental:** Screenshot → Live UI and Predicted Attention remain provider
  experiments. MUTATE, Interaction Library, native UI Sampling, Design Physics,
  and Motion Gravity now have independently flagged Labs prototypes on the
  shared branch/graph/DNA/interaction substrate.
- **Research:** external UI Sampling, Synthetic UX, Reality Mode, and Froam
  Space. Make it Froam received no implementation effort.

See `FROAM_V7_2_STORAGE_PERFORMANCE.md`, `FROAM_V7_2_LABS.md`, and
`FROAM_UI_SAMPLING_FEASIBILITY.md` for measurements and boundaries.

Last updated: 2026-08-08 · Release: 7.1.0 — Intelligence Hardening

## v7.1 hardening status

- **Screenshot → Live UI remains Experimental.** It now has multi-reference
  inputs, injectable OCR, public browser-local OCR when available, stable
  graph/DOM identities, conservative text roles, repeated-family inference,
  render/capture validation, largest mismatch tiles and a four-pass maximum
  geometry-correction boundary. It still lacks bundled cross-browser OCR,
  perceptual diffing, asset recovery and reliable responsive inference.
- **Hosted project synchronization is limited Beta.** A separate delta contract
  synchronizes branch-scoped project events/checkpoints idempotently by cursor.
  Design operations must carry their Room sequence, keeping Rooms canonical.
  Host authentication/storage configuration is required; the editor does not
  silently enable a second canonical transport.
- **Framework identity maintenance is Beta diagnostic infrastructure.** React
  and Vue are detected only through public DOM markers. A bounded mutation
  observer reuses normal registry/path/fingerprint recovery. Private fibers or
  component instances are deliberately not read.
- **Incremental Scan is Beta infrastructure.** Changed top-level regions can be
  rescanned while unaffected records/DNA remain valid. Full Scan remains an
  explicit action and the normal UI cap remains conservative.
- **Predicted Attention remains Experimental.** Provider evaluation fixtures
  now report top-choice agreement and top-three recall. Confidence describes
  available heuristic evidence, not human gaze accuracy.
- **Replay/Archaeology remain Beta.** Checkpoint parents now cross prototype
  forks and ancestry is walked lazily from the active checkpoint.

See `FROAM_V7_1_PERFORMANCE.md` for the reproducible synthetic profile.

## Production

- Stable Froam node identity, duplicate prevention, registry persistence,
  fingerprint recovery and legacy path compatibility.
- Versioned project serialization/deserialization with automatic v1→v2
  migration and unchanged `froam.design.json` compatibility.
- Existing live-DOM editor, path-based runtime/code generation, Rooms,
  operation-log undo/redo, Blueprint 2D/3D and Animator compatibility.

## Beta

### Froam Scan

- **Architecture:** local DOM scanner emits graph-compatible, node-addressed
  scan records. Every knowledge item is `observed`, `inferred`, or
  `user-defined`, with confidence/reasons where applicable.
- **Dependencies:** node registry, anchor fingerprints, live DOM, project graph.
- **Tests:** structure/style extraction, stable identity mapping, conservative
  semantics and repeated-family detection.
- **Limitations:** browser-observable signals only; event-listener visibility
  depends on explicit DOM/Froam metadata; this is not an accessibility audit.
- **Future:** incremental mutation invalidation and optional framework adapters.

### Component DNA and DNA Inspector

- **Architecture:** serializable `FroamDNA` schema v1 attaches identity,
  structure, appearance, semantics, behavior, responsive, accessibility,
  history, usage and provenance-aware knowledge to stable node IDs.
- **Dependencies:** Scan, graph, history and responsive metadata.
- **Tests:** versioning, serialization, unknown preservation, provenance and
  responsive metadata.
- **Limitations:** DNA is as complete as its observed and recorded inputs;
  unknown values deliberately remain unknown.
- **Future:** incremental DNA updates and richer interaction/runtime adapters.

### Component Archive

- **Architecture:** project-level archive entries reuse normal DNA, graph IDs,
  source markup and provenance. Search, preview, reuse, removal and conservative
  similarity are service operations, not a second component database.
- **Dependencies:** stable identity and DNA.
- **Tests:** add/remove, persistence, search, reuse, provenance and identity.
- **Limitations:** v7 preview is lightweight; inserted HTML is sanitized and
  receives fresh identities, but asset packaging is not yet portable.
- **Future:** lazy visual previews, cross-project packages and user-approved
  duplicate merging.

### Design Archaeology

- **Architecture:** projects node history, branch ancestry, creators, archive
  origins and recorded rationale from the canonical event/graph substrate.
- **Dependencies:** stable identity, branch lineage and project history.
- **Tests:** creation, author/branch lineage and refusal to invent rationale.
- **Limitations:** host DOM changes outside Froam history have no archaeology.
- **Future:** richer before/after forms when structural operation payloads grow.

### Product Flow

- **Architecture:** screens are project graph nodes; transitions and conditions
  are project graph relations. Editor/flow navigation resolves shared IDs.
- **Dependencies:** project graph and stable identities.
- **Tests:** node/transition persistence and graph relationships.
- **Limitations:** v7 provides a focused list/connection surface, not Froam
  Space or a large spatial graph renderer.
- **Future:** scalable graph layout and richer state/error/success authoring.

### Priority Responsive and Breakpoint Cinema

- **Architecture:** user-defined survival policies live in project responsive
  metadata and DNA can reference them. A deterministic width sequence observes
  DOM state, records markers and generates non-destructive suggestions.
- **Dependencies:** Scan, stable identity and live DOM measurements.
- **Tests:** policy serialization, constraints, deterministic cinema widths,
  overflow/collision/touch-target observations and state restoration seams.
- **Limitations:** suggestions never rewrite CSS; browser layout observation can
  only explain decisions backed by recorded policy. Detection is conservative.
- **Future:** cached width snapshots, richer breakpoint attribution and an
  explicit apply/review workflow.

### Connected Canvas (carried from v6.3)

- Replay, prototypes, identity diagnostics, graph/interaction inspectors and
  avatar presence remain beta. v7 adds checkpoint ancestry/root checkpoints so
  full recorded branch replay is no longer limited to the active checkpoint.

## Experimental

### Predicted Attention

- Local, replaceable heuristic adapter produces a ranked node list, overlay,
  confidence and explicit disclaimer. Results are dynamic `FroamAnalysis`
  records rather than intrinsic facts. It is not eye tracking and has no
  scientific precision claim. A validated model/corpus is future work.

### Visual Rhythm

- Local rule-based analysis detects repeated composition, dimensions and
  spacing over scan records. Language reports measured repetition and never
  declares a design “boring.” Scroll-level validation and actionable review
  workflows remain future work.

### Screenshot → Live UI

- An explicit local task decodes image pixels, segments regions and generates
  normal Froam graph nodes, relations, preliminary DNA and editable injected
  elements. It rejects invalid, unsupported and oversized inputs. It does not
  recover original source code, OCR text, assets, responsive behavior or
  pixel-perfect layout. Multiple-reference and render/diff loops are represented
  by provider boundaries but are not claimed complete.

### Shared simulation and interaction seams

- Deterministic simulation runner and `FroamInteraction` adapters remain
  experimental foundations. v7 does not market them as Chaos Testing,
  Synthetic UX or an Interaction Library.

## Research only / architecture only

- External website UI Sampling, full Interaction Library marketplace, MUTATE,
  branch merge, Design Physics, UI Gravity, Synthetic UX, complete Chaos
  Testing, Reality Mode, Trailer Generator, Froam Space and Make it Froam.
- No v8 product implementation is included. Their prerequisites may consume
  v7 identity/graph/analysis/provider contracts later.

## Shared model changes

- Project schema v2 adds `scans`, `archive`, `analyses` and `responsive` state.
- Graph relations add `variant-of`, `belongs-to` and `connected-to`.
- Scan/DNA knowledge uses explicit observed/inferred/user-defined provenance.
- Analyses are time-scoped records, separated from intrinsic DNA.
- Branches retain `rootCheckpointId`; checkpoints retain
  `parentCheckpointId`, allowing ancestry-aware Replay.
- Connected Canvas and Intelligence use one editor-owned project document.

## Migrations

- `froam.project.json` v1 migrates to v2 on parse/load. New collections default
  empty, DNA gains its own schema version, branch root checkpoints are derived,
  and event IDs/history/legacy design are preserved.
- The bridge sidecar store reads v1 and writes valid v2 envelopes.
- Existing v3 design migration and path-based output are unchanged.

## Performance

- Scan, attention, rhythm and screenshot work are explicit user actions, never
  pointer-move work. Graph/DNA outputs are persisted for reuse.
- Breakpoint Cinema uses bounded deterministic width steps and request-driven
  playback; it restores preview styles when stopped/closed.
- Project saves remain debounced. Archive browsing searches stored metadata and
  does not eagerly render off-screen component trees.
- Large pages and continuous responsive observation still need profiling and
  cache invalidation before these beta systems can graduate.

## Tests added in v7

- v1→v2 compatibility and unchanged legacy design/event identity.
- Root-checkpoint replay ancestry.
- Scan structure/styles/semantics/families and DNA provenance/unknowns.
- Archive lifecycle/reuse/provenance; Archaeology lineage/no invented reasons.
- Product Flow graph relations; Attention/Rhythm claim boundaries.
- Responsive policy/cinema/failure observations.
- Screenshot node/DNA validity and failure handling.
- Provider privacy disclosure and explicit remote-consent enforcement.

## Known limitations and pre-v8 fixes

- Hosted, branch-aware project-document synchronization remains absent; Rooms
  synchronize the proven operation layer, not every v2 intelligence record.
- Unrecorded host DOM mutation cannot replay or produce archaeology.
- Framework rerenders can remove `data-froam-id`; registry/path/fingerprint
  recovery works, but framework-native identity adapters would be stronger.
- Branch merge remains deliberately absent.
- Screenshot reconstruction needs OCR/model adapters, multi-image inference and
  a meaningful render/capture/diff loop before it can leave Experimental.
- Attention needs validation data before any stronger accuracy claim.
- Large-page Scan/Cinema need performance profiling and incremental caches.

## Architectural decisions

- Intelligence is a separate coherent surface; Connected Canvas stays focused
  on collaboration/history/graph debugging.
- All ten v7 views share identity, project graph, history, DNA and analyses;
  none owns a parallel database.
- Observed facts, inference and user intent are never collapsed into one truth.
- Remote intelligence adapters must disclose processing and receive explicit
  consent; v7 ships only local implementations.
- Runtime/code-generation selectors remain path-based in v7.

## What v7 unlocks

- A trustworthy structured representation for future richer interaction,
  simulation, comparison and spatial views.
- Stable component understanding reusable by future MUTATE and Froam Space
  without inventing another identity or graph layer.
- Provider boundaries for future validated semantic, attention and screenshot
  models without coupling Froam to one vendor.
