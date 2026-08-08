# Froam Rooms — roadmap to v6

**Where we are:** v6.3.0 · **Status:** Connected Canvas is visible and usable; v7 intelligence systems have not begun.

The roadmap is retained below as the architectural record. Phase 0 and the
v5 review track shipped first; v6.0/v6.1 complete the same room with ordered
multi-writer ops, presence, cursors, soft locks, room chat, reconnect replay,
authority-aware conflicts and structural edits carried by the shared op log.

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

> **Status:** 0.1, 0.2 and 0.2b shipped in **v4.9.2**; 0.3 landed after it.
> `src/collab/` holds the schema, the path format, the op log, the session,
> its persistence and the anchor resolver, with the editor writing to all of
> it. Only 0.4 — sketching the two first screens — is still open, and that one
> is design work rather than code.

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

**Shipped** in `src/collab/anchor.ts`, with one correction to the plan above:
the path is *verified* against the fingerprint rather than merely tried first.
A path that still resolves after a restructure is the dangerous case, not the
happy one — it hands back a real element that is the wrong element, which is
exactly how a comment thread silently re-attaches to someone else's paragraph.
An exact `id` match is treated as decisive; below a 0.5 score nothing matches,
because an honest orphan beats a confident mistake.

First consumer is the editor's own selection, which now follows an element
through a restructure instead of dropping. Comments (v5.2) and soft locks
(v6.0) inherit it.

### 0.4 Sketch both first screens

**The client:** someone with zero Froam knowledge taps a link on a phone. What
do they see? If the answer involves explaining anything, the design is wrong.

**The second designer:** they already know Froam. What tells them, in the first
second, that someone else is in here — and stops them fighting over the same
element? Sketch the presence surface before building the transport.

**Done** — fig. 0.4, and the client half settled v5.1's whole shape. See below.

### 0.5 The change log — every edit, named and individually undoable

With two people in a design, "undo" stops meaning "the last thing" and starts
meaning "*that* thing, the one Zainab did to the footer". A stack cannot express
that. A list can.

The log already carries everything needed — actor, label, path, timestamp,
batch — so this is a reading of it, not new bookkeeping:

- one row per action, not per op, since a batch is what a person thinks of as
  a change;
- **who** made it, **what** it was, **which element**, **when**;
- undo any single row, not just the most recent.

**Selective undo is a revert, not a rewind.** Undoing something from the middle
of the history cannot rewind time — later edits may have touched the same
field. So it appends a *new* op restoring that field to the value from before
that change. Always safe, always last-write-wins, and it shows up in the list
as its own entry, attributed to whoever did the reverting. Nothing is ever
quietly rewritten.

That property is what makes the 60/40 rule enforceable later: undoing someone
else's work is an ordinary, attributed, visible act, so it can be permitted,
proposed, or refused without inventing a second mechanism.

This also retires the last snapshot in the editor — the History panel is still
six deep-copied stores in `localStorage`.

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
- **Editors are not equal peers — call it 60/40.** The owner outranks an invited
  editor, and the model says so explicitly rather than pretending symmetry and
  discovering the hierarchy during an argument:
  - both edit freely, and every change is attributed;
  - on a genuine conflict for the same field, the **owner's value stands**,
    whatever the clock says;
  - the owner can **undo anyone's** change; a guest editor can only **propose**
    undoing someone else's, and the owner enacts it;
  - the owner can end the session or drop an editor to commenter.
- Identity via the existing `FroamAuthProvider` seam. Magic-link email is enough
  for the reference implementation; Froam itself stays BYO-auth.
- Extend the publish contract with room endpoints, file-backed under
  `froam dev` exactly like `froam.published.json` is today.

## v5.1 — The review session

Not a static link. **One link, and presence decides what it does** — when the
designer is in there the client follows them through the site, like sharing a
screen except the thing on screen is the real site and the client can touch it.
When the designer isn't, the same link is just the design, browsable, and notes
wait for morning. Nobody picks a mode.

See `docs/` fig. 0.4 for the drawn screens. The decisions it settled:

- **The site is the hero. Froam is a bar at the bottom.** If the first thing
  they see is a review tool, they think the review tool is what you built.
- **Follow the route, never the viewport.** The designer is on desktop, the
  client is holding a phone, and Froam keeps a design per viewport — pushing
  the designer's viewport would show a layout never meant for that hand.
- **Following breaks gently.** Scroll, tap, or open the comment sheet and it
  pauses; Rejoin is one tap and always visible. Following is a courtesy, never
  a cage.
- **Navigation is narrated** — "Ahmad moved to Pricing" — because being
  teleported with no explanation is the worst moment in any shared-screen tool.
- **Edits arrive settled, not mid-drag.** The op batch that already collapses a
  colour drag into one undo step is the same signal for "finished enough to
  send", so the client sees results and never the fumbling.
- **Comment mode is a mode.** On a phone, tap-to-comment and tap-to-navigate
  are the same gesture; while the banner is up, taps drop a pin.
- **No account, ever.** The link is the credential, the name is typed once.
- **Approval never blocks on open comments.** "Approved, with two notes" is
  real information.

**Cost of the session model:** live push moves here from v5.4 — a socket,
presence, and a route broadcast. Not new risk; publishing already reaches every
device, so this is making it live rather than making it work. It does mean
v5.0's rooms stop being optional, because a session has to know who is in it.

Ship it and get one real client through a real review before building anything
else. That feedback should reorder everything below.

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
