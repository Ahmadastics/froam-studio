# Froam v8 Editor Shell

Release: `froam-studio@8.0.1` · Project schema: unchanged (`v2`)

## Workspace model

Froam now presents one workspace with three modes around the live product:

| Mode | Promise | Primary surfaces |
| --- | --- | --- |
| Create | Build it | Design, Insert, Layers, Blueprint, Animator, contextual Interactions and Responsive controls |
| Understand | Know it | Scan, DNA, Archive, Origins, Product Flow, Attention, Rhythm, Responsive/Breakpoint Cinema, Screenshot → UI and Blueprint |
| Experiment | Challenge it | Laboratory and independently flagged MUTATE, SAMPLE, Interactions, Physics, Gravity, BREAK, Test User, Sound, Trailer and Reality |

The selected mode and last section in each mode are browser-local shell preferences. They are not project data and do not change project serialization. Create remains the fallback/default.

## Root audit and resulting hierarchy

Before 8.0.1, the root simultaneously mounted the v5 full-frame toolbar/Plan/Layers/Design system and the older floating Studio panel. Viewport, selection, layout/style, layers, command, undo/redo and status actions consequently had competing entry points. Connected Canvas, Intelligence and Labs were functional but felt like separate applications; the legacy panel was the only route to several valuable review, history, notes, tokens, assets, transitions and diagnostic surfaces.

The refresh keeps the working implementations and reorganizes their entry points:

- Primary: existing Toolbar editing tools, the mode switcher, project/prototype anchor, compact presence, Replay, commands and profile.
- Contextual: the mode rail, selection-dependent actions, the existing Design inspector in Create, Intelligence in Understand and Laboratory in Experiment.
- Advanced: the existing floating Studio sections plus Connected Canvas node/graph/interaction inspection. Advanced is explicit and reversible; it was not deleted.
- Shared representations: Blueprint remains one 2D/3D implementation reachable from Create and Understand.
- Removed duplication: no capability was removed, but the legacy Studio panel no longer overlays the modern editor by default.

## Context, status and temporal ownership

The project and active branch are always displayed. Non-main branches receive the prototype/Mutagen marker, and the project anchor opens the existing branch surface. Selection-only tools remain visible but disabled with an explanatory tooltip until a live-DOM node is selected.

The shell reports Editing, Understanding, Experimenting, Scanning, Sampling, Replay, Physics, Screenshot reconstruction, prototype, Chaos or Synthetic UX state as appropriate. Animator, Replay, Sampling, Breakpoint Cinema and Trailer keep their existing data models, but share one temporal ownership pattern. Only the active system receives the bottom temporal dock.

## Commands and keyboard behavior

`Ctrl/Cmd + K` opens the existing command palette, now extended with all enabled workspace tools and every project branch/prototype. Search includes non-generative semantic aliases such as “breakpoint cinema,” “component DNA,” “heatmap,” and “mutation.” Results use dialog/combobox/listbox semantics and retain Arrow Up/Down, Enter and Escape behavior. Mode tabs use Left/Right/Home/End. Escape closes transient intelligence/lab/connected panels, then Advanced, before clearing the canvas selection.

Existing high-frequency shortcuts remain unchanged; no feature-per-shortcut scheme was introduced.

## Feature flags and maturity

Labs remain independently disabled by default. Disabled tools are absent from the Experiment rail and command palette. Enabling a flag updates the shell immediately through the same controlled Labs flag state. Beta, Lab and Research labels are subtle and explicit; Reality remains a research boundary rather than a claimed implementation.

## Mobile and motion

At 768 px and below, the mode switcher and contextual rail become a compact bottom shell. Project, presence and global icon groups yield to the canvas and existing mobile sheets; temporal ownership sits immediately above the shell. Existing full-screen Intelligence/Labs behavior is retained. Reduced-motion preferences disable shell animation and transition effects.

## Performance and compatibility

The shell is metadata-driven and does not scan or copy the project. Heavy Intelligence/Laboratory/Connected implementations retain their open boundaries rather than all becoming visible simultaneously. Presence remains avatar-first. No event, graph, branch, identity, collaboration, operation-log, runtime CSS, path locator, code-generation or project schema contract changed.

Run’Am’s integration continues to mount the same `GlobalChefEditor`; 8.0.1 only changes how its existing capabilities are reached.

## Known limitations before v8.1

- The shared temporal dock standardizes ownership and status, not the underlying timeline models.
- Advanced keeps the legacy floating panel’s existing docking/resize behavior; this release does not build a window manager.
- Command entity search covers workspace semantics and prototypes, but does not yet index arbitrary graph/archive nodes.
- Contextuality is selection- and mode-aware; deeper automatic classification of text, archived components or mutations should wait for deliberate v8.1 hardening.
