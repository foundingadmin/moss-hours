# Moss reporting: roadmap

**Status:** the two-report rebuild is merged and deployed. Both reports are
hidden from the client behind the holding page. Nothing has been shown to Moss
yet.

**Last updated:** 5 August 2026.

Read this first if you are picking the project up. `README.md` is the reference
documentation and `CLAUDE.md` is the house rules; this file is the state of play
and what happens next.

---

## Where things stand

| | Report A | Report B |
| --- | --- | --- |
| Page | `index.html` | `report-b.html` |
| Title | Fractional Creative Usage | Ad Hoc Creative Support |
| Source | ClickUp, two retainer folders | `data/sows.json` |
| Unit | Hours against a 50h monthly allowance | Days and dollars |
| State | Built, deployed, hidden | Built, deployed, hidden |

The two never share a data source and that is architectural rather than a
filter. Do not undo that to save a few lines. `npm run check` enforces it.

The rundoc that specified this build is `RUNDOC.md`. Every phase in it is done
except the parts that need a person in ClickUp or a decision from Josh, which
are Sprint 0 below.

---

## Open decisions

These block work below them. None can be settled from the code.

### 1. Where does Report A live once `/` becomes a landing page?

The landing page plan puts two cards at `/`, which is currently Report A. **The
client's link is the root.** Moving Report A to `/report-a.html` without a
redirect breaks a URL that has already been shared.

Options: keep Report A at `/` and put the landing page at `/reports`, which
costs the landing page its natural home; or move Report A and add a
`redirects` entry. Note that `vercel.json` currently uses `routes`, which
**cannot be combined with `redirects`, `rewrites` or `headers` in the same
config**. Going live already means deleting the `routes` array, so this is a
good moment to make that swap deliberately rather than discovering it.

Recommendation: land the landing page at `/` as planned, move Report A to a
named path, and convert the config to `rewrites` plus `redirects` at go-live.

### 2. Does the year pill selector die?

Report A 2025 as a separate page and the existing year pills are two answers to
the same question. The pills already exist and already work for any year; the
selector currently lists the current year alone, and `?year=` still reaches a
year it does not offer.

Separate pages give each year its own URL to share, which is the stronger
argument. If that is the ruling, `YEAR_OPTIONS`, `renderYears()` and the
`?year=` handling should come out rather than sit dormant and contradict the
nav.

### 3. How far does "reusable component system" go without a build step?

The component standardization work is the largest item on this roadmap and it
runs into the one thing this project has deliberately never had: a build step.
Two self-contained HTML files that duplicate their CSS is exactly what a
component system exists to stop.

Three honest options:

| | What it means | Cost |
| --- | --- | --- |
| Shared static assets | One `styles.css` and one `components.js`, linked by every page. No build, no framework. | Two extra network requests. Loses "open the file and it works". |
| Keep duplicating | Every page stays self-contained; a component changes in three places. | Guaranteed drift, which is the problem being solved. |
| Introduce a build | Real components, real reuse. | A build step, a dependency tree, and a deploy that can fail for reasons unrelated to the report. |

Recommendation: shared static assets. It gets almost all of the reuse, keeps
the deploy trivially simple, and `npm run check` can enforce that every page
links the shared sheet. Decide before Sprint 1 starts, because the semantic
colour work is the first thing that wants a shared home.

---

## Sprint 0: go live

Everything here blocks showing either report to Moss.

### 1. Delete the fixture time entries

**The hard gate.** Task
[`868kmdh0u`](https://app.clickup.com/t/868kmdh0u) (`ZZ FIXTURE / DASHBOARD
WIRING / DELETE BEFORE CLIENT VIEW`) carries 666 deliberately absurd hours dated
January 2026, inside a retainer folder on a live feed. While it exists January
reads **688.75h against a 50h allowance**, which is what the client would see.

The API connector cannot delete time entries. Josh removes all three by hand from
the Time tracked panel on that task, then archives or deletes the task itself.

Verify against `_archive/2026-08-04-v1-report/pre-teardown-baseline.json`:

- January total falls from `688.75` to exactly **`22.75`**
- task id `868kmdh0u` appears in no month's item list
- every month still satisfies `total === logged + documented + estimated`

`RUNDOC.md` Prompt 07.2 has the full ten-item acceptance list.

### 2. Finish the reconstruction in ClickUp

January through May 2026 currently render as **fully logged**, because only the
fixture entries carry markers. That is truthful: absence means logged by design,
so untagged reconstructed hours default to the honest class rather than
inflating the reconstruction. But it is not the story the page is telling, and
the note under the chart describes a split the chart is not yet showing.

Tag the reconstructed entries as they are rebuilt. Two levers, both already read
by `api/time.js`:

| Written by | Documented | Estimated |
| --- | --- | --- |
| A person, in the ClickUp UI | tag `documented` | tag `estimate` |
| The bulk API connector | description prefix `[RECON:DOC]` | prefix `[RECON:EST]` |

The tag is `estimate`, not `estimated`. The connector cannot attach tags at all,
which is why the second row exists. No code change is needed; check `?debug=1`
for `classificationConflicts` if an entry ends up with both.

### 3. Fill `SLA_DOCUMENT_URL`

In `index.html`, currently `''`. Host the signed agreement somewhere the client
can open it and set the constant. While it is empty the footer renders as if the
feature did not exist, which is deliberate: a link to nowhere is worse than no
link. This is also the first entry in the footer's document links (Sprint 2).

### 4. Take the holding page off

Delete the `routes` array from `vercel.json` and redeploy. See open decision 1
first: if Report A is moving, make the `routes` to `rewrites` conversion in the
same change rather than twice.

Until then the holding page is scoped to four hostnames rather than catching
every request, so preview deployments serve the real reports while the client's
link stays hidden. **That scoping fails open**, so `npm run check` treats a
hostname missing from the list as a hard failure. If a domain is ever added to
the Vercel project, add it to both `vercel.json` and the `PUBLIC_HOSTS` list in
`scripts/check.mjs`.

Verified on the production deploy: all four hostnames serve the holding page at
`/`, `/report-b.html` and `/api/time`, with `/assets` exempt.

### 5. Loose ends

- **Push the v1 tag.** `git push origin v1-final-2026-08-04`. It exists locally
  and in the zipped archive but not on origin, because the session that made it
  could only push branches.
- **`construction.html` still says "Moss · Hours Report"** in its `<title>`, a
  report name that no longer exists.

---

## Sprint 1: the design system foundation

**This comes before the visual work, not after it.** Every item in Sprints 2
through 4 renders something, and each one either uses this vocabulary or invents
its own. Doing the QA sweep first means doing it twice.

### Semantic colour, and the collision to solve first

The requirement is Positive, Negative and Warning ramps that read as system
signals and are not confused with brand colour. That is harder here than it
sounds, because of what the brand already owns:

| Currently | Means |
| --- | --- |
| Mint `#7EF893` | Retainer hours. The data series, all three evidence classes. |
| Holo cyan `#69EEFF` | Interface action and state: year pills, links, focus rings, the open row. |
| Warn yellow `#F5C26B` | Data integrity, never utilisation. |
| Holo lavender | Brand ornament only, since the second series was removed. |

**The problem: positive is conventionally green, and green is already the data.**
A positive signal in any mint-adjacent hue will read as retainer hours. Solve
that deliberately rather than by picking a slightly different green. Options
worth testing: push positive well away in hue and chroma (a deeper, cooler,
lower-chroma green than mint), or accept that positive is carried primarily by
icon and weight with colour as reinforcement.

Cyan is also spoken for, so the ramps must avoid it too.

Deliverable: a documented ramp per signal with a stated rationale for each hue
choice, contrast figures against the dark surface, and a written rule for what
each signal is allowed to mean. Put the rationale in the README next to the
existing "colour is reserved" section, because that section is what stops the
palette drifting.

### Icons are mandatory, not decorative

Every semantic signal carries a **dedicated icon** as well as colour. Colour
alone fails for colour-blind readers and fails entirely in print, and these
reports get printed and forwarded.

The existing warn triangle (`ICONS.alert`, drawn to the canvas by
`drawWarnIcon()` and inline in the DOM) is the model: the same mark exists in
both renderers and they are kept in step by hand. Each new signal needs the same
treatment if it can appear on the chart.

### Type scale and contrast

The brief is larger type and more contrast throughout. Some of the groundwork is
already in place: `--t-section` and `--t-figure` are tied to the design-system
heading ramp one rung apart, and the text ramp was lifted once already because
`--dim-2` measured 4.6:1 and was doing real work at 11px.

Two things to know before starting. This is a **layout sprint, not a token
tweak**: these pages are dense, and the summary table already tightens type and
gutters at 680px and again at 430px to fit four columns on a small phone. Raising
the base size will break those fits and they will need re-solving rather than
nudging. And measure rather than eyeball: the target is a stated WCAG level, and
the current values should be recorded before they change so the improvement is
demonstrable.

### Component inventory

Write down what exists before standardizing it. The shared vocabulary, from what
both pages already contain:

`H1` and page header · summary card · fun fact module · FC team module · data
table with expandable rows · chart · tooltip · legend · pattern and texture
overlays · badge and tag · skeleton and empty states · footnote block · nav ·
footer

For each: where it lives now, how the two pages differ, and what the single
version should be. Expect the differences to be small and numerous, which is
exactly why this is worth an inventory rather than a sweep.

---

## Sprint 2: the shell

Nav, landing page and global footer. These are one sprint because they are one
system and they all depend on open decision 1.

### Primary nav

A simple primary navbar, working on desktop and mobile, linking the reports.
Requirements worth stating up front:

- It is chrome, so it uses the action colour and no series colour.
- The current page is marked, and marked by more than colour.
- It survives the page set growing. Report A 2025 (Sprint 3) and any future year
  are nav items, so a two-item design that only works for two items is the wrong
  design.
- Keyboard reachable, with a visible focus ring, and the mobile disclosure
  announces its own state.

### Landing page

`/` becomes a landing page with two large cards, one per report. Each card
should say what the report covers and in what unit, because the whole point of
splitting these reports is that they measure different things. A reader who
picks the wrong card has been failed by the card.

Keep it genuinely simple. It is a signpost, not a dashboard, and it should not
grow summary figures: a figure on the landing page is a third place for the
arithmetic to disagree with itself.

### Global footer

Shared across every page, alongside the nav. Contents:

- **Key documents.** The signed SLA first (`SLA_DOCUMENT_URL`, Sprint 0). This
  is the trust layer, and the reason it works is that every claim in Report A
  cites a numbered clause a reader can go and check.
- **Contact.** Josh is the single primary point of contact under clause 5.3.2,
  and the client also has access to a Production Coordinator under 5.3.3. The
  footer should match the agreement rather than inventing a different structure.
- **Founding Creative LinkedIn**, and the existing foundingcreative.com link.
- **A meeting link.**
- The data freshness readout, which currently lives in Report A's footer and
  needs to stay meaningful on pages that have no API call behind them.

One judgement call to make deliberately: this is a private client report, not a
marketing site. The footer should reinforce trust and make us easy to reach
without turning the page into a pitch.

---

## Sprint 3: content and data

### SOW data import

Backfill every executed statement of work into `data/sows.json`. This is the
single biggest unlock for Report B, which is currently correct and very thin.

Budget real time. It is contract data entry, every figure ends up in front of a
regional lead, and `npm run sows` will catch arithmetic that does not reconcile
but cannot catch a number typed correctly off the wrong document.

Expect this to want **several QA passes**, not one. A good rhythm is import a
batch, render it, read every row against the source document, fix, repeat.

### Full team headshots

Complete `var TEAM` in `index.html`: name, title and a 160px square webp under
`team/roster/`. Once the FC team module is standardized (Sprint 1) this array
moves to the shared component and serves every page.

A member whose image is missing renders as text rather than a broken tile, so
entries can land before artwork.

`team/stack/` still holds 48px head crops from the old avatar row. Nothing
renders them. Decide whether the standardized module wants a small variant
before deleting them.

### Report A 2025

A separate page rather than a tab, per open decision 2. The API already takes
any year and the loader already handles it, so the work is the page, the nav
entry and the URL, not the data.

Two things to check rather than assume. `allowanceMonths()` counts from the
first tracked month through the current month for the current year, and through
the last month with time on it for a past year, so 2025 should already compute
its allowance correctly. And the agreement starts February 2025, so January 2025
is outside the term: confirm what the page says about a month the retainer did
not cover.

### Footnotes

Relocate the fineprint blocks to proper footnote positions on every page. Today
they sit inline where they were written: the reconstruction note between the
chart and the table, the overage note under the table, the sorting note inside
each drawer.

Worth keeping in mind while moving them. The reconstruction note is deliberately
above the table, because a reader who has just seen striped bars asks what they
mean before they read figures, and an answer that arrives after they have
decided what to think is too late. If it becomes a footnote it needs a marker at
the chart that takes the reader to it. "Proper footnote location" should mean a
consistent, findable position, not simply further down.

---

## Sprint 4: QA and standardization

The consistency sweep. It runs last because it checks the work of every sprint
above it.

**Cross-page consistency.** Flip between the pages and confirm the layout, grid,
spacing, positioning and styling hold: the H1, the summary card, the fun fact
module driven by each page's own data, the FC team module, tables, charts,
tooltips, legends and pattern overlays. Anything that moves when you switch
pages is a bug.

**Accessibility.** WCAG conformance to the level agreed in Sprint 1, measured
rather than assumed. Contrast, focus order, keyboard reachability, the mobile
nav's announced state, and every semantic signal carrying its icon.

**Breakpoints.** Both reports at 375px, 768px and 1280px, and the summary table
specifically at 390px, where four columns plus the total column's inset were
9px over the viewport once already.

**Print.** Both reports print, and the print stylesheet re-points the tokens to
a light palette and re-themes the chart canvas around the `beforeprint` and
`afterprint` events. New semantic colours and new components need print
treatment or they will arrive as invisible or as black.

**Regression.** `npm run check` and both sub-suites. Consider whether any of
the consistency checks in this sprint can become an automated check, since a
standard nobody can run is a standard that decays.

---

## Backlog

Recorded, not scheduled.

**Export.** Backlogged by decision. The CSV builders, the export menu and the
print stylesheet are complete and hidden behind `SHOW_EXPORT`, and they were
updated to the new data model rather than left pointing at dead field names, so
switching it on will not land on a broken field. Leave it off until it is
wanted.

**Projections.** Same shape: complete, hidden behind `SHOW_PROJECTIONS`, kept
working. Decide eventually whether it ships or gets deleted honestly, rather
than letting it rot.

**Overage reconciliation.** June and July 2026 both exceeded 100%. Clause 6.1
makes those hours a negotiated, quarterly-billed supplement. Whether they are
billed, absorbed, or applied against clause 4.1 rollover is a business decision
nobody has made. The report states the mechanism and takes no position, which is
the right place to sit until someone decides.

**Rollover in the denominator.** Ruled against: percentages run against the
contracted flat 50, because a denominator that moves month to month is one the
client cannot check against their own agreement. If revisited, the calculation
and its clause citation are together in `summaryHtml()`.

**The day view.** The API used to emit per-day buckets that nothing rendered.
They were removed with the SOW series. If a day view is ever wanted it needs
those buckets back, split by evidence class this time.

---

## The renewal window, and the conflict it creates

**Flagging this because it is dated and the rest of this roadmap is not.**

The agreement runs to February 2027. Renewal conversations open August 2026 and
close October 2026, which is now. Three pieces of work serve that conversation
and stop being useful in November:

- **Contract-year view.** The report shows calendar 2026; the agreement runs
  February 2025 to February 2027. The renewal conversation happens in contract
  years. This is more than a relabel: `allowanceMonths()` counts elapsed
  calendar months and would need to count from February 2025.
- **Forfeiture countdown.** Clause 4.2 forfeits unused hours at end of term.
  Clause 4.3 says the client agrees to proactively use their hours to ensure
  maximum value. A countdown of remaining contracted hours is legitimate,
  client-favourable, and the most useful thing this report could say during a
  renewal window. Frame it as 4.3 intends, not as a warning.
- **Appendix A benchmarking.** The SLA publishes an Hourly Cost Estimate range
  for 22 service types. Mapping reconstructed line items to those types lets the
  report show that an estimate lands inside a range **Moss already signed**,
  which converts it from our judgement call into a contract-anchored figure. The
  hard part is the task-to-service-type mapping, probably hand-maintained in the
  same spirit as `data/sows.json`.

**The conflict.** Sprints 1 through 4 are a substantial UX and design-system
programme, and they compete with the renewal work for the same weeks. If these
reports are going in front of Moss during the renewal window, the renewal
features are worth more than component standardization, and the standardization
should follow rather than precede them. If go-live is after October, the order
in this document is right.

That is a call for Josh, and it needs making before Sprint 1 starts rather than
discovered in week three.

---

## Working on this

```bash
npm run dev        # static server + fixtures, no ClickUp token
npm run check      # everything, before every commit
npm run fixtures   # regenerate fixtures after changing their specs
npm run test:api   # api/time.js against a stubbed ClickUp
npm run sows       # data/sows.json
```

Things that have cost somebody time here:

- **Fixtures are generated.** Edit `scripts/build-fixtures.mjs`, rerun, commit
  both. Hand-editing a fixture is how you get a page that lies in local preview
  and then passes review.
- **`scripts/test-api.mjs` is worth reading before touching `api/time.js`.**
  Every case in it is a defect this report has actually shipped.
- **Chart.js and the brand tokens come from CDNs.** Vendoring local copies to
  work offline is fine and committing that swap ships an unstyled, chartless
  report. `npm run check` catches it. If you need to screenshot the page from a
  sandboxed browser that cannot reach those CDNs, intercept the requests at the
  browser rather than changing the file.
- **Preview deployments are behind Vercel SSO,** and the share token rotates on
  every new deployment. Regenerate it rather than assuming the last one works.
- **The two hatches exist twice**, once as canvas patterns in `hatchPattern()`
  and once as `--hatch-*` custom properties for the DOM. Same for ghosting,
  which is `GHOST_A` on the chart and `.is-dim` in CSS. Change both halves. Any
  new mark that appears on both the canvas and the DOM inherits this problem,
  which is an argument for the component inventory in Sprint 1.
- **`vercel.json` uses `routes`,** which cannot be combined with `rewrites`,
  `redirects` or `headers`. Anything needing a redirect needs that conversion
  first. See open decision 1.

## Decisions log

### August 2026, the two-report rebuild

- One report becomes two, sourced separately. No code path connects Report B to
  time tracking.
- Logged versus reconstructed is encoded in one hue by pattern density. A second
  colour would say these are two different things; they are the same hours,
  differently evidenced.
- Percentages run against the contracted flat 50 (clause 3.1). Clause 4.1
  rollover is stated but not in the denominator.
- Over 100% renders in plain white with an `Overage` tag and a clause 6.1 note.
  It previously rendered in alarm red, which told the client something untrue
  about their own contract. **Revisit under the semantic colour system:** this
  is a case where a signal that is neither positive nor negative needed a
  treatment, and the new ramps should have an answer for it.
- A 50h allowance line was added to the chart. The rundoc assumed one existed;
  none did.
- The dynamic contributor roster, `roster.js` and its generator are cut, replaced
  by a hardcoded array. The old one put the client's view of their own team at
  the mercy of our timesheets.
- The holding page is scoped by hostname rather than applied to every request,
  so previews are reviewable while the client link stays hidden.
- Report B is cut by region, not department. Regions hold budget.
- Multi-region documents get a Multi-Region label at the data layer. Even
  distribution is a removable frontend experiment.

### August 2026, roadmap

- Export is backlogged rather than shipped or deleted.
- Report A gets a page per year rather than a year tab.
- The design system foundation precedes the visual sprints, so the consistency
  sweep is not done twice.
