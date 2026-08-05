# Moss reporting: roadmap

**Status:** the two-report rebuild is merged and deployed. Both reports are
hidden from the client behind the holding page. Nothing has been shown to Moss
yet.

**Last updated:** 5 August 2026, after PR #22.

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
are the first section below.

---

## Sprint 0: go live

Everything here blocks showing either report to Moss. Roughly in order.

### 1. Delete the fixture time entries

**This is the hard gate.** Task
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

Note the tag is `estimate`, not `estimated`. The connector cannot attach tags at
all, which is why the second row exists. No code change is needed for any of
this; check `?debug=1` for `classificationConflicts` if an entry ends up with
both.

### 3. Fill the two scaffolds

- **`SLA_DOCUMENT_URL`** in `index.html`, currently `''`. Host the signed
  agreement somewhere the client can open it and set the constant. While it is
  empty the footer renders as if the feature did not exist, which is deliberate:
  a link to nowhere is worse than no link.
- **`var TEAM`** in `index.html`, currently Josh alone with a TODO. Three fields
  per person, and a 160px square webp committed under `team/roster/`. A member
  whose image is missing renders as text rather than a broken tile, so you can
  add the entry before the artwork.

### 4. Take the holding page off

Delete the `routes` array from `vercel.json` and redeploy. That is the whole
switch.

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
  report name that no longer exists. One line, left alone because it is
  client-facing copy nobody asked to change.

---

## Sprint 1: the renewal frame

**Time-sensitive.** The agreement runs to February 2027, renewal conversations
open August 2026 and close October 2026. That is now. Everything in this sprint
serves that conversation, and it stops being useful in November.

### Contract-year view

The report shows calendar 2026. The agreement runs February 2025 to February
2027, so a contract-year view is the frame the renewal conversation actually
happens in. The year selector already exists and the loader, the API and the
pill rendering all take any year: `YEAR_OPTIONS` in `index.html` is the list,
currently holding the current year alone.

This is more than a relabel. `allowanceMonths()` counts elapsed calendar months
from the first tracked month, and a contract year needs it to count from
February 2025.

### Forfeiture countdown

Clause 4.2 forfeits unused hours at end of term, February 2027. Clause 4.3 says
the client agrees to proactively use their hours to ensure maximum value. Put
together, a countdown of remaining contracted hours is both legitimate and
squarely in the client's favour, and it is the single most useful thing this
report could say during a renewal window.

Frame it as clause 4.3 intends: the hours are theirs and there is a date after
which they are not. Not as a warning.

### Appendix A benchmarking

The strongest available upgrade to the reconstruction's defensibility, and the
biggest single piece of work on this list.

Appendix A of the SLA publishes an Hourly Cost Estimate range for 22 service
types, from 2 to 4 hours for social content design up to 20 to 30 hours for
interactive touchscreen applications. Mapping reconstructed line items to those
service types lets the report show that an estimated figure lands inside a range
**Moss already signed**. That converts an estimate from our judgement call into a
contract-anchored figure.

It needs a mapping from task to service type, which is the hard part and is
probably hand-maintained in the same spirit as `data/sows.json`.

---

## Sprint 2: Report B grows up

Report B currently carries one executed document and one in drafting. It is
correct and it is thin. It becomes genuinely useful at ten or fifteen documents
across several regions.

- **Backfill the executed SOWs.** Every signed document, into `data/sows.json`.
  `npm run sows` validates enum, attribution, and that each total equals the sum
  of its line items. Budget real time for this: it is contract data entry and
  every figure ends up in front of a regional lead.
- **Rule on the Multi-Region toggle.** It is experimental and was built to be
  deleted. Once there are real multi-region documents, look at it with actual
  data and decide. Keeping it costs nothing; removing it is cutting between the
  four `EXPERIMENTAL` marker pairs.
- **Consider a chart.** The region table is the right primary view, but at
  fifteen documents a shape would help. Whatever it is, it does not get the
  retainer green.

---

## Carried forward, not scheduled

Recorded so they are not lost. None of these should be built without a scope
decision first.

**Overage reconciliation.** June and July 2026 both exceeded 100%. Clause 6.1
makes those hours a negotiated, quarterly-billed supplement. Whether they are
billed, absorbed, or applied against clause 4.1 rollover is a business decision
nobody has made. The report currently states the mechanism and takes no position,
which is the right place to sit until someone decides.

**Rollover in the denominator.** Ruled against for now: percentages run against
the contracted flat 50, because a denominator that moves month to month is one
the client cannot check against their own agreement. If that is ever revisited,
the calculation and its clause citation are together in `summaryHtml()`, and the
definition block states both figures so the two are never confused.

**`SHOW_EXPORT` and `SHOW_PROJECTIONS`.** Both features are complete, hidden
behind a one-word switch, and kept working: the CSV builders and the projection
maths were updated to the new data model rather than left pointing at dead field
names. Decide whether either goes in front of the client, or delete them
honestly. Do not let them rot.

**The day view is gone.** The API used to emit per-day buckets that nothing
rendered. They were removed with the SOW series. If a day view is ever wanted,
it needs those buckets back, split by evidence class this time.

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
  every new deployment. Regenerate it rather than assuming the last one still
  works.
- **The two hatches exist twice**, once as canvas patterns in `hatchPattern()`
  and once as `--hatch-*` custom properties for the DOM. Same for ghosting,
  which is `GHOST_A` on the chart and `.is-dim` in CSS. Change both halves.

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
  about their own contract.
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
