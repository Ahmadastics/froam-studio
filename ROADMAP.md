# Froam Rooms — roadmap to v6

**Where we are:** v4.9.2 · **Where this goes:** v6, more than one person in a design.

The v6 goal in one sentence: **two or more people open the same Froam design
from different devices — whether that's a designer and their client, or two
designers building together — and the room adapts to which one it is.**

## One substrate, two modes

There is **one** concept: a **room**. What changes is who's in it and what
they're allowed to do.

| | **Review** (designer ↔ client) | **Studio** (designer ↔ designer) |
| --- | --- | --- |
| Roles | 1 editor + commenters/viewers | 2+ editors |
| Writers | one | many |
| Conflict handling | none needed | needed |
| Surface | read-only page + comment pins + approve button | live cursors, selection halos, soft locks, chat |
| Transport | server → client push | bidirectional fan-out |
| Ships | v5.1 – v5.4 | v6.0 – v6.1 |

Same members table, same roles, same op log, same WebSocket. "Share for review"
and "Invite to edit" are two buttons over one system. That's the whole design.

**Build Review first anyway.** Not because Studio is out of scope — it isn't —
but because Review is sellable on its own (designers currently email
screenshots), it proves the transport with only one writer, and every piece of
it is a strict subset of what Studio needs. Nothing in the Review track gets
thrown away. Flip the order only if co-editing is what actually gets you a user.

The load-bearing consequence of wanting both: **Phase 0 has two extra
requirements** (actor-stamped causal ordering, and per-actor undo). Skip those
and v6.0 is a rewrite instead of an addition. They're marked below.

---

## The thing Froam already got right

The usual hard part of collaborative design tools is that the document is
enormous, so syncing it live is a nightmare. Froam does not have that problem,
by construction:

| Layer | What it is | Who owns it | Syncs? |
| --- | --- | --- | --- |
| **The page** | The host's actual website — DOM, assets, framework | The customer's repo | Never. It's already served. |
| **The design layer** | `EditorStore` — `Record<"route@@viewport", Record<path, ElementDraft>>` where a draft is `{ text?, imageUrl?, styles? }` | Froam | Yes. Kilobytes. |
| **The collaboration layer** | Comments, revisions, approvals, presence, cursors | New in v5/v6 | Yes. Tiny. |

The design layer is already a thin per-element diff keyed by DOM path
(`src/editor/GlobalChefEditor.tsx:122-128`). It is already published as a whole
over a two-endpoint contract (`lib/publish-store.mjs`). **The expensive part of
collaboration is already solved and shipped.** What is missing is identity,
anchoring, and status.

---

## The single biggest cost saver

> **The client should open the deployed site, not a rebuilt viewer.**

Do not build a canvas that renders someone else's website. The client opens the
customer's own **staging or production URL** with `froam.runtime.js` on it, plus
a review token in the query string. The runtime fetches the review snapshot
instead of the published design and renders it read-only, with the comment layer
mounted on top.

That means the "client viewer" is not a new rendering engine — it is
`FroamRuntime` in a new mode. It reuses the existing runtime, the existing
route/viewport keys, the existing publish contract. This is the difference
between v5.1 being two weeks and being two months.

**Constraint that follows:** review links require the site to be reachable
somewhere the client can load. Staging URL, preview deploy, or production. Sites
that only exist on `localhost` cannot be reviewed. Document that as the price of
not building a viewer, and make `froam dev --host` + a tunnel the documented
fallback.

---

## Do you need a CRDT? Mostly no.

The reflex answer for co-editing is "use Yjs." For Froam's data model that is
mostly overkill, and the exception is the interesting part.

| What's being edited | Shape | Merge rule | Verdict |
| --- | --- | --- | --- |
| Styles — colour, padding, radius, transform… | flat `prop → value` map | LWW per `(path, prop)` | **No CRDT.** A map of last-write-wins registers *is* a CRDT, and it's twenty lines. |
| Image swaps | one value per path | LWW | **No CRDT.** |
| Text content | one string per element | LWW per element | **No CRDT, with a caveat.** Two people rewriting the same headline at the same moment is rare, and a soft lock covers it. Character-level merge is a v6.1+ luxury. |
| Structure — insert block, reorder, delete, wrap-in-container | a tree | order matters | **This is the real problem.** |

Structural ops are where naive LWW actually breaks: two concurrent inserts at
the same position, or a move into a container someone else just deleted.

The cheap correct answer is **not** a CRDT — it's a **server-ordered log**. The
room server is the single authority on op order: clients apply optimistically,
send to the server, the server assigns the definitive sequence and fans out. On
conflict a client rewinds its local ops and replays them after the server's.
For 2–5 people in a room this is dramatically simpler than a CRDT, it needs no
new dependency, it keeps the whole design serialisable to the existing
`froam.design.json`, and it degrades to plain LWW for the 95% of ops that are
style changes.

Reach for Yjs only if you later want true offline-first co-editing where two
designers both work disconnected for hours and merge. That is a different
product. Don't pay for it now.

**Soft locks do most of the work anyway:** while someone is dragging, resizing
or typing in an element, that element shows their colour and is read-only for
everyone else. The lock releases on blur or a few seconds after the last op.
Most "conflicts" simply never happen.

## The other thing that must not be skipped

Froam's identity is **"no database, no runtime API dependency, no drift."** It's
an MIT package installed into someone else's repo. Collaboration needs a server.
Those two facts fight.

The resolution is the pattern Froam already uses for Publish: **Froam ships a
contract plus a file-backed dev implementation; the host mounts it.** Froam does
not own accounts, does not run a service, does not require a signup. There is
already `FroamAuthProvider` / `FroamAuthUser` / `ownerEmails` in `src/config.ts`
— review identity extends that, it does not replace it.

Run'Am can host the reference implementation for people who don't want to run
one. That's a Run'Am product, not a Froam dependency.

---

## Phase 0 — this week, mostly no new features

> **Status:** 0.1, 0.2 and 0.2b shipped in **v4.9.2** — `src/collab/` holds the
> schema, the op log, the session and its persistence, with the editor writing
> to all of it. 0.3 (anchor stability) and 0.4 (the two first screens) are
> still open, and 0.3 is the one with real risk in it.

### 0.1 The schema page

One page, in `docs/`, drawing the line between the three layers in the table
above. Name the keys, name the anchors, name what is immutable. Everything below
is blocked on this being right.

### 0.2 Rebuild undo on an operation log — ship as v4.9.2

This is the whole game, disguised as a bugfix.

Undo is currently **whole-store snapshots**: `undoStack: EditorStore[]`
(`GlobalChefEditor.tsx:1772`), persisted to `localStorage` capped at 6 entries
and 600 KB (`MAX_HISTORY`, `MAX_HISTORY_BYTES`), with a 400 ms debounce. That
works for one person on one device and cannot be extended — you cannot broadcast
a full store per keystroke, and two snapshots cannot be merged.

Replace it with an append-only op log. Because the store is already a flat
`path → draft` map, the op falls out almost for free:

```ts
type FroamOp = {
  id: string            // uuid
  actor: string         // user id, or 'local'  ← REQUIRED for co-editing
  clock: number         // Lamport counter      ← REQUIRED for co-editing
  ts: number            // wall clock, for display only
  routeKey: string
  viewport: ViewportMode
  path: string          // the same DOM path the store keys on
  field: 'text' | 'imageUrl' | `style:${string}`
  before: string | undefined
  after: string | undefined
}
```

Undo = invert and reapply. Redo = reapply. Merge = last-write-wins per
`(path, field)`. Same log, three features.

**The two fields that only matter because you want Studio mode:**

- **`actor`** — stamp it from day one even while everything is `'local'`.
  Retrofitting an actor onto a log that doesn't have one means every persisted
  history is unreadable.
- **`clock`** — a Lamport counter, not wall-clock time. Two phones on Nigerian
  mobile data will disagree about what time it is, sometimes by minutes.
  Resolving concurrent edits by `ts` means the person with the fast clock always
  wins, forever, invisibly. Order by `clock`, tiebreak on `actor` id. `ts` stays
  in the record purely so the history panel can say "3 minutes ago."

### 0.2b Per-actor undo — decide this now, not at v6

Single-player undo is "pop the stack." Multiplayer undo is **"undo *my* last
op"** — if Ahmad hits Ctrl+Z it must not silently revert what his co-designer
just did on the other side of the page.

That is not a v6 feature bolted on later; it is a different data structure. If
undo is a cursor into one global stack, it breaks the first time a second editor
joins, and fixing it means rewriting undo a second time. Build it as **a
per-actor filter over the shared log** from the start:

```
undo() → find the last op where actor === me and not yet undone → emit its inverse
```

With one user this behaves identically to today's undo, so it costs nothing to
ship in v4.9.2. With two users it is already correct.

The refactor is concentrated, not sprawling. Every mutation already funnels
through a handful of places:

- `updateDraft` — `GlobalChefEditor.tsx:2913`
- `updateTargetDraft` — `GlobalChefEditor.tsx:3133`
- the path-targeted style write — `GlobalChefEditor.tsx:4203`
- `pushHistory` / `commitToUndoStack` — `GlobalChefEditor.tsx:2711`, `:2746`

Make those emit ops, derive the store from the log, and the undo stack becomes a
cursor into the log instead of an array of copies. **Wins immediately, before any
collaboration exists:** unlimited history instead of 6 entries, history that fits
in storage, a real "what changed" list, and per-actor undo when actors arrive.

### 0.3 Solve path stability — the actual technical risk

Everything anchors to the same DOM `path` string the store keys on — drafts,
ops, comments, selections, locks — which is free and elegant right up until the
page gets restructured and every anchor points at nothing. This is the one
problem in this roadmap with no cheap answer, and it bites **both** modes: a
client's comment thread detaches in Review, and in Studio two editors resolve
the same path to different elements. Start on it now, not at v5.2.

Minimum viable answer: store a **fingerprint** alongside the path — tag, text
snippet, nearest stable ancestor, ordinal among siblings. On load, if the path
misses, re-resolve by fingerprint. If that misses too, mark the comment
*orphaned* and surface it in a list rather than losing it silently.

### 0.4 Sketch both first screens

**The client:** someone with zero Froam knowledge taps a link on a phone. What
do they see? If the answer involves explaining anything, the design is wrong.

**The second designer:** they already know Froam. What tells them, in the first
second, that someone else is in here — and stops them fighting over the same
element? Sketch the presence surface before building the transport.

---

## v5.0 — Identity & rooms

Plumbing only. Nothing collaborative is visible yet, in either mode.

- A **room**: server-side record with an id, a route/viewport scope, and a
  member list. Review and Studio are the same record with different role mixes,
  so build the general one now — a room that only ever allows one editor costs
  the same to model as one that doesn't.
- Roles: `owner` / `editor` / `commenter` / `viewer`. Two of these carry weight:
  `commenter` is what lets a client in without letting them break anything, and
  a second `editor` is the switch that turns the room into Studio mode later.
- Identity via the existing `FroamAuthProvider` seam. Magic-link email is enough
  for the reference implementation; Froam itself stays BYO-auth.
- Extend the publish contract with room endpoints, file-backed under
  `froam dev` exactly like `froam.published.json` is today.

## v5.1 — The share link

Publish a design snapshot to a token URL. Client opens the deployed site with
`?froam-review=<token>`, `FroamRuntime` renders that snapshot read-only, editor
chrome never loads.

**This alone is sellable.** Most designers currently send screenshots and PDFs.
Ship it and get one real client using it before building anything else — the
feedback from that one client should reorder everything below.

## v5.2 — Anchored comments

Client taps a hero section, leaves a note. Threads, resolve, notify. This is the
first synced object type — route it through the Phase 0 op layer and v6 inherits
it free. Uses the fingerprint anchoring from 0.3.

## v5.3 — Revisions & approval

Snapshots with a status: `sent` · `changes requested` · `approved`. Compare two
revisions side by side. There is already scaffolding here — `FroamVersionPanel`
does local + remote versions with thumbnails
(`src/editor/FroamVersionPanel.tsx`), and the Run'Am backend already has a
versioned publish store. Revisions are versions with a status field and an
audience.

This is where it stops being a viewer and becomes the designer's client
workflow — and it's the thing worth charging for.

## v5.4 — Live push

Designer edits, the client's open tab updates without a refresh. "Client is
viewing" indicator. Ops from the log stream straight down the wire.

**This is the de-risking phase for Studio mode.** It is the full v6 transport —
room server, sockets, op streaming, reconnect, presence — run in the one
configuration where it cannot corrupt anything, because only one side writes.
Every bug you find here is a bug you don't find with two designers mid-project.
Half of v6.0 gets built and hardened under a much lower-stakes label.

## v6.0 — Studio mode: the second editor

The same room, with `editor` granted to more than one member. Everything below
is additive — no phase above gets rewritten, provided Phase 0.2/0.2b were done
properly.

- **Bidirectional ops.** v5.4's one-way push becomes fan-out. The server assigns
  the definitive sequence (see the CRDT section); clients apply optimistically
  and rewind-replay on conflict.
- **Presence.** Who's in the room, what route/viewport they're on, what they
  have selected. Ephemeral — never touches `froam.design.json`.
- **Live cursors + selection halos.** Each actor gets a colour. Their selected
  element wears it.
- **Soft locks.** Actively-dragged elements are read-only for everyone else.
  This is what makes conflicts rare enough that LWW is honest.
- **Per-actor undo** already works, because 0.2b built it.

The genuinely new engineering here is presence and the fan-out server. The merge
story was decided in Phase 0.

## v6.1 — Room chat & structural merge

- **Room chat** — ephemeral session talk, distinct from the anchored comments
  from v5.2 which persist and resolve. Two different features; build both.
- **Structural ops through the ordered log** — insert, reorder, delete, wrap.
  The hard tail from the CRDT table, worth doing once the room is real and you
  know which structural edits people actually collide on.
- **Offline queue** — ops buffer on-device and replay on reconnect. Given
  Nigerian mobile data this may deserve to jump the queue and land in v6.0;
  decide once you've watched two people use a room on real connections.

---

## Start here

1. Write `docs/schema.md` (Phase 0.1).
2. Open `src/editor/GlobalChefEditor.tsx` and put every mutation behind the op
   log — **with `actor` and `clock` on every op, and undo filtered per actor**
   (Phase 0.2 + 0.2b). Ship it as **v4.9.2 — unlimited undo**.

Everything else is blocked on those two. And the parenthetical in step 2 is the
difference between v6.0 being an addition and being a rewrite: those three
details cost about a day now and cannot be retrofitted onto a log that shipped
without them.
