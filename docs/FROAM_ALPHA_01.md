# Froam Alpha 01

A private alpha for 5–8 invited testers. It answers one question:

> Can someone who did not build Froam run one command and successfully edit a real website?

Everything else — billing, accounts, teams, cloud storage — is out of scope.

---

## The invite (send exactly this)

> You've been invited to test Froam.
>
> Froam lets you visually edit a website in your browser.
>
> You need Node.js installed (nodejs.org, the LTS button).
>
> Open PowerShell (Windows) or Terminal (Mac/Linux) and run:
>
> ```
> npx @ahmadastic/froam
> ```
>
> Copy that line rather than typing it — the `@` at the front matters.
>
> Paste the address of the website you want to edit. Froam opens it for you.
>
> Editing your own project instead? Start it the way you normally do
> (`npm run dev` or similar) before running Froam — it will find it and offer it
> to you in a list.
>
> Try changing text, colours, fonts, images, sections and layout — anything you
> think should be editable. If something confuses you or breaks, tell us what you
> were trying to do at the time. That is the useful part.

Do not explain flags, ports, workspaces or how the proxy works. If a tester needs
that explained, that is a finding.

### What they see

```
◆ Froam
  Paste the website you want to edit.

  Already running on this computer:
    1  localhost:3000  My Portfolio
    2  localhost:5173  Vite + React

  Website URL, or a number: 1

  Connecting to http://localhost:3000 …

  Where is this project on your computer?
  Paste the folder, or press Enter to keep the edits in your Froam folder.
  Folder:
```

Froam scans the ports frameworks actually use, so a tester editing their own
project presses `1` instead of knowing what a port is. The folder question is
only asked when the terminal is not already sitting in the project — answer it
and the design files land in the repo, press Enter and they stay in `~/Froam`.

---

## What testers should try

Give missions, not "play with it":

- change some visible text
- change a text colour
- change a font, then a font size
- swap an image
- resize something
- move something
- select something nested inside something else
- edit a whole section
- edit the header / navigation
- refresh the page — are the edits still there?
- undo, then redo
- go to another page on the site
- deliberately try something you think should work

Then, last: **make this page look the way you personally would want it to look.**

---

## What to measure, per tester

- Did they get from command to editor with no help?
- Did `npx` confuse them, or print anything scary?
- Did the browser open on its own?
- Did they understand how to select an element?
- Text, colour, font, size — which were easy, which were not?
- Did nested elements make selection frustrating?
- Did refresh keep their edits?
- Did navigating to another page break anything?
- Did the site itself render wrong through Froam?
- Did undo/redo behave the way they expected?
- Did they understand Save / Export?
- Where did they ask for help?
- What did they assume would work and did not?
- Would they use this on a real project?

---

## Known limits in Alpha 01 — say these up front

- **Individual sessions only.** Collaboration/rooms are not part of this alpha;
  do not put two testers in one editor.
- **Edits are local to the tester's machine.** Online sites save under
  `Froam/<site>` in their home folder; a local project saves into the project.
- **Alpha 01 does not change the real website.** It edits a local copy served
  through Froam.

---

## Release gates

Automated — both must be green:

```
npm run build
npm test                 # unit tests, no network
npm run verify:alpha     # drives the real CLI, needs a network
```

`verify:alpha` covers, end to end:

| Gate | What it proves |
| --- | --- |
| zero-argument run | prompt appears, editor starts |
| bare domain | `froam example.com` works with no flags |
| full URL | `https://…` works and gets its own workspace |
| system directory | running from `C:\Windows\System32` does not fail |
| local project | edits stay in the project (Repo Mode intact) |
| project picker | a running dev server is listed by name and pickable by number, and its edits land in the project rather than wherever the terminal opened |
| busy port | 4600+ taken is stepped over, never EADDRINUSE |
| unreachable site | explained in words, never a fake "ready" |
| project not started | tells the tester to start their project |
| typo | re-asks instead of exiting |
| advanced CLI | `init/dev/build/status/check/doctor/migrate/version`, `--port`, `--dir` still work |

Manual — do these before inviting anyone:

- [ ] `npm pack`, then from a **fresh PowerShell opened in `C:\Windows\System32`**:
      `npx --yes "<path>\ahmadastic-froam-<version>.tgz"` — prompt appears, paste a
      real site, editor loads, no EPERM.
- [ ] Same packed tarball with a URL argument: `npx --yes "<path>.tgz" https://example.com`
- [ ] Same packed tarball against a local project: start it, confirm Froam lists it,
      pick it by number, and confirm `froam/` appears inside the project
- [ ] Make an edit, refresh the browser, confirm the edit survives.
- [ ] Undo and redo an edit.
- [ ] Run once on macOS or Linux (browser opens, workspace lands in `~/Froam`).
- [ ] Run once on a machine with antivirus HTTPS inspection (Avast/Kaspersky/corporate
      proxy) — Froam should recover by itself on Windows, or explain the certificate
      problem in plain language. It must never print a stack trace.
- [ ] `npm view @ahmadastic/froam version` after publishing matches what testers get.

Do not publish until every box is ticked.

---

## If a tester gets stuck

Ask for: the exact command they ran, everything the terminal printed, and what
they were trying to do. Do not ask them to add flags — a needed flag is a bug in
this alpha.

### It loaded, then nothing happened

Check the `@` first. `npx ahmadastic/froam` — no `@` — is not this package. npm
reads `owner/name` as a GitHub repository and tries to clone it over SSH, so it
hangs on a host-key prompt or a missing SSH key. Froam never starts, which is
why there is no Froam error to read. Nothing in this package can catch that; it
happens before our code runs.

The other thing worth checking on a borrowed laptop:

```
node --version                    # 18 or newer
npx @ahmadastic/froam version     # should print froam v8.3.0
```
