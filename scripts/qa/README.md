# scripts/qa — test Froam the way users get it

`npm test` and `test-e2e-editor.mjs` prove the **source** works. These prove the
**package** works: each one installs Froam from a tarball or the registry into a
clean folder, drives the real CLI, and opens a real browser. Then it looks at the
page a visitor gets, with no editor and no bridge.

8.3.2 is why this exists. Every test passed, Save to Repo said "saved", and
production showed none of the edits because `froam.runtime.js` was not valid
JavaScript.

| Harness | Question it answers | Time |
| --- | --- | --- |
| `ship-gate.mjs` | Does this build ship an edit to production? Run it before every `npm publish`. | ~20 s |
| `stack-matrix.mjs` | Which stacks work end to end, from init to production? | ~6 min cold, ~3 min cached |
| `ux-review.mjs` | What does a stranger meet in the first five minutes, and are the Looks good? | ~2 min first run, ~10 min all Looks |

```bash
node scripts/qa/ship-gate.mjs                                   # npm pack this repo, gate the tarball
node scripts/qa/ship-gate.mjs --pkg @ahmadastic/froam@latest    # gate what's on npm right now
node scripts/qa/stack-matrix.mjs --only vite-react,next         # some stacks
node scripts/qa/ux-review.mjs --only first-run
node scripts/qa/ux-review.mjs --only looks --targets cta --groups Alive,Depth
```

Each one writes `report.md`, `report.json` and screenshots to a folder it prints,
under your OS temp folder unless you pass `--out`. Exit code 0 means pass. They
need `playwright-core` (already a devDependency) and Chrome or Chromium; set
`FROAM_QA_CHROME` to choose one.

To make the gate block a bad publish, add it to the end of `check:release`.
`prepublishOnly` already runs that script:

```json
"check:release": "npm run build && npm test && npm run test:e2e && node scripts/qa/ship-gate.mjs --no-build"
```

Without `--pkg`, the gate runs `npm run build` and then `npm pack`, so it tests
exactly what publish would upload. Pass `--no-build` when the build has just
run.

## What each check means

**ship-gate.** Every `exports`/`bin` target exists, the entry points import,
`init` wires a static site, and the editor opens. It types copy, nudges a
button, applies a Look, and saves. `froam.runtime.js` must parse. Production
(a plain static server) must show all three edits with no editor, no console
errors and a quiet DOM. Then `froam check` and `froam build` run, followed by a
second production pass.

**stack-matrix.** The same site is built in Static, Vite, Vite + React, Vite +
Vue, Vite + Svelte, Astro and Next.js. For each one the harness runs `init`,
the app's dev server, `froam dev --app`, opens the editor, selects, types, nudges
and saves. It checks whether the copy reached the source file and whether the
editor survives the dev server reloading. Then it does what "Ship it
(production)" says, builds, and checks production. Installs are cached
(`--cache`). Each project gets a fresh copy of its files every run.

**ux-review first-run.** The README's `npx @ahmadastic/froam` path, answered
like a stranger would answer it, with clicks and seconds counted against the
targets in `docs/COMPETITIVE_POSITIONING.md`. It clicks every toolbar button
once to find dead ones and errors, and lists any jargon or other product names
a new user would read.

**ux-review looks.** It previews every Look on a button, a card, a heading and
a photo, then flags any Look that:
- makes the element invisible
- breaks WCAG text contrast
- shoves neighbouring elements
- clips text
- is an "Alive" Look that doesn't react on hover
- keeps animating under `prefers-reduced-motion`

It also writes one contact sheet per target and group for a person (or Claude)
to judge taste.
