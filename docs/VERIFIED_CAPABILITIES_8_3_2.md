# Froam verified capabilities — 8.3.2

Audit date: 2026-09-23
Audited package: `@ahmadastic/froam@8.3.2`, installed clean from the registry
Previous audit: `VERIFIED_CAPABILITIES.md` (8.2.0, 2026-09-07)

Same rules as the 8.2.0 audit. A feature that exists in source is not presented
as a working outcome unless it was exercised through the installed CLI and a
browser. Every status below was produced in this audit, not carried forward.

## Headline finding

**The published 8.3.2 cannot ship a visual edit to a live page.**

`froam.runtime.js` — the file every production page loads — is not valid
JavaScript. The browser refuses to execute it, so `data-froam-route` is never
set on `<html>`, every generated CSS rule is scoped on that attribute and
therefore never matches, and no content change is applied.

Save to Repo still reports success and still writes all four files. The failure
is entirely silent: the editor looks correct, the save looks correct, and the
shipped site renders exactly as it did before Froam touched it.

This is a regression against 8.2.0, where the same path was verified working.

### Cause

`generateRuntimeJs` emits its body from a template literal, and inside one
`\\` collapses to `\`:

| | |
| --- | --- |
| source (`lib/codegen.mjs`) | `entry.nodeId.replace(/["\\]/g, '\\$&')` |
| emitted to `froam.runtime.js` | `entry.nodeId.replace(/["\]/g, '\$&')` |

`/["\]/` is a character class whose closing bracket is escaped. The regex
literal never terminates, swallows the rest of the file, and the whole thing is
a syntax error. Two occurrences.

Fixed in this working tree by doubling the escapes so they survive the template
layer. **Not yet published** — 8.3.2 on the registry is still affected.

### Why no test caught it

The full suite passed before and after. Codegen had no assertion that its output
was executable; every existing check looked for substrings inside a string.
`scripts/test-codegen.mjs` now parses what is generated — including with ids
carrying quotes, backslashes and brackets — and reintroducing the fault fails
three of its tests.

## Package and command facts

Registry and a clean install checked 2026-09-23.

| Fact | Verified result |
| --- | --- |
| Public package | `@ahmadastic/froam` |
| Registry version / `latest` | `8.3.2` |
| License field | `FSL-1.1-MIT` |
| Node requirement | `>=18` |
| Executable | `froam` → `bin/froam.mjs` |
| Clean install | 10 packages, 11 audited, **0 vulnerabilities** |
| Unpacked size | 5,603 KB |
| Runtime dependencies | `lucide-react`, `framer-motion`, `html-to-image` |
| Installed CLI identity | `froam v8.3.2` |

### Exports

| Specifier | Verified |
| --- | --- |
| `@ahmadastic/froam` | imports; **252 exports**; `FroamGate`, `FroamRuntime`, `scanDomTree`, `emptyDesignSystem`, `assembleFroamIntelligenceRequest` all present |
| `@ahmadastic/froam/vite` | imports; 1 default export |
| `@ahmadastic/froam/server` | imports; 11 exports |
| `@ahmadastic/froam/css`, `/gate-css` | present in package |

### CLI

`init`, `dev`, `build`, `status`, `doctor`, `migrate`, `version` all accepted.
`dev` exposes `--app`, `--serve`, `--port`, `--open`, `--host`, `--dir`.

**Fixed since 8.2.0:** the 8.2.0 audit recorded that init printed legacy
unscoped `froam` guidance. 8.3.2 prints the correct scoped
`npx @ahmadastic/froam dev --serve .`.

## Tested end to end

Fixture: `scripts/fixtures/agency-site`, copied to a disposable directory.
Driven through the installed 8.3.2 binary and Chrome.

| Capability | Evidence |
| --- | --- |
| Static HTML initialization | Created `froam/` (design.json, generated.css, runtime.js), `froam.config.json`, tags in `index.html`, and `index.html.bak` |
| Static editor injection | Bridge served on 6190; editor mounted into `#froam-editor-portal` |
| Editor shell | Toolbar, tool palette (select/move/rectangle/frame/text/hand), Design · Pages · Library · Layers · Reference · Animate, Quick Edit, viewport switcher, zoom, undo/redo all rendered |
| Element selection | Clicking the `h1` bound it to the Design panel; font family, size and weight fields populated from computed style (88px / 700) |
| Typography revision | Changed to 64px / 600; applied live in the editor |
| Save to Repo | Reported "Saved to repo — commit & push to ship it"; wrote design.json (588 B), generated.css (493 B), runtime.js (9,238 B), project.json (215 KB) |
| Generated CSS correctness | Route- and viewport-scoped rule emitted with `font-size: 64px !important; font-weight: 600 !important` |
| Source files untouched | `index.html` still contained the original heading markup; `site.css` unmodified |
| **Production reload — FAILED** | Plain static server, no editor: heading rendered at **88px / 700**, `data-froam-route` absent, console error `Invalid regular expression: missing /` |
| **Production reload — after fix** | Same page: **64px / 600**, `data-froam-route="/"`, **no console errors**, no editor present |

## Tested in code

`npm test` passes on the working tree, now including `test-codegen.mjs`. Covers
operation-log ordering and per-actor undo/redo, branches, checkpoints, replay,
schema migration, design-system states, brand fonts, interactions, animation
keyframes, physics, 105 Look Studio recipes, 100+ motion presets, project-sync,
rooms, presence, comments, approvals, GitHub committer construction, editor
shell routing, reference analysis, scan/DNA, archive and component families.

These validate contracts. As the 8.2.0 audit said and this audit demonstrates,
contract tests do not prove the output runs.

## Implemented, not verified here

React/Vite in a representative app · physical iOS/Android editing over `--host`
· rooms through two real browsers on a deployed service · authenticated hosted
publish/sync · real GitHub repository commit and rollback · reference tooling
visual acceptance · remote interpretation (disabled by default) · saved motion
after a production reload.

## Unsupported

Rewriting original components, templates, route source, application logic or
existing stylesheets · modifying a third-party site because its URL was proxied
· claiming framework support from one HTML response · recovering source,
component boundaries, assets, breakpoints or interactions from a screenshot · a
secure public multi-tenant editor service in the local CLI · guaranteed undo
after Save to Repo plus a full reload · guaranteed selector stability after
structural DOM changes.

## Reproduction

```bash
# 1. clean install the published package in a helper directory
npm install @ahmadastic/froam@8.3.2 --ignore-scripts

# 2. from a disposable copy of scripts/fixtures/agency-site
<helper>/node_modules/.bin/froam init
<helper>/node_modules/.bin/froam dev --serve . --port 6190

# 3. open localhost:6190, click the launcher, select the h1,
#    set 64px / 600, then Save to Repo

# 4. serve the same folder with any plain static server on another
#    port, with no editor injection, and reload
```

Before the fix, step 4 renders 88px / 700 and logs
`Invalid regular expression: missing /`. After it, 64px / 600 and a clean
console.

## Recommended before any promotion

1. **Publish the codegen fix.** Anyone installing 8.3.2 today and shipping gets
   a site with none of their edits applied, and no error to tell them why.
2. **Fix the missing-`@` hang.** `npx ahmadastic/froam` hangs rather than
   erroring — already recorded in the alpha docs, and unmanageable at scale.
3. Re-run this audit against the published fix before citing any of it.
