# Froam Assisted Pilot

## The offer

**Finish the website you already have, on the real page, and leave with
reviewable files you can ship.**

The Froam Assisted Pilot costs **$49 once**. It includes:

- one supported website project;
- one 45-minute setup and guided-editing session;
- a 30-day evaluation window;
- two follow-up troubleshooting threads about installation or generated output;
- a final fit check: keep using the free package, request a future Pro feature,
  or decide Froam is not right for the project.

This is paid onboarding and product evaluation. It is not a subscription, a
hosted account, unlimited implementation work, or a promise that Froam rewrites
the customer's source components.

## Who should buy it

The best first customer is a freelancer, technical founder, or developer who:

- already has a running website and access to its project;
- is comfortable running an npm command;
- recently lost time polishing typography, spacing, calls to action, responsive
  layout, or content on the implemented page;
- can add generated CSS and, when needed, one small runtime script to production;
- is evaluating Froam on a finished or slow-moving page.

Do not accept payment when the buyer needs source-component rewriting, cannot
change the project that serves the site, or expects edits to alter a third-party
production URL they do not control.

## What happens in the session

Before the call, collect:

1. The local or staging URL.
2. The framework or site type.
3. Confirmation that the customer owns or controls the source.
4. The page's main visitor action.
5. One visual problem they want to finish.

During the 45-minute session:

1. Run Froam against the project.
2. Make four representative changes: heading treatment, button treatment,
   spacing, and either text or an image.
3. Use **Save to Repo**.
4. Inspect `froam.design.json`, `froam.generated.css`, and
   `froam.runtime.js` together.
5. Load the generated files in the owned project.
6. Refresh the page and verify the result outside the editor.
7. Undo one change, save again, and verify the updated output.

The pilot succeeds when the customer can repeat that workflow without help and
can explain what Froam saves.

## Fit and safety rules

- A production URL is for a local visual mock-up. Shipping requires source or an
  integration the customer controls.
- Froam writes override CSS and a runtime; it does not rewrite the original
  React components, templates, or stylesheets.
- Current generated selectors are path-based. Structural changes can retarget a
  saved edit, so the customer must reopen and verify Froam after inserting,
  deleting, or reordering same-tag siblings.
- The local `--host` bridge may be used on a trusted private network. It must not
  be exposed as a public multi-tenant service.
- If the fit check fails before setup, do not take payment. If a verified
  supported workflow cannot be completed during the session, refund the pilot.

The full technical boundary is documented in
[What Froam supports, and what it saves](COMPATIBILITY.md).

## Copy for a payment page

### Froam Assisted Pilot — $49 once

Bring one website you control. In one guided session, we will open the real
running page in Froam, make representative visual and content edits, save the
result as reviewable project files, and verify it after a refresh. You then get
30 days to evaluate the workflow and two installation/output support threads.

Good fit: developers and freelancers finishing a live or staging page.

Not included: a redesign service, source-component rewriting, hosting, team
accounts, unlimited support, or access to an unreleased Pro plan.

### Call to action

Send your URL, stack, and the visual problem costing you time. I will confirm
fit before you pay.

## Outreach message

Hey {{name}} — I built Froam for the annoying last mile after a site already
works: typography, spacing, buttons, content, and responsive polish on the real
page, with the result saved as project files.

I am running five assisted evaluations at $49 each. We use one site you control,
set it up together in 45 minutes, verify the generated output after refresh,
and I support the evaluation for 30 days. Want me to check whether your current
project is a fit?

## Feedback to collect

Ask every participant:

1. What task were you trying to finish before Froam?
2. Where did setup or selection feel confusing?
3. Which edit saved meaningful time?
4. Did the generated files feel safe enough to ship? Why or why not?
5. Did you return without assistance within seven days?
6. What recurring capability would be worth paying $15 per month for?

Record behaviour, not compliments. A request counts toward a future Pro plan
only when multiple customers need it repeatedly.
