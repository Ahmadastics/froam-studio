# Froam Platform Implementation Ledger

Last updated: 2026-08-08 · Release: 6.3.0 Connected Canvas

## Production

- Stable node references with `data-froam-id`, legacy path compatibility, duplicate prevention and registry persistence.
- Versioned `froam.project.json` envelope with exact `froam.design.json` compatibility.
- Existing live-DOM editing, path-based runtime/code generation, Blueprint 2D/3D, Rooms, undo/redo and collaboration operation log.
- Lightweight room presence: avatar metadata is stored on the member once; heartbeats carry only location, selection, tool and action references.

## Beta

- Connected Canvas panel with Replay, Prototypes, Node Inspector, Graph Inspector and Interaction Inspector.
- Deterministic Replay with play, pause, restart, scrub and 1x/4x/10x/20x speeds; actor and structural/styling/text/interaction filters.
- Prototype branches: create/fork, switch, rename, parent/fork-point display, leaf deletion and main protection. Switching materializes an isolated branch snapshot.
- Avatar-first canvas presence, quiet contextual labels and collaborator rail.
- Identity recovery diagnostics for lost attributes, path fallback, stale paths, fingerprint recovery, ambiguity, registry updates and failures.
- Local project persistence plus debounced repo-sidecar saves through the existing bridge.

## Experimental

- Project graph tree with registry/page materialization and editor↔graph selection sync.
- Existing Animator adapter to the shared `FroamInteraction` model and an interaction record inspector.
- Deterministic simulation runner retained as an interface for later Chaos Testing work.

## Research

- Component DNA product features, Component Archive, Screenshot-to-Live-UI, Attention Heatmap, Priority Responsive, Breakpoint Cinema and external UI Sampling.
- MUTATE, Synthetic UX, Design Physics, UI Gravity, Reality Mode, Trailer Generator, Froam Space and Make it Froam.

## Migrations

- No project schema bump: v6.3 adds optional registry diagnostics and new project event consumers within schema v1.
- Legacy Animator configuration adapts into `FroamInteraction`; legacy CSS animation application remains intact.
- EditorStore can now be projected back into the legacy v3 design shape for sidecar persistence.
- Existing v3 designs still migrate additively and remain the runtime/code-generation compatibility view.

## Tests added in v6.3

- Identity loss after rerender, verified path recovery, fingerprint recovery and ambiguous-match refusal.
- Replay ordering, actor/category filtering, legacy-operation projection and checkpoint continuation.
- Prototype fork isolation, rename, switching, serialization, leaf deletion, parent protection and main protection.
- Registry graph materialization and node/path selection indexes.
- Legacy Animator serialization, inspection and deterministic CSS compilation.
- Presence reconnect with stable actor/avatar metadata and node-aware lightweight beats.

## Performance

- Presence pointer updates remain throttled and never resend image data.
- Replay folds only the visible event prefix and uses the active checkpoint as its base.
- Graph rows and indexes are memoized from project/registry changes rather than recomputed on pointer movement.
- Project saves are debounced; branch switching folds once and applies through the existing DOM painter.

## Architectural decisions and discoveries

- One Connected Canvas entry point keeps five related systems off the main toolbar and forces them to share the project substrate.
- Replay is a non-destructive DOM preview; leaving Replay restores the live branch store.
- Branch switches reset the local compatibility op log to a baseline of the selected branch, while canonical branch history remains in the project document.
- The current checkpoint model reliably replays from the active checkpoint forward. Complete replay before that checkpoint needs checkpoint ancestry/base-state chaining in a later schema revision.
- Ambiguous fingerprint candidates are now refused and observable rather than silently choosing the highest near-tie.
- Framework rerenders can still strip attributes; recovery telemetry will show whether React/framework identity integration is justified.

## Known limitations

- Branch merge is deliberately absent; prototypes are fork/switch/isolate only.
- Replay semantics are strongest for EditorStore operations. Raw host DOM changes outside Froam history cannot be reconstructed.
- Structural injected operations remain replayable only to the fidelity represented by their existing operation payload.
- Animator keyframes are stored in the interaction event and injected for the current session; generated output still follows the legacy path pipeline.
- Graph completeness is limited to objects already materialized by registry and project adapters. It is not Froam Space.
- Hosted multi-device project-document persistence is not yet implemented; Rooms still synchronize the proven operation layer.

## What v6.3 unlocks for v7

- Observable identity health for DNA and Archive capture.
- A usable time axis for Archaeology and richer replay semantics.
- Safe prototype isolation for future MUTATE experiments.
- A visible graph surface for validating Product Flow intelligence before spatial interfaces.
- A shared interaction record ready for Interaction Library and runtime trigger adapters.

## Remaining work

- Chain checkpoint ancestry if complete pre-checkpoint replay becomes a v7 requirement.
- Add hosted project-document synchronization and branch-aware room persistence.
- Expand graph materialization from Site Planner, component instances and interactions during normal editor use.
- Add runtime trigger adapters for click, scroll and drag interactions.
- Keep all research systems behind explicit experimental boundaries until their prerequisites are reliable.
