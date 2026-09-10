# Froam verified capabilities

Audit date: 2026-09-07  
Audited package: `@ahmadastic/froam@8.2.0`  
Audited repository: commit `524eaa4` plus the preserved working tree

This document states what Froam can demonstrate reliably today. A feature that
exists in source is not presented as a complete customer workflow unless it was
exercised through the CLI and browser. Loading a page through the development
proxy is not proof that its framework, build, deployment, or production policy
is supported.

## Status definitions

- **Tested end to end:** exercised through the user-facing CLI and browser, then
  checked from the resulting files and a separate non-editor server.
- **Tested in code:** exercised by automated tests, but not as a complete
  browser/customer workflow in this audit.
- **Implemented, unverified:** a UI or API exists, but its operating workflow
  was not verified here.
- **Unsupported:** Froam does not currently provide the stated outcome.

## Package and command facts

The npm registry and a clean install were checked on 2026-09-07.

| Fact | Verified result |
| --- | --- |
| Public package | `@ahmadastic/froam` |
| Registry version/tag | `8.2.0`; `latest` points to `8.2.0` |
| Repository version | `8.2.0` |
| License field and file | `FSL-1.1-MIT` |
| Node requirement | `>=18` |
| Executable | `froam`, mapped to `./bin/froam.mjs` |
| Clean install | 10 packages installed; npm reported 0 vulnerabilities |
| Installed CLI identity | `froam v8.2.0` |

Install the package when importing its APIs:

```bash
npm install --save-dev @ahmadastic/froam@8.2.0
```

Run the public one-shot CLI without adding it to the project manifest:

```bash
npx @ahmadastic/froam@8.2.0 <url-or-static-directory>
```

Omitting `@8.2.0` selects npm's `latest` tag:

```bash
npx @ahmadastic/froam <url-or-static-directory>
```

Run these commands from a writable project/test directory. A command launched
from `C:\Windows\System32` tries to create `C:\Windows\System32\froam` and can
fail with `EPERM`.

### Published exports

All five export targets were present in a clean installed package. The main,
Vite, and server modules imported successfully.

| Specifier | Verified shape |
| --- | --- |
| `@ahmadastic/froam` | ESM API including `FroamGate`, `FroamRuntime`, project, intelligence, room-client, and design-system utilities |
| `@ahmadastic/froam/css` | `dist/froam-studio.css` plus type stub |
| `@ahmadastic/froam/gate-css` | `dist/gate-css.css` plus type stub |
| `@ahmadastic/froam/vite` | One default function export |
| `@ahmadastic/froam/server` | ESM/CJS server surface including publish, room, sync, intelligence, file/memory stores, and GitHub committer factories |

### Published CLI

The clean installed package accepted `froam init`, `dev`, `build`, `status`,
`doctor`, `migrate`, and `version`. The development command exposes `--app`,
`--serve`, `--port`, `--open`, `--host`, and `--dir`. `froam
<url-or-directory>` is shorthand for the matching development mode and creates
a Froam workspace in the current directory.

The published 8.2.0 CLI still prints some legacy unscoped `froam` or
`froam-studio/vite` guidance after initialization. The working tree corrects
those strings to `@ahmadastic/froam` and includes a regression assertion, but
that correction is not public until a future release is published.

## Capability classification

### Tested end to end

| Capability | Evidence and boundary |
| --- | --- |
| Static HTML initialization | The published 8.2.0 binary created the Froam workspace, `froam.config.json`, HTML tags, and `index.html.bak` in the repository fixture. |
| Static editor injection | The published bridge served the fixture on port 6190 and the editor opened in Chromium. |
| Element selection and inline copy editing | An `h1` was selected and its text changed through the `Aa` inline control. |
| Typography revisions | The heading was saved at `64px` and weight `600`. |
| Look Studio | `Launch CTA` produced gradient, foreground, border, shadow, radius, padding, and weight overrides on a link. |
| Spacing revisions | The hero section's linked padding was saved at `48px`. |
| Save to Repo | The editor reported success and wrote design, CSS, runtime, and project-sidecar files. |
| Runtime content output | A separate plain server, with no editor injection, reloaded the revised headline from `froam.runtime.js`. |
| Generated CSS output | The same plain reload computed heading size/weight, CTA radius/weight, and hero padding from `froam.generated.css`. |
| Immediate undo | A temporary heading change from `64px` to `72px` was undone back to `64px` before reloading. |
| Backup recovery | Restoring `index.html.bak` removed the Froam tags and restored the original render; restoring initialized `index.html` reapplied the output. |

### Tested in code

`npm test` passes the complete scripted suite on the audited working tree. It
covers these areas without turning them into separate browser/customer claims:

- project-scoped storage/bridge identities, malformed URL rejection, proxy
  cache isolation, and scoped CLI guidance;
- operation-log ordering, per-actor undo/redo, compaction, persistence
  primitives, project branches, checkpoints, replay, and schema migration;
- generated CSS for design-system states, brand fonts, interactions, animation
  keyframes, physics, and selected project operations;
- 105 Look Studio recipes and at least 100 motion presets across the declared
  motion families;
- hosted project-sync, rooms, presence, comments, approvals, reconnect/order,
  and branch isolation using local test stores and servers;
- GitHub committer request construction and failure handling with mocks;
- editor shell routing, text-layer glyph effects, mobile UI reachability,
  reference validation, and optional intelligence surfaces;
- deterministic/local intent, bounded consented remote transport, reference
  analysis/building, scan/DNA, archive, and component-family primitives.

These tests validate software contracts. They do not prove visual quality on
arbitrary pages, live collaboration infrastructure, physical-device ergonomics,
or third-party service credentials.

### Implemented, not verified end to end in this audit

| Area | What is present | What remains unverified |
| --- | --- | --- |
| React/Vite | React exports and default Vite plugin import | Install, initialize, edit, build, reload, and recover in a representative app |
| External HTTPS proxying | HTTPS proxy path and HTML injection | General compatibility, auth, navigation, CSP behavior, and durable output on real third-party sites |
| Mobile editing | `--host`, mobile shell, touch-oriented controls, and reachability tests | Physical iOS/Android editing, keyboard/touch behavior, and LAN reliability |
| Rooms | Room APIs/client, presence, comments, approvals, and order tests | Two real browsers through a deployed durable room service |
| Hosted publish/sync | Server factories and contract tests | Authenticated deployment, persistence, monitoring, and recovery |
| GitHub commits | `createGitHubCommitter` and mocked tests | Real repository/token/branch workflow and rollback |
| Reference tools | Bounded reconstruction and analysis implementation/tests | Visual acceptance through the full UI on a maintained screenshot corpus |
| Remote interpretation | Provider-neutral transport, consent, and safety tests | Product reliability; it is disabled by default in the shipping editor |
| Motion output | Presets and compilation tests | Saved motion checked after a production browser reload |

### Unsupported or not established

- Rewriting original React/Vue/Svelte components, templates, route source,
  application logic, or existing stylesheets from visual edits.
- Modifying or deploying a third-party website because its URL was proxied.
- Claiming framework support solely because one HTML response loaded.
- Recovering hidden source, component boundaries, original assets, exact
  breakpoints, or interactions from a screenshot.
- A secure public multi-tenant editor/publish service as part of the local CLI.
- Guaranteed undo after Save to Repo and a full editor reload. That exact path
  failed here even though operation-log persistence primitives pass tests.
- Guaranteed selector stability after structural DOM changes.

## What exactly happens to edits

### Before Save to Repo

An edit changes the rendered page and Froam's browser-side state. It is a
preview, not a rewrite of the application's source files.

### On Save to Repo

The bridge writes Froam-owned artifacts:

| File | Role |
| --- | --- |
| `froam/froam.design.json` | Route/viewport/path design data, including supported content changes |
| `froam/froam.generated.css` | Override CSS for supported visual styles, states, fonts, and compiled interactions |
| `froam/froam.runtime.js` | Dependency-free runtime applying embedded text, image, and inserted-block data |
| `froam/froam.project.json` | Editor/project sidecar; not required by the audited static production page |

Visual styles are generated as route- and viewport-scoped CSS and generally use
`!important`. Content changes are not written into source HTML in the
demonstrated workflow; the runtime locates the element and changes the DOM on
load. The generated runtime embeds content and requires no runtime API call.

### Actual source-file modifications

| Action | Existing source-file effect |
| --- | --- |
| Shorthand or `froam dev` | Creates/uses the Froam workspace; does not rewrite original components, templates, or styles. |
| Static `froam init` | Adds generated CSS/runtime tags to `index.html`, after creating `index.html.bak`. |
| Vite `froam init` | May add a plugin import/call to `vite.config.*` and writes a `.bak`; not verified end to end here. |
| Save to Repo | Writes the Froam-owned files above; does not translate edits into original components. |

## Reproducible agency workflow

The fixture is fictional and contains no client data:
`scripts/fixtures/agency-site/`.

### Reproduction

1. Copy the fixture into a disposable writable directory.
2. In a clean helper directory, install the exact public package:

   ```powershell
   npm install @ahmadastic/froam@8.2.0 --ignore-scripts
   ```

3. From the disposable site directory, run the installed binary:

   ```powershell
   <helper>\node_modules\.bin\froam.cmd init
   <helper>\node_modules\.bin\froam.cmd dev --serve . --port 6190
   ```

4. Open `http://localhost:6190/` and make these revisions:

   - headline: `Ship a sharper product without slowing the launch.`;
   - headline typography: `64px`, weight `600`;
   - CTA: apply the `Launch CTA` look;
   - hero section: linked padding `48px`.

5. Choose **Save to Repo**.
6. Serve the initialized directory with an ordinary static server on another
   port, without Froam editor injection, and reload it.
7. Inspect the generated files and computed styles.
8. Test immediate undo before reload. For reliable full recovery, restore
   `index.html.bak` or revert the generated files with version control.

### Observed result

The plain-server reload, with no editor root present, produced:

```text
heading: Ship a sharper product without slowing the launch.
heading font-size: 64px
heading font-weight: 600
CTA border-radius: 999px
CTA font-weight: 800
hero padding: 48px
route: /
```

Source `index.html` still contained the original headline. That is expected:
the runtime applied revised copy after load. Original `site.css` was unchanged.

### File evidence

These hashes identify the completed disposable run; they are not release
checksums.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| initialized `index.html` | 958 | `0C1A47582A726FDBC6D2B31DDBF6DF81E4503B110F8E6B27659D9A5FA70F6A2A` |
| original `index.html.bak` | 842 | `F1B8B2165ED349ED038A80C481BC3E8AA5B8433501EE8E826F58581F4D9C7D8A` |
| `froam.design.json` | 1,932 | `328E40C10DA3C9D6CA48CFB0616AB2FE6B4BEE876A70713C5152159E33D7D211` |
| `froam.generated.css` | 2,043 | `9ECB1530E9D054418DCD2ED3E051AF563B2F188E5269C7003F9CCFE26E1D10FC` |
| `froam.runtime.js` | 6,556 | `D0EDD0E5E5F60D6436E07DF7E49A835810ACC10360D2F065FDA2FCE1CD4C97C4` |
| `froam.project.json` | 866,822 | `76258C1209E0954C543AE521C4969E4568B00BCF6823BC122CC3727719EB26A5` |

Production used initialized HTML, original site assets, generated CSS, and the
runtime. The 866 KB project sidecar was editor state and was not needed by the
plain production render.

### Undo and recovery evidence

- In the active session, changing heading size from `64px` to `72px` enabled
  Undo; Undo restored `64px`.
- After Save to Repo and a full editor reload, Undo was disabled. Persistence
  unit tests pass, but that does not override the observed browser failure.
- Replacing initialized `index.html` with `index.html.bak` removed both Froam
  tags and restored the original headline, `88px` computed heading size, square
  CTA, and original hero padding. Restoring initialized HTML reapplied Froam.
- For agency work, start on a clean branch/commit, inspect every diff, and use
  version control as the primary rollback mechanism.

## README and generated-output audit

### README mismatch

The repository and registry metadata both say `8.2.0`; the README in the
published package says `8.1.1`. The root README had the same stale banner. This
was documentation drift, not evidence npm served the wrong JavaScript package.
The root README now identifies the mismatch and uses scoped commands/exports.

The repository-root `froam-8.2.0.tgz` has the older unscoped package name
`froam`, so it is not proof of the currently published scoped package contents.

### Large `dist/` diff

The generated diff was not blindly reverted or accepted:

- At audit start, 41 tracked paths had content differences. Another 40 modified
  `dist/` status entries hashed identically to `HEAD`; they were stat/index
  noise, not content changes.
- A scratch TypeScript/copy build produced 513 non-standalone `dist/` files
  matching the working tree byte for byte, with no differences or missing files.
- A standalone rebuild reproduced the existing generated files exactly:

  ```text
  froam-editor.js
  9E8A00E4C7A32C276BEAFA3B18E2FBCFFE0ED8645A81E23B4A2520E4803000AD

  froam-editor.css
  A2921E47CACFD11D108B3D287468441C8971AF295A18D23D3BB7F5983D6BAA64
  ```

The content-changing `dist/` files are expected generated output for source
already present in the working tree. Hash-equal status entries are stale
metadata noise. No pre-existing generated work was discarded.

### Final repository verification

| Check | Result |
| --- | --- |
| `npm run build` | Passed; TypeScript, copied assets, standalone JS/CSS, and server CJS regenerated successfully |
| `npm test` after the build | Passed all 15 scripted suites, including the new 5/5 project-isolation/CLI checks |
| `npm pack --dry-run --json --ignore-scripts` | Passed; identified `@ahmadastic/froam@8.2.0`, 538 entries, 1,191,304-byte packed estimate |
| Standalone output hashes | Match the independently classified output hashes above |

The dry run did not create, publish, push, or deploy a package.

## Workflow-blocking fixes made in this audit

Only release guidance needed a code correction for the demonstrated workflow:

- CLI-generated Vite imports now use `@ahmadastic/froam/vite`.
- CLI-generated React imports use the scoped package and CSS exports.
- printed one-shot/dev/reinstall commands use `@ahmadastic/froam`.
- CLI help and `--app` wording no longer imply that loading HTML proves every
  framework or that Froam wires every project.
- a regression test prevents old unscoped command/import strings returning.
- the package description and README describe generated override output rather
  than source-component rewriting.
- unverified Rails, Django, WordPress, and `framework-agnostic` keywords were
  removed from package metadata; verified static and implemented React/Vite
  surfaces remain discoverable.

These changes are in the working tree only. Nothing was pushed, published, or
deployed.

## Remaining blockers before a stronger public claim

1. **Selector durability:** output uses structural selectors such as
   `section:nth-of-type(1) > h1:nth-of-type(1)`. Reordering or adding same-tag
   siblings can silently retarget an edit. Follow every structural source
   change with a Froam verification pass.
2. **Reload undo:** the tested Save-to-Repo/reload workflow did not restore an
   actionable undo stack. Do not promise reload-safe undo yet.
3. **Unreleased CLI wording:** npm 8.2.0 still contains legacy unscoped
   guidance. The corrected working tree needs a later reviewed release; this
   audit did not publish it.
4. **Project sidecar size:** the small fixture produced an 866 KB project file.
   It is not needed in the static production path, but repo/editor storage size
   should be watched on real projects.
5. **Integration proof:** React/Vite, mobile hardware, external HTTPS pages,
   deployed rooms/sync, real GitHub commits, and remote intelligence need their
   own acceptance runs before being sold as reliable workflows.
6. **Visual regression coverage:** current tests are strong at data/protocol
   contracts but do not establish cross-browser visual quality across a
   maintained customer-like corpus.

## Short demo outline for Claude

1. State the boundary: Froam edits a rendered page and ships a generated
   override layer; it does not rewrite source components.
2. Copy `scripts/fixtures/agency-site/` to a disposable directory and show the
   clean original HTML/CSS.
3. Run `npx @ahmadastic/froam@8.2.0 init`, inspect the backup and two injected
   production tags, then run `dev --serve . --port 6190`.
4. Change the headline, set typography, apply `Launch CTA`, and set hero
   padding. Use immediate Undo once, then reapply the intended change.
5. Click Save to Repo and inspect design JSON, generated CSS, runtime, and the
   project sidecar. Show that `site.css` and source headline remain unchanged.
6. Open the same directory on a plain static server and reload. Show revised
   text and computed styles with no Froam editor present.
7. Restore `index.html.bak` to demonstrate recovery, then restore initialized
   HTML. End with the known limits: structural selectors and no verified undo
   after a full reload.
