# What Froam supports, and what it saves

Froam can open almost any website. **What it saves is a narrower thing**, and the
difference matters before you rely on it for client work.

Everything marked **Verified** below was observed directly on this version.
Anything not verified is labelled as such rather than assumed.

---

## The one-line summary

> Froam saves your visual changes as **version-controlled override CSS plus a
> small runtime script**, placed alongside your project. **It does not edit your
> original components, templates or stylesheets.**

If you expected Froam to rewrite `Hero.tsx` or `base.html`, it does not. It adds
a presentation layer your project loads on top of what you already have.

That is a real, workable architecture — no build integration, no framework
coupling, nothing to migrate. But you should adopt it knowing what it is.

---

## Preview: opening your site

| Setup | Support | Notes |
| --- | --- | --- |
| Static HTML folder | **Verified** | `froam ./public` — editor injected into every `.html` |
| Local dev server over http | **Verified** | `froam http://localhost:3000` — proxied. HMR websocket pass-through is claimed but was not tested here |
| Live production site over https | **Verified** | `froam https://example.com` — proxied read-only for mock-ups |
| Script tag, your own page | Supported, not verified here | `froam dev` then add the bridge script yourself |

Preview works regardless of your stack, because Froam reads the **rendered DOM**
rather than parsing your source. React, Next, Nuxt, SvelteKit, Astro, Rails,
Django, PHP, WordPress and plain HTML all present the same way to the editor.

Two things to know:

- The dev proxy **strips `Content-Security-Policy` headers** so the editor can be
  injected. That is a development-only behaviour of the proxy; it does not change
  your site.
- Editing a live production URL is a **local mock-up**. Nothing is sent to that
  site and nothing there changes.

## Edits you can make

| Edit | Support | Saved as |
| --- | --- | --- |
| Colour, spacing, typography, borders, radius, shadows | **Verified** | Override CSS |
| Responsive changes per breakpoint | Supported | Override CSS in a media query |
| Hover / focus / active states | Supported | Override CSS |
| Text content | Supported | Runtime script (**required**) |
| Images | Supported | Runtime script (**required**) |
| Inserted blocks | Supported | Runtime script (**required**) |
| Brand fonts (your client's licensed typeface) | **Verified** | `@font-face` in the CSS, font embedded in the design |

**Style-only changes need only the CSS file.** Text, image and inserted-block
changes are applied by the runtime script at page load, so those require shipping
`froam.runtime.js`.

## What Save to Repo writes

Four files, into `froam/` in your repository:

| File | Purpose |
| --- | --- |
| `froam.design.json` | Your edits, as data. The source of truth. |
| `froam.generated.css` | Override rules, scoped by route. Uses `!important`. |
| `froam.runtime.js` | Applies text, image and inserted-block changes. **2,259 bytes gzipped** (measured, this version). |
| `froam.project.json` | Editor project state. Not needed in production. |

To ship, serve the generated files and reference them:

```html
<link rel="stylesheet" href="/froam/froam.generated.css">
<script src="/froam/froam.runtime.js" defer></script>
```

The runtime is a dependency-free script with **no network calls** — "no runtime
API dependency" means it never contacts a server, not that there is no script.
If you only made style changes, you can ship the CSS alone and skip the script.

---

## Known limitations

### Positional targeting can silently retarget — release blocker for maintenance

Generated selectors identify elements **by position**, not identity:

```css
html[data-froam-route="/"] … > h1:nth-of-type(1) { … !important }
```

The design file records only `"h1:1"` — a tag and an index. There is no id, class
or text stored to anchor it.

**Verified failure:** an edit was saved against the page's only `<h1>`. Another
`<h1>` was later added above it. The styling moved to the new heading and the
originally edited one lost it — with no error, in either the editor or the build.

| Element | Expected | Actual |
| --- | --- | --- |
| Newly added heading | unstyled | **received the saved styling** |
| Originally edited heading | styled | **lost the styling** |

Anything that changes sibling order of the same tag can trigger this: inserting,
reordering, duplicating or deleting an element.

**Until this is fixed, treat saved edits as tied to the page structure at the
time you saved them.** Re-open Froam and check after any structural change. This
is a poor fit for a site under active development by someone else, and a
reasonable fit for a page that is essentially finished.

A stable-identity system exists in the editor (`collab/anchor`), but **generated
output is still path-based** and no verification has been done that those
identities can be resolved from the exported runtime. Do not assume the fix is
already present.

### Other limits

- Froam looks for `[data-froam-root]`, `#root` or `#__next` and falls back to
  `main` or `body`. Sites with an unusual root may scope rules more broadly than
  you expect.
- Override CSS uses `!important`. If your own styles also use `!important` on the
  same property, the result depends on source order.
- Edits are keyed per route and per viewport. A route not opened in the editor
  has no saved edits.
- Behaviour under a strict production CSP has not been tested here.

---

## Choosing whether Froam fits

**Good fit**

- A finished or slow-moving page needing visual revisions
- A stack with no visual editing option at all — Rails, Django, PHP, WordPress, static
- You want the change in version control and reviewable in a diff
- You can ship one CSS file, and one small script if you change text or images

**Poor fit today**

- A page whose structure changes often, given the retargeting issue above
- You need your original components edited — use a source-editing tool instead
- You cannot add a stylesheet or script to the page
- You need the result to work with no additional files at all
