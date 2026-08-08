# Froam Platform Implementation Ledger

Last updated: 2026-08-08

## Status

| Category | Systems |
| --- | --- |
| Completed | Stable node reference and persisted editor registry; duplicate prevention; versioned project envelope; legacy design migration; deterministic project events; checkpoints; isolated branch primitives; graph adapters; node-aware presence contract; project sidecar bridge endpoints |
| Partial | Durable project history; branches; project graph materialization; interaction runtime; Scan-to-DNA integration |
| Experimental | Deterministic simulation scenario runner for Chaos Testing adapters |
| Architecture only | Component Archive, Product Flow intelligence, Interaction Library, Design Physics, UI Sound, MUTATE, Froam Space |
| Research only | UI Sampling, Screenshot-to-UI, predictive Attention, UI Gravity, Synthetic UX agents, Reality Mode, Make it Froam |

## Migrations

- Legacy `froam.design.json` can be wrapped in project schema v1 without alteration.
- Runtime and code generation still consume the exact unwrapped v3 design.
- Stable IDs coexist with legacy path and fingerprint locators; output selectors remain path-based.

## Tests

- DOM reorder identity, fingerprint recovery, native/injected identity and duplicate IDs.
- Envelope round-trip, old design migration and unchanged path behavior.
- Replay ordering, late events, checkpoints, branch isolation and graph adapters.
- Scan/DNA grouping, interaction compilation, simulation ordering and disabled experimental flags.
- Avatar and node-aware presence transport.

## Known limitations

- Native identity is durable through the project registry, not yet written into source.
- Raw injected HTML remains opaque below its injected root.
- The bridge can persist project sidecars; automatic editor syncing and hosted persistence remain.
- Branches do not yet have merge semantics or UI.
- Existing editor state remains path-keyed and localStorage-backed.

## Decisions

- Preserve live-DOM editing, Blueprint and path-based generated output.
- Reuse `data-froam-id`, anchors and Lamport ordering.
- Treat existing snapshots as compatibility views and checkpoints.
- Keep research features disabled with explicit maturity labels.
- Feed future systems from shared graph, scan, interaction and simulation contracts.

## Remaining work

- Connect editor history automatically to the bridge sidecar and add hosted persistence.
- Integrate stable IDs with selection, comments, locks and operations.
- Publish Scan and Intel observations into the DNA boundary.
- Move Animator onto the interaction model and add trigger adapters.
- Integrate branch/version UI and define eventual merge semantics.
- Build Archive and Flow on the graph before attempting MUTATE or Space.
