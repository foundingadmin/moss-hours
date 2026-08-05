# Moss · Client Reporting

Two client-facing reports for Moss, on one tiny Vercel project.

**Working on this? Start here.** `npm run dev`, then open the fixture URL it
prints. No ClickUp token needed. `npm run check` before you commit. The
[Repo map](#repo-map) says which file holds what, and
[Local development](#local-development) covers the rest.

## Two reports, two sources

The most important thing to understand about this repo is that the two reports
**never share a data source**, and that this is architectural rather than a
filter.

| | **Report A** | **Report B** |
| --- | --- | --- |
| Page | `index.html` | `report-b.html` |
| Title | Fractional Creative Usage | Ad Hoc Creative Support |
| Source | ClickUp time entries, two retainer folders | `data/sows.json`, hand-maintained from signed documents |
| Unit | Hours against a monthly allowance | Days and dollars |
| Cut | Month, then task | Region, then document |

Report A covers the retainer: 50 agency hours a month, which is a thing Moss
bought and can hold us to. Report B covers work scoped, priced and signed one
project at a time.

These used to be one report with two series in one chart, in one unit. That
invited a comparison that was never valid: the second series was Founding
Creative's internal cost of goods, never priced and never a contract term, drawn
in the same unit as the hours Moss actually purchased.

**Report B contains no code path to ClickUp.** Not a disabled one, not a
filtered one: none. If it ever read a time entry, hours would be one flag away
from a client surface forever, and the separation would depend on nobody ever
flipping that flag. `npm run check` fails if the word appears in
`report-b.html` or `data/sows.json` at all.

## The pieces

- **`api/time.js`**: a serverless proxy that fetches ClickUp time entries for a
  given year from the two Moss retainer folders, buckets them by month, splits
  each hour into logged or reconstructed, and returns clean JSON (CORS enabled).
  Anything outside those two folders is discarded before it reaches a bucket.
- **`index.html`**: Report A. A self-contained, client-facing report (no build
  step) styled with the [Founding Creative brand system](https://brand.foundingcreative.com).
- **`report-b.html`**: Report B. Self-contained in the same way, reading
  `data/sows.json` and nothing else.
- **`data/sows.json`**: the committed index of signed statements of work.
  Hand-maintained, validated by `npm run sows`.
- **`construction.html`**: a self-contained holding page. While
  [under construction mode](#under-construction-mode) is on it is what the
  client-facing hostnames serve.
- **`assets/`**: the Founding Creative wordmark used in the masthead and the
  client wordmark used in each report title, vendored so neither report depends
  on a third-party host at render time.

## Repo map

`index.html` is one 2,700-line file, which is deliberate (no build step) and
does mean knowing where to look. Everything in it sits under a banner comment,
so the fastest way in is to grep for the banner rather than scroll.

| Looking for | Where |
| --- | --- |
| Colour and type tokens, badge geometry | `:root` at the top of the `<style>` |
| Data-integrity flags | `var DATA_FLAGS`, near the top of the `<script>` |
| Which years the selector offers | `var YEAR_OPTIONS`, `renderYears()` |
| What the retainer is, the terms, the clause numbers | `defsHtml()` |
| The static team block | `var TEAM`, `teamHtml()` |
| The note explaining the reconstruction | `reconNoteHtml()` |
| Hero panel, the headline total | `heroHtml()` |
| The rotating comparison lines | `var FUN_FACTS` |
| The three evidence classes and their labels | `var SERIES` |
| Chart colours, ghosting, flag outlines | `barColors()`, `fade()`, `GHOST_A` |
| The two reconstruction hatches | `hatchPattern()`, `--hatch-*` in `:root` |
| The 50 hour allowance line | `allowanceLine` |
| Chart construction, axes, tooltips | `drawChart()` |
| The key under the chart | `updateChartNote()` |
| Projection maths | `projectRest()` |
| Summary table and its month rows | `summaryHtml()` |
| A month's task detail drawer | `monthDetailHtml()`, `taskRows()` |
| The overage treatment and its clause note | `usePctHtml()`, `summaryHtml()` |
| The signed-agreement footer link | `SLA_DOCUMENT_URL`, `renderSlaLink()` |
| Chart and table dimming each other | `linkHover()`, `paintBars()` |
| The data-note modal | `openFlagModal()` |
| CSV builders and the export menu | `exportSummary()`, `wireExport()` |
| Freshness readout in the footer | `tickClock()` |

| Non-production file | What it is for |
| --- | --- |
| `fixtures/*.json` | Committed API payloads, so Report A runs with no token |
| `scripts/build-fixtures.mjs` | Regenerates those fixtures so their arithmetic holds |
| `scripts/serve.mjs` | Zero-dependency static server for those fixtures |
| `scripts/check.mjs` | The pre-commit checks, as one command |
| `scripts/test-api.mjs` | Runs `api/time.js` against a stubbed ClickUp |
| `scripts/validate-sows.js` | Validates `data/sows.json` |
| `scripts/clickup-oauth.js` | One-off minter for `MOSS_CLICKUP_TOKEN` |
| `_archive/` | The frozen v1 report. Inert, and excluded from every deploy |

## Report A: Fractional Creative Usage

Laid out high level → low level:

1. **Masthead**: the Founding Creative wordmark, on its own. Only the agency
   mark is chrome here, which is what makes the template reusable for another
   retainer client.
2. **Title**: the client wordmark, then the report title, then the range. The
   mark sits in a **square tile** carrying the same surface as the summary card
   below it, a gradient fill and a hairline, so the client's mark reads as a
   plate of the report's own material. One custom property (`--slot` on
   `.client-slot`) sizes the tile, and the mark is capped to a width that leaves
   it visibly square at every breakpoint.

   Inside the tile the mark is centred on its **cap band** rather than on its
   bounding box: measured from Moss's artwork, the caps run 1.15 to 138.2 inside
   a 245.976 artboard while the spear descends to 160.45, leaving 35% of the box
   empty below the mark, so centring the box floats the letters high. The shift
   is 21.7% of the rendered height. Doing it with a container rather than a
   per-logo baseline nudge is what survives swapping in a different client's
   artwork.

   There is no rule between the mark and the title. The tile already closes the
   mark off, and a divider beside it drew a second edge saying the same thing.
3. **Year to date**: retainer hours delivered, the range beneath it, a rotating
   comparison line in a labelled second column beside it, and underneath, the
   retainer defined. That is the one place the terms are stated, and every claim
   in it cites a numbered clause, because this report is read by people with no
   context and a stake in the outcome. The comparison line has arrows to step it
   by hand; interacting with the panel holds the auto-advance and lets go on the
   way out.
4. **Your team**: a hardcoded block of faces, names and titles. No hours, no
   percentages, no ordering by contribution, and no network call. See
   [The team block](#the-team-block).
5. **Monthly overview**: the chart and the table under one heading, because they
   are the same year drawn and then written out.

   The chart is a **stacked bar per month**, split into hours logged as they
   happened and hours reconstructed from records, with a dashed line at the 50h
   allowance. The legend carries three entries, each with its swatch **and its
   label in words**: the pattern is holding the entire honesty claim of this
   report, and a texture nobody has named is just a texture. It floats in the
   plot's top-right corner above 700px and returns to the flow above the chart
   below that, where the plot rotates and every month owns a full row. Hovering a
   legend entry ghosts the other two; clicking hides it.

   Then a **note** stating that January through May were rebuilt from records and
   what the two reconstruction classes mean. It sits between the chart and the
   table on purpose: a reader who has just seen striped bars asks what they are
   before they start reading figures, and an answer parked in a footnote arrives
   after they have already decided what to think.

   Then a per-month table, deliberately plain: no rules between rows, no tinted
   columns, no selected surface. Hierarchy is weight, colour, and one rule above
   the totals. Five columns: month, logged, reconstructed, total and allowance
   used. Every row expands in place into that month's task detail, one task per
   row with its own logged / reconstructed split drawn the same way the chart
   draws a month, and a permalink out to ClickUp. Nothing opens on arrival.

   **The open month is one surface.** The row and its drawer are two `<tr>`s and
   cannot be wrapped in a single element, so the outline is drawn in halves: top
   and sides on the row, sides and bottom on the drawer, with the join left
   open. Both carry the same background and the same radius on their outer
   corners, so the halves read as one plate. `border-collapse: separate` is what
   makes the radius possible, and is the only reason the table is not collapsed.
   The outline is the action colour, because "this is the month you opened" is
   interface state and the two series colours are spoken for.

   The task list ends with the month's own total, in the series colour and at the
   weight of the figures above it. The figure is the month's stored total rather
   than a fresh sum of the rows, so the drawer can never disagree with the row it
   hangs from. Under it, what the month came to against its allowance: the month
   row carries that percentage too, and it is repeated here because the reader
   has just finished going down the rows and this is where the question comes
   up.

### Chart and table are linked

Clicking a bar opens that month's row in the table and closes whichever was
open. The open month is then named in **both**: outlined in the table, and set
in the action colour on the chart's month axis.

**Dimming runs one way only.** Pointing at a month in the summary table dims
every other month in the table and in the chart above it. Pointing at a bar does
not dim anything. It used to do the same thing in reverse, which rearranged the
page under a reader who was only running the mouse across the plot; the tooltip
already answers what a bar is. Hovering a table row is a deliberate act on a
named month, so that direction stays.

Dimming is a **20% drop in opacity**, and only that. Everything ghosted keeps
its own colour and steps back one notch. It used to swap the bars for a flat
grey and take the table rows to 26%, which read as the page breaking rather than
as one month being singled out; 10% was then too slight to register at all, so
this sits between the two. `fade()` applies it to whatever a mark already is, so
there is one ghosting rule rather than a parallel palette to keep in step. The
CSS half of it, on the table rows, has to be kept in step with `GHOST_A` by
hand. Projected months are a separate treatment and do not ghost.

### Projections

**Projections are currently hidden.** `SHOW_PROJECTIONS` at the top of the
`<script>` is the only switch. With it off the chart stops at the last tracked
month, the textured ground, the boundary and the estimate band are never drawn,
and the key naming them is suppressed. `projectRest()` and every plugin below
are untouched, so switching it back on is one word.

What follows describes the feature as it behaves when shown.

The chart runs to December. Months after the last tracked one are estimated:

- The basis is the mean of the **completed** months that carry time. The month in
  progress is excluded, since it is still filling up and would drag the mean down.
- Where the previous year is available, each future month is then shaped by how
  that month compared with its own year's mean, which is what carries a seasonal
  pattern like a quiet August. The factor is clamped to 0.45–1.8, so one freak
  month last year cannot throw a forecast beyond anything ever observed.
- The previous year is fetched lazily, and the chart redraws if it arrives.

An estimate must never read as delivered hours in a client-facing report, so the
projected stretch sits on its own textured ground behind a hairline boundary, its
bars are hollow, its end labels and the total line drop back across it, and none
of it is counted in the legend's totals.

The key under the chart is a **definition of the texture and nothing more**:
"Estimated, not tracked time. Projected from how the year has run so far." It
once explained the whole method, the basis, the seasonal adjustment, the width
of the band and why the month in progress is excluded. All of it was true and
none of it was asked, and at the foot of a chart it read as a disclaimer, which
is the one thing an estimate in a client-facing report must not look like. The
method is still in `projectRest()` and still summarised in the tooltip on every
projected bar.

The diagonal texture now means exactly one thing in this report: projected. Do
not reuse it for anything else.

### Logged, documented, estimated

Report A's second dimension is not a second kind of work. It is how well each
hour is evidenced, which is a distinction **inside** the retainer rather than
between the retainer and something else.

| Class | Means |
| --- | --- |
| **Logged** | Tracked as the work happened |
| **Documented** | Reconstructed, and traceable to a record: an invoice, a calendar event, an email thread, a dated work log |
| **Estimated** | Reconstructed from the team's direct knowledge of the work, with no surviving record |

Documented and estimated together are **reconstructed**. January through May
2026 were not tracked as they happened and are being rebuilt from real sources;
from June 2026 forward everything is tracked to the minute.

Classification happens in `api/time.js`, per time entry, in a fixed order:
a ClickUp tag named `documented`, then a tag named `estimate` (note: not
`estimated`), then a `[RECON:DOC]` description prefix, then `[RECON:EST]`, then
logged. Two write paths need two levers, because the API connector used for bulk
writes cannot attach tags at all: it sends them as plain strings where ClickUp
expects objects, and the tagged write fails after the entry already exists.

**Absence means logged, deliberately.** None of the correctly logged hours have
to be touched, and a forgotten marker defaults to the truthful class rather than
inflating the reconstruction. An entry carrying both markers classifies as
documented and its id lands in `debug.classificationConflicts`, never silently
resolved.

The markers themselves never leave the function. `[RECON:EST]` on a client's
screen would teach them nothing, so descriptions are read by the classifier and
discarded. `npm run check` fails if the string reaches either report or a
fixture.

The sum of logged and reconstructed is **Total**. It is a per-row helper rather
than a headline: it renders only where both are non-zero, so January through May
show it and June onward does not, and that silence is the signal that nothing
needed adding.

**Colour is reserved, and the reconstruction does not get a colour.** Mint means
retainer hours, all three classes of them, and the classes are separated by
pattern density on that one green: denser where the evidence is stronger. A
second hue would have said these are two different things. The action colour is
the brand cyan and carries every interactive element (year selector, links,
focus rings, the open-row marker). Yellow is reserved for data integrity and is
never used for utilisation. The diagonal texture of the projection feature means
projected and nothing else, which is why the reconstruction hatches run at 45
degrees in the series green rather than reusing it.

The canvas patterns in `hatchPattern()` and the `--hatch-*` custom properties in
`:root` are the same two textures, one for the chart and one for the DOM. They
have to be changed together.

Percentages are always *used*, never *unused* or *remaining*.

### Allowance, pace and overage

The allowance is `50h × allowanceMonths()`. Those months are the ones the client
has **paid for**, not the ones that happen to carry tracked time: the retainer
accrues on the 1st whether or not anyone logs hours, so for the current year the
count runs from the first tracked month through the month we are in now. A quiet
August still adds 50h to the denominator.

Per-month pace is the `Allowance used` column, measured against the **contracted
50** (clause 3.1), flat, every month.

Clause 4.1 also rolls up to 10 unused hours into the following month, so a month
following an underused one genuinely has more than 50 available. Reporting
against that moving figure was considered and ruled against: a denominator that
changes month to month is one the reader cannot check against anything in their
own agreement. The definition block at the top of the report states both the
rollover and the basis, so the two are never read as the same number. If that
ruling is ever revisited, the calculation and its clause citation are together
in `summaryHtml()`.

The year-to-date row runs against the full accrued allowance, not against 50h.

**Over 100% is not an overrun and must not be dressed as one.** Clause 6.1 makes
hours beyond the allowance a negotiated supplement, billed quarterly, so an over
month is a contract mechanism working rather than a budget breach. It used to
render in alarm red, which told the client something untrue about their own
agreement. Over months now set the percentage in plain white, carry an
`Overage` tag, and the mechanism is stated once under the table, citing the
clause. The note renders only when there is an over month to explain.

The chart carries a dashed **50h allowance line** in neutral ink, in the vertical
layout only. Without it a reader has to count gridlines to find the one threshold
every figure on the page is measured against. It is neutral rather than a series
or status colour because the line is the contract, not a verdict on the bars that
cross it. In the rotated layout the hours are written at the end of each bar
instead, so a vertical rule through eight rows of labels would cost more than it
explains.

### Freshness

Responses are cached at Vercel's CDN, so an ordinary page load costs nothing at
ClickUp. `api/time.js` states its own window and the edge does the rest; there
is no database and nothing to provision.

| Request               | Window                                     |
| --------------------- | ------------------------------------------ |
| current year          | fresh 5 min, then stale-while-revalidate 1h |
| a past year           | fresh 24h, then stale-while-revalidate 7d   |
| `?fresh=1`, `?debug=1`| never cached, always a real round trip      |
| any error             | never cached                                |

Within the window a reader is served from the edge instantly. Past the window
the stale copy is still served instantly while a fresh one is fetched in the
background, so in practice only the first load after a quiet spell waits on
ClickUp. A past year cannot change, hence the much longer window.

The **refresh button** sends `?fresh=1`, which bypasses the cache entirely and
is the only thing in the UI that forces a live pull. Nothing cache-busts:
appending a unique parameter per load would make every load a unique cache key,
which is exactly what made every visit a fresh pull before.

`generatedAt` reports when the payload was pulled from ClickUp, **not** when the
request arrived. On a cached response those differ, which is the point: the
footer states the data's real age instead of claiming to be current.

The **footer** is one row: the agency on the left, how fresh the data is on the
right, and the refresh control. Both items are set the same way, 14px body face,
so they read as a matched pair closing the page; colour is what keeps the link
the more prominent of the two, since only one of them is a place to go. It is a
note on how fresh the data is, which is a closing remark rather than the first
thing on the page.

The readout states `generatedAt` and nothing else. It used to sit under a live
wall clock, which told the reader the time on their own machine, a moving part
answering a question nobody had. That clock was also why the readout was set in
monospace, since Manrope ships no tabular-figure feature (measured, its digits
run 7.47px to 8.00px wide) and a proportional ticking seconds field twitched the
whole line once a second. No ticking field, no reason, so it joins the rest of
the footer.

Because a cached payload can be genuinely old, the readout carries a date once
the data is not from today. "3d ago · 6:25 PM" states an hour on an unnamed day,
which is worse than saying nothing; "3d ago · Aug 1, 6:25 PM" is the same figure
made answerable. Relative age alone is refreshed on a 30-second interval, which
is as often as a string measured in minutes can change.

### Export

**The export control is currently hidden.** `SHOW_EXPORT` at the top of the
`<script>` is the only thing standing between the feature and the page. The CSV
builders, the menu wiring and the print stylesheet are all still here and still
correct, so bringing it back is one word.

When shown, the menu offers a year-summary CSV, a monthly-summary CSV, a
task-level line-item CSV (including the ClickUp URL and any data note for each
row), and Print / Save as PDF. The print stylesheet re-points the design tokens
to a light palette and re-themes the chart canvas via the `beforeprint` /
`afterprint` events. Print still works from the browser's own menu while the
control is hidden.

### Year selector

**Only the current year is offered.** `YEAR_OPTIONS` at the top of the
`<script>` is the list of years the pills render, and it currently holds
`CURRENT_YEAR` alone, so the prior-year tab is hidden. Nothing else was
changed: the loader, the API and the pill rendering all still take any year, so
bringing the tab back is putting `CURRENT_YEAR - 1` back in the list.

`?year=` still reaches a year the selector does not offer, and `renderYears()`
adds that year to the pills when it does, so the control never names a year the
report is not showing.

### Data-integrity annotations

`DATA_FLAGS` near the top of the `<script>` in `index.html` flags a
`(year, months, series)` slice as not fully trustworthy. **It is currently
empty, and the mechanism is kept.**

The one entry it held flagged Creative, January to May 2026 as under-reported,
with a note saying we were recovering the missing entries and would restate the
figures. That is exactly what the reconstruction encoding now does, in the chart
itself: those months are restated, and the stripes say which hours came from a
record rather than from a timer. Leaving the flag would have put a warning
triangle on precisely the months the chart already explains, attached to copy
that is no longer true.

The machinery stays because the next data problem will not be this one, and a
warn treatment that is already built and already checked is worth more than the
twenty lines it costs.

```js
var DATA_FLAGS = [
  {
    id: 'moss-2026-jan-may',
    year: 2026,
    months: [0, 1, 2, 3, 4],   // Jan-May, zero-indexed
    series: 'retainer',        // the only series the report draws
    label: 'Under-reported',
    detail: 'One sentence on why the figures are wrong, naming no months.'
  }
];
```

One entry drives every surface at once:

- a **warn-coloured outline** on that month's bar in the chart, drawn heavier
  than the hairline every other bar carries so it reads as deliberate
- a **warn triangle** on the canvas beside the bar's end label, in the rotated
  layout
- a note in the bar's tooltip
- a labelled tag at the top of the month's expanded detail, which opens the modal
- a `Data note` column in the CSV exports

The flag language is warn yellow, and only warn yellow. Flagged bars used to be
filled with a diagonal hatch, which is now spoken for twice over: once by the
projection texture and once by the reconstruction hatches.

`detail` **names no months and no dates.** The chart outlines the flagged months,
so a span written into the copy was a second copy of the same fact and one more
thing to keep in step with the `months` array above it.

`npm run check` will tell you if a flag names a month outside 0 to 11 or a series
the report does not draw.

## API

```
GET /api/time?year=2026
GET /api/time?year=2026&fresh=1   # bypass the cache, pull from ClickUp now
```

`fresh=1` is what the report's refresh button sends. See
[Freshness](#freshness) for the cache windows.

Response:

```json
{
  "year": 2026,
  "timezone": "America/Denver",
  "retainerBudget": 50,
  "generatedAt": "2026-08-04T12:41:00.000Z",
  "months": [
    {
      "month": 0,
      "hours": { "logged": 1.75, "documented": 9.6, "estimated": 11.4 },
      "reconstructed": 21,
      "total": 22.75,
      "items": [
        {
          "id": "86a1b2c3",
          "name": "Program Colour Palettes",
          "url": "https://app.clickup.com/t/86a1b2c3",
          "listId": "901143…",
          "hours": { "logged": 0, "documented": 6.5, "estimated": 0 },
          "reconstructed": 6.5,
          "total": 6.5
        }
      ]
    }
    /* …one entry per month, Jan→Dec */
  ],
  "totals": {
    "hours": { "logged": 133.17, "documented": 37.35, "estimated": 38.34 },
    "reconstructed": 75.69,
    "total": 208.86
  },
  "memberCount": 9,
  "totalEntries": 1732,
  "skippedEntries": 3
}
```

- `months[]` carries the per-month, per-task detail the report renders. `items`
  are sorted by total descending, and each one carries its own three-way split:
  a single task can hold logged and reconstructed time at once, which is exactly
  the case the report exists to show.
- Every figure is **already rounded** to two decimals, and a month's `hours` are
  the sum of the rounded items listed under it, so a month's rows always
  reconcile against its header exactly. The tradeoff is that a header can differ
  from the raw unrounded sum by a few hundredths; reconciliation is the property
  that matters to a client reading the table.
- `total` is `logged + documented + estimated` and `reconstructed` is
  `documented + estimated`, both derived from the rounded parts, so a reader who
  adds up the three figures on screen gets the total printed beside them.
- `url` is the task's permalink: `task_url` from the API when present, otherwise
  the stable `https://app.clickup.com/t/{task_id}` form. It can be `null`, and
  the report renders a disabled link icon in that case.
- `generatedAt` is when the payload was built server-side; the report surfaces it
  as "Data updated …".
- `retainerBudget` is the contracted monthly allowance in hours (clause 3.1),
  used for the `% used` figures.
- An item with `aggregated: true` is the rolled-up tail of short tasks; `count`
  is how many were folded in. The report renders it as
  "Additional retainer support (7 tasks)".
- `timezone` is the zone months were bucketed in, `memberCount` how many
  assignees the query covered, and `skippedEntries` how many entries were dropped
  for an unusable duration.
- **No entry `description` ever appears**, at any debug level. Descriptions carry
  the `[RECON:*]` markers, which are internal machinery.
- **No per-person anything appears.** No names, ids, usernames, initials, email
  addresses or avatars, at any debug level. Report A shows a static team block
  written into `index.html`; the API is not asked who worked what.
- `?debug=1` adds `debug`, which is deliberately narrow: assignee count, entry
  count, how many entries were discarded for falling outside the retainer
  folders, `classificationConflicts`, and one resolved sample entry. A raw
  ClickUp entry carries the logger's username and email, so nothing raw is
  echoed.
- `debug.discardedEntries` counts time outside the two retainer folders, which is
  every other client in the shared workspace plus any Moss work running under a
  separate signed agreement. It is a sanity check that the folder mapping is
  complete, and it is deliberately **not** shown in the report.

### The team block

Report A shows a **hardcoded** list of team members: `var TEAM` near
`teamHtml()` in `index.html`, three fields each (`name`, `title`, `image`).
Editing the team is editing that array.

It replaced a dynamic roster built from whichever ClickUp accounts had logged
time in a given month, resolved through a committed `roster.js` and a
fuzzy-matching generator script. All of that is gone: `roster.js`,
`scripts/generate-roster.js`, the per-month avatar stacks, the contributor
counts and the one-account-reporting alarm.

Two reasons, and the second is the real one.

ClickUp was authoritative for which user ids logged matched time, so the
client's view of who works on their account moved with our timesheets. A month
where one person forgot to log time showed the client a smaller team.

And a teammate can rename their ClickUp account or change their avatar at any
time with no notice. This report is live in front of a client, and a name they
have never heard is worse than a generic mark. The roster existed to stop
ClickUp-sourced identity reaching the page, which it did, at the cost of a
generator, a matching heuristic, an ignore list and a studio fallback. A
hardcoded array does the same job in six lines.

The API no longer returns `team`, `contributors` or `contributorIds` at all, so
there is nothing to leak.

Images live at `team/roster/<slug>.webp`, 160px square. Every tag carries
`loading="lazy"`, explicit width and height, and an `onerror` handler that hides
the tile rather than rendering the browser's broken-image glyph. The name and
title beside it stay, so a member can be added before their artwork is.

`team/stack/` still holds the 48px head crops the old avatar row used. Nothing
renders them now. They are left in place because the next surface that wants a
small face should not have to re-cut them.

**No hours, no percentages, no ordering by contribution** appear in this block.
Who is on the account is not a leaderboard.

### How entries are fetched

Three things about the fetch are load-bearing:

1. **`assignee` is always passed.** ClickUp's `/team/{id}/time_entries` silently
   scopes to the token holder unless `assignee` is supplied. Without it the
   report showed one person's hours and hid the rest of the team. Member IDs are
   resolved from `GET /team` rather than hardcoded, so staffing changes need no
   code change. The result is held at module scope for 10 minutes, so a warm
   function skips that round trip; only a successful lookup is cached, and a new
   hire appears within the window at worst.
2. **The year is walked one month at a time.** A single call is capped in how
   many entries it returns, and with every member included the payload is large
   enough to hit that cap and under-report silently. The twelve calls are issued
   **concurrently** and merged in month order, de-duplicated by entry id. They
   were sequential once, which meant twelve round trips end to end before the
   first byte and was the bulk of an uncached response. Merge order matters: an
   entry falling inside two overlapping boundary pads must be kept from the
   earlier window, as it was when this ran serially.
3. **Months resolve in `America/Denver`, not UTC.** Vercel runs in UTC, so
   late-evening work landed on the following day and anything near a month
   boundary landed in the wrong month. Each fetch window is padded by 48 hours on
   both sides and `denverYM()` decides which month an entry belongs to; anything
   resolving outside the requested year is discarded.

Entries with a negative or unparseable duration are skipped (a running timer
reports negative) and counted in `skippedEntries`.

### Line items and the aggregate row

Tasks are keyed on **ClickUp task id**, not name. This workspace has several
distinct tasks sharing a name, which keying on name merged into one row, and a
rename split a single task's history in two. Entries with no task at all are
grouped under one `(no task)` row.

`toItems()` keeps every task in the total. Anything under **0.25h** is rolled
into a single trailing row, `Additional retainer support`, carrying a `count`
and `aggregated: true`. The row is omitted when the sum is zero. This replaced
an earlier filter that dropped sub-0.005h tasks from the list while still
counting them in the total, so the rows could not sum to the header.

Hours accumulate raw and are rounded once on the way out. Rounding each entry as
it lands would drift a month's total away from the entries that make it up, a
hundredth at a time.

### The folder firewall

| Folder | ID |
| --- | --- |
| Moss Creative Retainer (Delivery) | `90114447278` |
| Moss Creative Retainer (Archive) | `90116369473` |

`RETAINER_FOLDER_IDS` in `api/time.js` is the **whole** firewall, and it is the
only place in the repo that names a folder. Any entry resolving outside those
two is discarded before it reaches a bucket, so it cannot arrive in a total by
some later route.

Everything else in that workspace is either another client or Moss work running
under a separate signed agreement, and clause 2.2.2 is why the second kind must
not appear here: work covered by another agreement is fulfilled under that
agreement and does not draw on the retainer.

**Widening that list is a contract decision, not a code change.** `npm run
check` fails if the array changes, and fails if either report names a folder id
at all.

Each entry's folder is read from `task_location.folder_id`, the canonical field
in ClickUp's v2 `/team/{id}/time_entries` response, with defensive fallbacks for
other shapes. Note that the MCP connector returns this field as `null` while the
raw API populates it. That has been investigated and is a non-issue. Do not
re-investigate it.

### Confirming the field mapping against live data

If buckets ever look empty, or permalinks come back `null`, dump a raw entry
from production:

```
GET /api/time?year=2026&debug=1
```

This returns the first raw ClickUp entry plus the folder ID, task URL and
Denver month resolved from it, along with the member IDs the query covered, so
you can verify the mapping without redeploying. If `memberCount` is 1, the
`assignee` fix is not reaching ClickUp.

## Report B: Ad Hoc Creative Support

A separate page, a separate source, and no line of code between them.

### Days and dollars, never hours

Both are contract terms. Both already appear in every signed statement of work,
in Moss's own possession, which means every figure on the page can be checked
against a piece of paper they already hold. Nothing here is derived from time
tracking, so there is no unit to convert and no conversion to argue about.

`npm run check` fails if `report-b.html` or `data/sows.json` contains the word
in any form, including in a comment. That is blunt on purpose: this is the kind
of separation that erodes one reasonable-looking exception at a time.

### The data model

`data/sows.json` is hand-maintained and updated when a document is executed, not
continuously. Two top-level keys, `regions` and `sows`.

Regions are the primary cut, **not departments**. Departments are org chart;
regions hold budget. A report organised by who pays maps to how decisions
actually get made, and is useful to the regional leads rather than only to the
main contact. Energy is not a geography, but Moss treats it as a business unit
in the same way it treats a region, so it lives in the same enum.

| Value | Label |
| --- | --- |
| `mid-florida` | Mid-Florida |
| `south-florida` | South Florida |
| `dfw` | Dallas Fort Worth |
| `hawaii` | Hawaii |
| `energy` | Energy |
| `nashville` | Nashville |
| `corporate` | Corporate |
| `multi-region` | Multi-Region |

Attribution: a document serving one named region takes that region, and
`regions` lists it alone. A document serving two or more takes
`region: "multi-region"` and lists every member in `regions`. Org-wide or
head-office work takes `corporate`.

`npm run sows` checks all of it, and is run as part of `npm run check`: the
region enum, the attribution rules above, that `totalDays` equals the sum of its
line items to two decimals, that `totalPrice` equals theirs exactly, that a
document in drafting carries no figures, and that the banned unit appears
nowhere.

### The scaffolded state

Nashville has a document in drafting. It appears in the data with
`status: "drafting"` and no figures, and its region definition carries
`scaffolded: true`.

On the page it renders at its defined position, never hidden and never sorted to
the bottom, at reduced opacity with a dashed border, an inline `SOW in drafting`
tag, and a **skeleton bar** where each figure will go. It contributes nothing to
any total.

The skeleton is the point. A zero would say "this region bought nothing", which
is the opposite of true, and the visual state has to carry that without a
caption explaining it. Sorting it to the bottom or hiding it would turn "we have
planned for this" into "we have forgotten this".

### The Multi-Region distribution toggle

**Experimental, and built to be deleted.** Off by default. When on, every
multi-region document has its days and price divided evenly across the regions
it names, and those fractions are added to each member region's row.

It is a pure function of the parsed data. It never mutates the source and never
writes back, and the whole view is re-derived from the file on every toggle, so
a round trip through the switch lands on exactly the figures it started from.
The grand total is computed from the executed documents directly rather than by
adding the region rows up, so distribution cannot change what they come to.

Rounding is integer throughout, hundredths of a day and whole cents, with any
remainder assigned to the first region named. An even split of 3.75 days across
three regions is 1.25 each only by luck; $4,501.03 across three is not, and the
arithmetic has to be exact rather than usually exact.

Removal is cutting between the four `EXPERIMENTAL: MULTI-REGION DISTRIBUTION
START` / `END` marker pairs. Nothing else is touched, and the page still works.
`npm run check` fails if the markers stop being balanced.

## Deploy (Vercel)

1. Set the ClickUp token as an environment variable (never hardcoded):

   ```bash
   vercel env add MOSS_CLICKUP_TOKEN
   # paste the token when prompted (Production + Preview), and mark it Sensitive
   ```

   See [Minting the token](#minting-the-token) for where that value comes from.
   Environment variables only apply to **new** deployments, so redeploy after
   adding it.

2. Deploy:

   ```bash
   vercel deploy --prod
   ```

The report calls the API at the same origin (`/api/time`), so once deployed it
works without further configuration. To point it at a different API, append
`?api=https://your-deploy.vercel.app/api/time`.

### Under construction mode

**Both reports are currently hidden from the client, and preview deployments
still serve them in full.**

`vercel.json` routes every request to `construction.html`, but only for the
hostnames a client could actually land on:

- `moss.foundingcreative.com`, the link the client has
- `moss-hours.vercel.app`
- `moss-hours-foundingadmins-projects.vercel.app`
- `moss-hours-git-main-foundingadmins-projects.vercel.app`

Every other hostname falls through to the filesystem, which means a preview
deployment serves the real `index.html`, the real `report-b.html` and a working
`/api/time`. That is the point: work in progress can be reviewed on a real
deployment without anything reaching the client's URL. `/assets` is exempt
everywhere, because the holding page wears the same wordmark as the reports.

To go live, delete the `routes` array and redeploy. That is the whole switch.
`construction.html` stays where it is, costing nothing and ready for the next
time.

**This scoping fails open.** A hostname missing from that list is a hostname
serving the report to whoever visits it, so `npm run check` treats a missing
host as a hard failure rather than a warning, and warns separately for as long
as the mode is on at all. If a domain is ever added to the project, add it there
too.

Three things about it are worth knowing before changing any of it:

1. **`routes`, not `rewrites`.** A `rewrites` entry is only consulted once the
   filesystem has been checked, so a catch-all rewrite cannot shadow a file that
   exists and `index.html` would still answer at `/`. `routes` is the older,
   lower-level property, matched in order and *before* the filesystem, which is
   what makes hiding a deployed file possible at all. It cannot be combined with
   `rewrites`, `redirects` or `headers` in the same config, and there are none
   here. The `has` conditions are what scope it per hostname.
2. **The holding page is served `no-store`**, so no one is left looking at a
   cached copy of it after the routes come off.
3. **The response is a plain 200.** A 503 is the honest status for a maintenance
   page and is what an uptime monitor wants to see, but this URL is a private
   link shared with one client rather than something crawled, so the page
   carries `noindex` and leaves the status alone.

`npm run dev` is unaffected. The static server knows nothing about `vercel.json`,
so both reports open against the fixtures while the deployed site is hidden.
Open `/construction.html` there to preview the holding page itself.

### Traffic (Vercel Web Analytics)

`index.html` loads `/_vercel/insights/script.js` just before `</body>`. That is
the whole integration: there is no build step here, so the `@vercel/analytics`
package and its `<Analytics />` component do not apply, and the script tag from
Vercel's [HTML quickstart](https://vercel.com/docs/analytics/quickstart?framework=html)
is the supported path for a static site.

The tag alone collects nothing. Web Analytics has to be switched on for the
project once, either in the Vercel dashboard under **Analytics** or with:

```bash
vercel project web-analytics moss-hours
```

Vercel serves that script path itself, so the request 404s under `npm run dev`
and reports nothing for preview URLs opened outside the deployment. Only
production traffic lands in the dashboard.

It records pageviews, not custom events, and the report sends nothing of its
own. Worth knowing before turning it on: this URL is shared with the client, so
the numbers are the client reading their own report.

## Local development

Most work here is layout and copy, which needs no ClickUp token and no network
round trip. Use the committed fixtures:

```bash
npm run dev      # zero-dependency static server, prints the fixture URLs
```

```
index.html?api=./fixtures/2026-typical.json&year=2026
index.html?api=./fixtures/2026-edge.json&year=2026
report-b.html
```

| Fixture | What it is for |
| --- | --- |
| `2026-typical` | Mid-year. Eight tracked months, five reconstructed and three logged live, two months over the allowance, an aggregated tail row, a task with no permalink. Reach for this one by default. |
| `2026-edge` | The states real data rarely reaches. No permalinks anywhere, a month that is entirely estimated, a zero month sitting inside the tracked range rather than after it, and a single task carrying all three classes at once. |

Report B needs no fixture: `data/sows.json` is committed and is the real thing.
Point it at another file with `report-b.html?data=./some-other.json`.

The fixtures are the API contract written down, and the contract now includes
arithmetic: a month's `hours` must be the sum of the rounded items listed under
it, and its `total` the sum of its three classes. Hand-maintaining that across
two files was a standing invitation to commit a fixture whose drawer disagreed
with its own row, which is the exact defect the report exists to make
impossible.

So they are **generated**:

```bash
npm run fixtures      # rebuilds both from the specs in scripts/build-fixtures.mjs
```

Edit the spec, rerun, commit both. `npm run check` verifies the arithmetic
independently, so a hand-edited fixture that has drifted still fails.

`npm run dev:api` (`vercel dev`) is for work that actually touches
`api/time.js`. The static server answers `/api/time` with a 501 and a pointer to
the fixtures, so a forgotten `?api=` fails loudly rather than looking like a
broken API. It serves everything `no-store`, so it never stands in for the edge
cache described under [Freshness](#freshness); testing cache windows means
`vercel dev` or a preview deployment.

**Chart.js and the brand tokens load from CDNs**, so an offline or
network-restricted machine renders an unstyled page with no chart. Vendoring
local copies to get around that is fine while you work and a disaster to commit:
`npm run check` fails if `index.html` has stopped pointing at either CDN.

### Before committing

```bash
npm run check
```

One command, and it runs everything:

| Check | Catches |
| --- | --- |
| Em dashes | A standing house rule, see `CLAUDE.md` |
| CDN URLs intact | A local Chart.js or tokens copy left in place, which ships an unstyled, chartless report |
| `RETAINER_FOLDER_IDS` unchanged | Work under a separate signed agreement reaching the client's retainer report |
| No folder id in either report | Folder scoping leaking out of `api/time.js` |
| No hours in Report B | The one unit that must never appear there |
| No ClickUp reference in Report B | The separation becoming a filter rather than an architecture |
| `data/sows.json` valid | Runs `npm run sows`: enum, attribution, arithmetic |
| `EXPERIMENTAL` markers balanced | The distribution toggle becoming un-removable |
| Fixtures parse, carry 12 months, reconcile | A fixture that lies in local preview and then passes review |
| No `[RECON:` anywhere client-facing | Internal machinery reaching a client's screen |
| `DATA_FLAGS` well-formed | A flag that silently flags nothing |
| `api/time.js` behaviour | Runs `npm run test:api` against a stubbed ClickUp |
| Under-construction hosts covered | A hostname quietly serving the live report |

The two sub-suites can also be run alone:

```bash
npm run test:api      # api/time.js against a stubbed ClickUp, no token needed
npm run sows          # data/sows.json
```

`scripts/test-api.mjs` is worth reading before changing `api/time.js`. Every
case in it is a defect this report has actually shipped or an acceptance
criterion the rebuild had to hold: work from a folder the client must never see,
a running timer counted as negative work, late-evening work landing in the wrong
month, two distinct tasks sharing a name merging into one row, and a
reconstruction marker reaching the client surface.

## Minting the token

ClickUp issues exactly **one personal token per user account**, so every project
built against that account shares a key that cannot be rotated or revoked
independently. This project uses its own OAuth app instead. The client ID and
secret are not themselves a credential: they are what you exchange, once, for an
access token. That token uses the same raw `Authorization: {token}` header as a
personal token and (per ClickUp's docs) does not expire, so nothing in
`api/time.js` knows the difference.

What you gain is a credential scoped to the workspaces approved during
authorization, revocable on its own without touching anything else. A second
project gets a second app.

1. ClickUp: **Settings → Apps → Create an App**. Name it, and set the redirect
   URL to the deployed report URL. That URL is only used during the handshake
   and does not need to resolve to a working page, but it must match exactly.
2. Run the helper from the repository root:

   ```bash
   node scripts/clickup-oauth.js <client_id> https://your-report.vercel.app
   ```

   It prompts for the secret without echoing it, prints an authorize link, takes
   the `?code=…` you are redirected with, and exchanges it. It then verifies the
   token against `GET /team` and lists the workspaces it can actually see: a
   token authorized against the wrong workspace succeeds at the handshake and
   only shows up later as an empty report.
3. `vercel env add MOSS_CLICKUP_TOKEN`, then redeploy.
4. Once the report is confirmed working, remove `CLICKUP_TOKEN` from **this**
   project. Other projects still use it.

The authorization code is single-use and expires within minutes. If the exchange
fails, start again from the authorize link.

## Environment

| Variable             | Required | Description                                                                 |
| -------------------- | -------- | --------------------------------------------------------------------------- |
| `MOSS_CLICKUP_TOKEN` | yes      | Token for this project's ClickUp OAuth app. See [Minting the token](#minting-the-token). |
| `CLICKUP_TOKEN`      | no       | Deprecated fallback: the shared personal token (`pk_…`). Used only when `MOSS_CLICKUP_TOKEN` is unset, so a deploy cannot land before the new variable is set. Remove once migrated. |
