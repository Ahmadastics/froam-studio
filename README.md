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

Froam does **not** rewrite React components, templates, application logic, or
source stylesheets. The one exception is deliberate and narrow: copy you change
(and, in Tailwind projects, an element's class list) is written back into the
source only where it appears exactly once; everything else stays a Froam edit.

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

## Publishing without a developer

Invite teammates who aren't developers to change the site themselves, with
you approving what goes live:

1. In the editor, open **Share** in the toolbar and copy the **Can suggest
   changes** link. Send it to them — no account, no install. (On a site running
   on your computer, turn on **Make it reachable from anywhere** first — see below.)
2. They open it, say their name, and edit anything on the page. Nothing they
   do is live. When they're done they press **Submit** and add a note.
3. You get the request in **Share → Requests**: who, why, and exactly what
   changed. **Preview** shows it on the page; **Approve & publish** makes it
   live; **Request changes** sends it back with your note.

Approving under `froam dev` does what Save to Repo does: copy is written into
your source files where it can be placed (and, in Tailwind projects, styles
into the element's class list), the rest into the Froam design files — ready
to commit. Anything approved can be taken back with **Revert**; whatever
someone changed again since is left alone.

A request can span pages and screen sizes. Previewing it runs checks on the
page — contrast, text running off the screen, broken images, missing alt
text, links that go nowhere — before you approve.

### Sharing a site that's on your computer

A link to `localhost` only opens on your machine. Under `froam dev`, Share
offers **Make it reachable from anywhere** (or start with `froam dev --share`):
Froam connects out to its share service and your invite links switch to a
public address that opens your local site, with the editor and the room, on
any computer — while `froam dev` runs (Node 22 or newer). Only people you
invite can open it: without a live invite the address shows nothing, not even
the page. Links can stop working after 24 hours or 7 days, and **New links**
shuts out everyone who came in on the old ones. People on the link can look,
talk and suggest changes; nothing they send can write your files. Set
`FROAM_SHARE_URL` to use your own deployment of `templates/cloudflare-share`.

When you're done, **End collaboration** in Share stops every link.

### Smart Quick Edits

Some Quick Edits read the page before they change anything. They run on your
computer with no AI, and the preview says what each one worked out:

| Say | What it works out |
| --- | --- |
| **Fix the contrast** | The colour actually behind the text, including every colour of a gradient, then the nearest shade of the same hue that passes WCAG AA. It says the ratio before and after. Over a photo it adds a soft shadow behind the letters instead. |
| **Make the size fluid** | A `clamp()` that is exactly the phone size at 375px and the current size at 1440px, with no breakpoints. It still follows the reader's text-size setting. |
| **Make it frosted glass** | Glass tuned to what's behind it, light or dark, using the site's own corner radius. |
| **Add a gradient in the brand colour** | The site's brand colour, read from its buttons, links and logo, flowing into a neighbouring hue. On text it's clipped to the letters and deepened until it reads. |
| **Make it glow in the brand colour** | A glow in that colour: a text glow on words, a halo on boxes. |
| **Balance the lines** | `text-wrap: balance` for headings and `pretty` for paragraphs, so no word is left alone on a line. |
| **Match the others like it** | The styles its look-alikes on the page share (corners, padding, weight, …) wherever this one differs. |
| **Use the brand colour** | Text in the brand colour, darkened just enough to pass. A button filled with it, with readable text. |

Selecting something offers the ones that suit it. **Try again** gives a
different take, such as another hue pairing, a softer glow or heavier frost.
When there's nothing to fix, it says so ("Already easy to read: 12.6:1").

With nothing selected, Quick Edit (and the command palette) offers three
**page-wide fixes**:

| Say | What it does |
| --- | --- |
| **Fix contrast everywhere** | Checks every text against what is really behind it, including each colour of a gradient, and moves each one that fails WCAG AA to the nearest passing shade of its hue. Text over photos is left alone, because it can't be measured. |
| **Make the buttons consistent** | Gives buttons that stray the corners, font, weight, tracking and case most of the page's buttons share. Sizes are left alone. |
| **Tidy the spacing** | When most of the page's spacing sits on a 4px or 8px grid, rounds the few values that are off it onto it. A page with no scale is left as designed. |

Each one applies everything it found as a single step. A report lists every
element it changed (for example "Paragraph 'Extraordinary…': 1.5:1 → 4.6:1"),
and **Undo all**, or one Ctrl+Z, takes the whole fix back.

### AI in Quick Edit

Quick Edit handles direct edits ("make it bolder", "add more space") on your
computer, with nothing uploaded. For anything else, give `froam dev` an AI and
turn on **AI** in Quick Edit:

```sh
ANTHROPIC_API_KEY=… froam dev            # Claude (claude-sonnet-5 unless FROAM_AI_MODEL says otherwise)
FROAM_AI_API_KEY=… FROAM_AI_MODEL=… FROAM_AI_BASE_URL=… froam dev   # any OpenAI-compatible API
```

Claude is called through Anthropic's own Messages API. It has to answer with
Froam's plan format, so its replies can't come back as loose prose. If both kinds of
key are set, `FROAM_AI_*` wins; `FROAM_AI_PROVIDER=anthropic` sends
`FROAM_AI_API_KEY` to Claude instead.

Before opening the editor, `froam ai-check` sends one sample request to the AI
`froam dev` would use and says in plain words what happened: it worked (and
how long it took), the key was refused, the API returned an error (often a
wrong model name), it couldn't be reached, or no AI is set. It never prints
the key.

The key stays with `froam dev`; the browser never sees it, and people on a
share link can't use it. Froam asks before the first request, sends a
description of the part you picked (layout, styles, words — never source code,
cookies or screenshots), and shows a preview you keep or discard.

### Hosted: pull requests, notifications, realtime

On a hosted site, approval opens a pull request and the owner hears about
requests wherever they are:

```js
import { createFroamNotifier, createFroamRoomApi, createGitHubPublisher } from '@ahmadastic/froam/server'

const rooms = createFroamRoomApi({
  storage,                                   // your database adapter
  // Approve → one commit (design + copy + Tailwind classes) as a pull request.
  // Revert → closes it, or opens a revert pull request once merged.
  ...createGitHubPublisher({ token: process.env.GITHUB_TOKEN, repo: 'you/site', dir: 'froam', siteUrl: 'https://your-site.com' }),
  // Slack (with a Review button), Discord, any webhook, or email via Resend.
  notify: createFroamNotifier({ siteUrl: 'https://your-site.com', webhooks: [process.env.SLACK_WEBHOOK_URL] }),
})
```

Links in notifications and pull requests open the editor on that request and
never carry a token. Under `froam dev`, set `FROAM_NOTIFY_WEBHOOK` (and
`FROAM_SITE_URL`) or `"notify"` in froam.config.json.

Serverless hosts can't hold connections open, so rooms there would poll. For
instant updates and live cursors, run the room server on Cloudflare
(`templates/cloudflare-rooms` — rooms, storage and realtime in one Worker, free
tier), or keep your own room server and add the relay in
`templates/cloudflare-realtime`.

The other links: **Can edit together** (live co-editing, for designers and
developers), **Can comment** (clients: notes and approvals), **Can view**.
In Chat, type @ to mention someone, and pin a message to the selected element.

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
| Text replacement | Written into your source file when the original words appear there exactly once (HTML, JSX/TSX, Vue, Svelte, Astro, translation JSON); otherwise data in `froam.design.json`, applied by `froam.runtime.js` |
| Image replacement | Data in `froam.design.json`, applied in production by `froam.runtime.js` |
| Inserted block (Library pattern) | Serialized block, styled with the site's own theme variables, applied by `froam.runtime.js` |
| `::before` / `::after` | A pseudo-element rule in `froam.generated.css` |
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
| `froam init` on Vite | Installs `@ahmadastic/froam` with the project's package manager (`--no-install` to skip), then edits `vite.config.*`, with a `.bak` file. If the install fails, the config is left alone |
| `froam init` on Vite (non-React), Astro, Next.js, SvelteKit, Remix | Adds the two tags to the page head it finds (`index.html`, the Astro layouts, `app/layout`, `src/app.html`, `app/root`), with a `.bak`, and sets `"shipDir"` in `froam.config.json` (see below) |
| Visual editing and Save to Repo | Writes Froam-owned design/output files, and writes copy edits into the source file that holds the original words (only when they appear exactly once as a whole string; never in comments, `node_modules`, builds or dotfolders). Turn off with `--no-write-source` or `"writeSource": false` in `froam.config.json` |

Review every `init` diff before committing it.

### Shipping from a public folder

A site that isn't built from the Froam workspace serves the two production
files from its static folder. `"shipDir": "public/froam"` in
`froam.config.json` tells every save (the CLI, the bridge, the Vite plugin, and
`createGitHubCommitter({ shipDir })`) to copy `froam.generated.css` and
`froam.runtime.js` there, so the copies never go stale. Commit both folders.
Only those two files are copied: the workspace also holds the design source,
room chat and project notes, and those stay private.

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

`froam init` installs the package. To do it yourself (a dependency, because
`FroamRuntime` ships in your bundle):

```bash
npm install @ahmadastic/froam
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

In a JavaScript project, drop `type FroamLocalDesign` and the `as` cast;
`froam init` prints the version for your project.

`enabled` and localhost open the editor in development only. A production
build shows it to owners signed in through `authProvider` + `ownerEmails`, and
to nobody else. A page whose visitors should get the editor, such as a public
demo, adds `showInProduction`.

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

- Phone and tablet previews answer CSS media queries, viewport units and
  `matchMedia()` for the device, on the page itself. Scrolling inside the
  device reaches the page's scripts: `scroll` listeners fire and
  `window.scrollY` and `scrollTo()` follow the device screen, so sticky headers
  and scroll effects behave. A script that reads
  `window.innerWidth` directly still sees the real window, and a script that
  listened to a media query before the preview opened hears about the change
  on its next resize.

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
- Generated CSS is an override layer, not a source-level refactor. Source
  write-back covers copy (text) today; styles stay in `froam.generated.css`.
- Content inside shadow roots (web components) and inside iframes is not
  editable yet. Portals mounted on `<body>` beside `#root` are.
- Undo and History survive a reload, including after Save to Repo; this is
  verified for style edits. For copy that Save to Repo has already written
  into your source files, version control and `index.html.bak` remain the
  reliable recovery path.
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
    --allow-origin <o>    let a custom dev domain (e.g. http://app.test) use the bridge
    --share               a link that opens this local site on any computer
    --no-write-source     keep copy edits as Froam edits instead of writing them to source
froam build               rebuild CSS/runtime from the design file
froam status              summarize the design and generated files
froam check               report edits that no longer match the page
    --app <url>           check against a running app
    --serve [dir]         check against a built or static folder
    --fix                 re-anchor the edits that only moved
froam doctor              check setup health
froam ai-check            send one test request to the AI froam dev would use
froam migrate             migrate the design format to v3
froam version             print the installed package version
```

All commands accept `--dir <path>` for a custom Froam directory. Node 18 or
newer is required.

The bridge only answers to this machine: CORS is granted to local origins
(and `--allow-origin`), writes from any other website are refused, the `Host`
header must be local (DNS rebinding), and `--serve` never serves dotfiles.

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
