# Froam Studio

[![License: FSL-1.1-MIT](https://img.shields.io/badge/license-FSL--1.1--MIT-14b8a0.svg)](https://cdn.jsdelivr.net/npm/@ahmadastic/froam/LICENSE)
[![Node >= 18](https://img.shields.io/badge/node-%3E%3D18-5eead4.svg)](https://www.npmjs.com/package/@ahmadastic/froam)

<p align="center">
  <img src="https://cdn.jsdelivr.net/npm/@ahmadastic/froam/docs/froam-mark.svg" alt="Froam" width="460">
</p>

<p align="center"><a href="https://froam.vercel.app"><b>Try it live in your browser → froam.vercel.app</b></a></p>

**A visual editor for the site you already have.** Froam overlays controls on a
rendered page. Supported revisions can be saved as a versioned Froam design,
generated override CSS, and a small runtime for content changes.

Froam does **not** rewrite original React components, templates, application
logic, or source stylesheets.

## Try it

One command, from any folder:

```bash
npx @ahmadastic/froam
```

```text
◆ Froam
  Paste the website you want to edit.

  Already running on this computer:
    1  localhost:3000  My Portfolio
    2  localhost:5173  Vite + React

  Website URL, or a number:
```

Froam finds the dev servers already running on your machine and names them by
their page title, so editing your own project is a keystroke. Paste any address
instead to edit a live site:

```text
  Website URL, or a number: example.com
```

Froam picks a free port, starts a local bridge, injects the editor, and opens
your browser. It does not modify the proxied server or the remote website.

If you already know what you want, skip the prompt:

```bash
npx @ahmadastic/froam example.com          # a live site
npx @ahmadastic/froam localhost:3000       # your dev server
npx @ahmadastic/froam ./public             # a static HTML folder
```

### Where your edits are saved

Editing your own project writes a `froam/` workspace into that project, next to
the code it belongs to.

You do not have to tell Froam where the project is. It traces the port back to
the process serving it, and that process back to the folder it was started from,
then shows you the folder before creating anything:

```text
  Froam will save your edits here:
    C:\Users\Ada\Desktop\my portfolio\froam
  Enter to create it · n to keep them in your Froam folder · or paste another folder
  [Y/n]
```

If a server cannot be traced — a container, or a language whose launcher hides
the path — Froam asks rather than guessing.

Editing a live site you do not have the source for writes to `~/Froam/<site>/`
instead, so Froam never drops files into whatever directory your terminal
happened to open — including a read-only one such as `C:\Windows\System32`.

### Other devices on your network

```bash
npx @ahmadastic/froam example.com --host
```

Keep the terminal running. `--host` exposes the development bridge to your local
network for phone testing; do not expose it directly to the public internet.

## Verified static workflow

From a static site's root:

```bash
npx @ahmadastic/froam init
npx @ahmadastic/froam dev --serve . --port 4600
```

`froam init`:

- creates `froam.config.json`;
- creates `froam/froam.design.json`, `froam/froam.generated.css`, and
  `froam/froam.runtime.js`;
- adds the generated stylesheet and runtime tags to `index.html`; and
- writes the original page to `index.html.bak` before changing it.

Open the printed local URL, make revisions, and choose **Save to Repo**
(`Ctrl+Shift+S`). Serve the initialized folder normally and reload it without
the editor to verify the result.

## What happens to an edit

| Edit stage or type | Result |
| --- | --- |
| Unsaved editor preview | Browser DOM and local browser state only; it is not a source-code rewrite |
| Color, typography, spacing, border, radius, shadow, layout, or supported state style | A rule in `froam.generated.css`, scoped by route and viewport |
| Text replacement | Data in `froam.design.json`, applied in production by `froam.runtime.js` |
| Image replacement | Data in `froam.design.json`, applied in production by `froam.runtime.js` |
| Inserted block | Serialized block data applied by `froam.runtime.js` |
| Save to Repo | Updates the design, generated CSS, and runtime; the editor may also save `froam.project.json` |

Generated CSS is an override layer and uses `!important`. The runtime is
dependency-free and embeds the content changes; it does not call a runtime API.
`froam.project.json` contains editor project state, can be much larger than the
production artifacts, and is not required by a plain static production page.

## What modifies source files

| Command | Source effect |
| --- | --- |
| `froam dev` or shorthand `froam <url-or-dir>` | Creates the Froam workspace; does not rewrite the host application's existing components or stylesheets |
| `froam init` on static HTML | Changes `index.html` only to add the generated CSS/runtime tags and creates `index.html.bak` |
| `froam init` on Vite | Creates Froam files and may edit `vite.config.*`, with a `.bak` file |
| Visual editing and Save to Repo | Writes Froam-owned design/output files; does not translate edits back into original component source |

Review every `init` diff before committing it.

## Checking that a design still fits the page

A Froam edit is keyed by a DOM path. When someone wraps a section in a
container or inserts a sibling above it, that path can stop meaning what it
meant — and it fails quietly in both directions. Either the edit disappears, or
the path still resolves and the edit lands on whatever moved into that slot.

`froam check` answers that before a merge instead of after a deploy:

```bash
froam check --app http://localhost:3000    # against a running app
froam check --serve dist                   # against a build
```

```text
◆ froam check · static → dist/

  ✖ /  12 anchored · 1 moved · 1 orphaned
      h2 "Pricing" · desktop
        was  main:1/section:2/h2:1
        now  main:1/section:3/h2:1  81% match
      p "Send anything, anywhere" · desktop
        main:1/section:1/p:1  not on the page any more
```

Each edit resolves to one of five states: `anchored` (found where it was made),
`moved` (found elsewhere — `froam check --fix` re-keys it), `orphaned` (gone),
`unverified` (saved before fingerprints existed, so there is nothing to check it
against), and
`missing` (an unverified edit whose path no longer resolves).

The command exits non-zero on drift and on a run where no route could be
loaded, so it works as a CI gate. A route it could not fetch is reported as
unchecked rather than counted as healthy.

## Proxy scope is not framework support

The proxy can inject Froam into many conventional HTML responses. That proves
the page can be previewed; it does not prove that every route, asset, dev-server
protocol, framework lifecycle, CSP, or production build is compatible.

Current evidence:

| Workflow | Status |
| --- | --- |
| Static HTML `init -> edit -> Save to Repo -> plain-server reload -> recovery` | Verified end to end |
| Local HTTP proxy injection and cache handling | Covered by automated integration tests |
| React/Vite package imports | Package exports load; full application workflow not verified in this audit |
| External HTTPS sites | Editor injects into the proxied page; this is a local mock-up, not a deploy path, and is not verified as general framework support |
| Mobile browser editing | UI and `--host` path are implemented; physical-device workflow not verified in this audit |

## React and Vite integration

Install the package when importing its APIs:

```bash
npm install --save-dev @ahmadastic/froam
```

Use the default Vite plugin export:

```ts
import froamStudio from '@ahmadastic/froam/vite'

export default {
  plugins: [froamStudio({ dir: 'src/froam' })],
}
```

Mount the runtime and gate once near the React root:

```tsx
import { FroamGate, FroamRuntime, type FroamLocalDesign } from '@ahmadastic/froam'
import '@ahmadastic/froam/css'
import '@ahmadastic/froam/gate-css'
import froamDesign from './froam'

<FroamRuntime design={froamDesign as FroamLocalDesign} routes="*" />
<FroamGate enabled initialOpen={false} localRoutes="*" />
```

`froam init` has emitted legacy unscoped import examples in past releases.
Verify generated Vite imports against the scoped examples above.

## Package exports

| Export | Purpose | Verification |
| --- | --- | --- |
| `@ahmadastic/froam` | React gate, runtime, and project APIs | Imports successfully |
| `@ahmadastic/froam/css` | Editor stylesheet | Export target exists |
| `@ahmadastic/froam/gate-css` | Gate stylesheet | Export target exists |
| `@ahmadastic/froam/vite` | Default Vite development plugin | Default export imports successfully |
| `@ahmadastic/froam/server` | Publish/room/server helpers | Imports successfully; production hosting not verified here |

## Implemented editor surface

The current source includes selection, inline text editing, typography and
spacing controls, responsive viewport stores, state styling, Look Studio,
Motion Studio, layers, page planning, reference analysis, versions, local Quick
Edit, publishing primitives, rooms, and project intelligence surfaces.

Implementation or unit coverage is not the same as a completed customer
workflow. The exact classification (implemented, tested, unverified, and
unsupported) is maintained in
[docs/VERIFIED_CAPABILITIES.md](https://cdn.jsdelivr.net/npm/@ahmadastic/froam/docs/VERIFIED_CAPABILITIES.md).

Remote model interpretation is disabled in the shipping editor by default.
Local deterministic Quick Edit does not require remote AI.

## Known limitations

- Generated selectors are structural paths such as
  `section:nth-of-type(1) > h1:nth-of-type(1)`. Inserting, deleting, or
  reordering same-tag siblings retargets an edit. Edits saved since fingerprints
  were introduced carry one, so `froam check` reports this and the runtime
  declines to restyle an element it cannot recognise; edits saved by earlier
  versions have nothing to check against and are reported as `unverified` until
  the route is re-saved.
- `froam check` parses HTML structurally rather than with a browser engine.
  Well-formed markup indexes identically to a browser — including implied end
  tags, synthesized `<tbody>`, raw-text elements and character references — but
  table foster-parenting and other HTML5 recovery rules are not implemented.
- Previewing a production URL cannot change or deploy that website. Shipping
  requires a project or integration you control.
- Generated CSS is an override layer, not a source-level refactor.
- Immediate undo works in the active editor session. In this audit, undo was
  unavailable after Save to Repo followed by a full editor reload. Use version
  control and `index.html.bak` as the reliable recovery path.
- The development proxy removes CSP headers from proxied HTML so the editor can
  load. It does not establish compatibility with the site's production CSP.
- A page that cannot load the generated stylesheet/runtime cannot ship Froam
  output.

## CLI

```text
froam                     ask what to edit, then open it
froam <url>               edit a running site or a live URL
froam <dir>               edit a static HTML folder
froam init                scaffold and wire a detected project
froam dev                 start the universal development bridge
    --app <url|port>      proxy a served HTML page
    --serve [dir]         serve a static HTML folder
    --port <n>            bridge port (otherwise the first free port from 4600)
    --open                open the browser
    --host [addr]         expose on a trusted local network
froam build               rebuild CSS/runtime from the design file
froam status              summarize the design and generated files
froam check               report edits that no longer match the page
    --app <url>           check against a running app
    --serve [dir]         check against a built or static folder
    --fix                 re-anchor the edits that only moved
froam doctor              check setup health
froam migrate             migrate the design format to v3
froam version             print the installed package version
```

All commands accept `--dir <path>` for a custom Froam directory. Node 18 or
newer is required.

## License

[FSL-1.1-MIT](https://cdn.jsdelivr.net/npm/@ahmadastic/froam/LICENSE). Froam is source-available, not OSI-approved open source.
Each release converts to MIT two years after the date that version is made
available. Read the license itself for the authoritative terms.

**Using Froam in your own business is free** — your team, your sites, and client
work are all Permitted Purposes under FSL, along with modification, education
and research.

A commercial licence is needed only to ship Froam inside a product you sell (a
builder, CMS, page editor or design tool), or to replace FSL for an organisation
whose policy requires an OSI-approved licence. See
[Commercial licensing](https://cdn.jsdelivr.net/npm/@ahmadastic/froam/docs/COMMERCIAL_LICENSE.md).
