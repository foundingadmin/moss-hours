# Moss · Client Hours

A tiny Vercel project that surfaces Moss client hours from ClickUp.

**Working on this? Start here.** `npm run dev`, then open the fixture URL it
prints. No ClickUp token needed. `npm run check` before you commit. The
[Repo map](#repo-map) says which file holds what, and
[Local development](#local-development) covers the rest.

## The pieces

- **`api/time.js`**: a serverless proxy that fetches ClickUp time entries for a
  given year, buckets them by month across the Creative (retainer) and
  Non-Creative (SOW) folders, with a per-task breakdown, including each task's
  ClickUp permalink, and returns clean JSON (CORS enabled).
- **`index.html`**: a self-contained, client-facing hours **report** (no build
  step) styled with the [Founding Creative brand system](https://brand.foundingcreative.com).
- **`construction.html`**: a self-contained holding page. While
  [under construction mode](#under-construction-mode) is on it is the only thing
  the deployed site serves.
- **`assets/`**: the Founding Creative wordmark used in the masthead and the
  client wordmark used in the report title, vendored so the report never depends
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
| What Creative and Other mean, retainer terms | `defsHtml()` |
| Hero panel, the headline total | `heroHtml()` |
| The rotating comparison lines | `var FUN_FACTS` |
| Chart colours, ghosting, flag outlines | `barColors()`, `fade()`, `GHOST_A` |
| Chart construction, axes, tooltips | `drawChart()` |
| The key under the chart | `updateChartNote()` |
| Projection maths | `projectRest()` |
| Summary table and its month rows | `summaryHtml()` |
| A month's task detail drawer | `monthDetailHtml()`, `taskRows()` |
| Chart and table dimming each other | `linkHover()`, `paintBars()` |
| The data-note modal | `openFlagModal()` |
| CSV builders and the export menu | `exportSummary()`, `wireExport()` |
| Freshness readout in the footer | `tickClock()` |

| Non-production file | What it is for |
| --- | --- |
| `fixtures/*.json` | Committed API payloads, so the report runs with no token |
| `scripts/serve.mjs` | Zero-dependency static server for those fixtures |
| `scripts/check.mjs` | The pre-commit checks, as one command |
| `scripts/generate-roster.js` | One-off ClickUp to `roster.js` generator |
| `scripts/clickup-oauth.js` | One-off minter for `MOSS_CLICKUP_TOKEN` |

## The report

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
3. **Year to date**: total hours delivered, the range beneath it, a rotating
   comparison line in a labelled second column beside it, and underneath, the
   two categories named and explained. That is the one place the retainer terms
   are stated. The comparison line has arrows to step it by hand; interacting
   with the panel holds the auto-advance and lets go on the way out.
4. **Monthly overview**: the chart and the table under one heading, because they
   are the same year drawn and then written out.

   The chart shows the **whole year**, with the months that have not happened yet
   projected (see below). The legend floats in the plot's top-right corner above
   700px and returns to the flow above the chart below that, where the plot
   rotates and every month owns a full row. Hovering a legend entry ghosts every
   other series; clicking hides it. The `Combined` entry is a key, not a
   control.

   Then a per-month table, deliberately plain: no rules between rows, no tinted
   columns, no selected surface. Hierarchy is weight, colour, and one rule above
   the totals. Every row expands in place into that month's task detail, with the
   two categories side by side above 860px, one task per row with a permalink out
   to ClickUp, and the people who worked the month. Nothing opens on arrival.

   **The open month is one surface.** The row and its drawer are two `<tr>`s and
   cannot be wrapped in a single element, so the outline is drawn in halves: top
   and sides on the row, sides and bottom on the drawer, with the join left
   open. Both carry the same background and the same radius on their outer
   corners, so the halves read as one plate. `border-collapse: separate` is what
   makes the radius possible, and is the only reason the table is not collapsed.
   The outline is the action colour, because "this is the month you opened" is
   interface state and the two series colours are spoken for.

   Each task list ends with that category's own total, in the series colour and
   at the weight of the figures above it. The figure is the month's stored total
   rather than a fresh sum of the rows, so the drawer can never disagree with
   the row it hangs from. Creative adds a line stating what the month came to
   against its allowance: the month row carries that percentage too, and it is
   repeated here because the reader has just finished going down the Creative
   rows and this is where the question comes up.

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

### Categories

The sum of the two is **Combined**, everywhere a reader can see it: the headline
eyebrow, the chart legend's third entry, the summary table's last column, and
the chart tooltip. It used to be "Total", which had to do double duty for the
sum of the two categories and for the sum down a column of months, so a reader
meeting "Total" twice in one table was reading two different things. "Total"
still names a single category's own sum, at the foot of each task list in an
open month, where there is nothing to confuse it with.

The report uses two terms throughout, mapped from the ClickUp folder structure:

| Term             | Means                                                   |
| ---------------- | ------------------------------------------------------- |
| **Creative**     | Retainer work, drawn against the monthly retainer budget |
| **Non-Creative** | Separately scoped project work (SOW), outside the retainer |

Percentages are always *used*, never *unused* or *remaining*.

**Colour is reserved.** Mint means Creative and lavender means Other, everywhere,
so neither can be used for interface state: an affordance wearing a series colour
reads as data. The action colour is the brand cyan, and it carries every
interactive element (year selector, links, focus rings, the open-row marker).
Selected surfaces use a cool grey ramp. Yellow is reserved for data integrity and
is never used for utilisation.

### Retainer allowance and pace

The Creative allowance is `50h × allowanceMonths()`. Those months are the ones
the client has **paid for**, not the ones that happen to carry tracked time: the
retainer accrues on the 1st whether or not anyone logs hours, so for the current
year the count runs from the first tracked month through the month we are in
now. A quiet August still adds 50h to the denominator.

Per-month pace lives in the summary table, as the percentage beside each
month's Creative figure. The monthly budget it measures against is stated once,
in the Creative definition at the top of the report, rather than repeated in
every cell. The year-to-date row runs against the full accrued allowance, not
against 50h.

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

Months whose data is known to be wrong are flagged through a single config
array near the top of the `<script>` in `index.html`:

```js
var DATA_FLAGS = [
  {
    id: 'moss-2026-creative-jan-may',
    year: 2026,
    months: [0, 1, 2, 3, 4],   // Jan–May, zero-indexed
    series: 'creative',        // 'creative' | 'nonCreative'
    label: 'Under-reported',
    detail: 'Some Creative time was not fully captured in our time tracking, …'
  }
];
```

One entry drives every surface at once:

- a **warn-coloured outline** on that month's bar in the chart, drawn heavier
  than the hairline every other bar carries so it reads as deliberate
- a **warn triangle** on the canvas beside the bar's end label, in the rotated
  layout
- a **warn triangle** to the left of that month's Creative figure in the summary
  table, so the flagged months are findable without opening a row
- a note in the bar's tooltip
- a labelled tag beside the **Creative** heading in the month's expanded detail,
  which opens the modal
- a `Data note` column in both CSV exports

The flag language is warn yellow, and only warn yellow. Flagged bars used to be
filled with a diagonal hatch, which made those months read as a different kind
of measurement rather than as the same hours with a note attached, and collided
with the texture the projections use. The modal was lined with the same diagonal
for the same reason, and lost it for the same reason.

The flag sits with the series it applies to rather than with the month, since
under-reporting never applied to the non-Creative side.

`detail` **names no months and no dates.** The chart outlines the flagged months
and the table marks them, so a span written into the copy was a third copy of
the same fact and one more thing to keep in step with the `months` array above
it. The copy explains why the figures are low, and nothing else.

**Delete the entry once the underlying data is repaired.** Nothing else needs
to change. `npm run check` will tell you if a flag names a month outside 0 to 11
or a series the report does not draw.

The currently shipped flag covers **Creative, Jan–May 2026**, where time was not
fully captured and real usage is understated.

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
  "retainerBudget": 50,
  "generatedAt": "2026-07-30T12:41:00.000Z",
  "months": [
    {
      "month": 0,
      "retainerHours": 7.83,
      "sowHours": 10.93,
      "retainerItems": [
        {
          "id": "86a1b2c3",
          "name": "Program Color Palettes",
          "hours": 2.68,
          "url": "https://app.clickup.com/t/86a1b2c3",
          "listId": "901143…"
        }
      ],
      "sowItems": [{ "name": "Moss Brochure Template", "hours": 4.25 }]
    }
    /* …one entry per month, Jan→Dec */
  ],
  "retainer": [/* 12 monthly hour totals, Jan→Dec (convenience) */],
  "sow":      [/* 12 monthly hour totals, Jan→Dec (convenience) */],
  "totalEntries": 1732,
  "unmatchedEntries": 1321,
  "unmatchedHours": 13039.54
}
```

- `months[]` carries the per-month, per-task detail the report renders.
  `retainerItems` / `sowItems` are summed per task and sorted descending.
  Tasks are keyed by ClickUp task id where available (so a renamed task stays a
  single line item) and fall back to the task name.
- `url` is the task's ClickUp permalink: `task_url` from the API when present,
  otherwise the stable `https://app.clickup.com/t/{task_id}` form. It can be
  `null`, and the report renders a disabled link icon in that case.
- `generatedAt` is when the payload was built server-side; the report surfaces
  it as "Data updated …".
- `retainerBudget` is the assumed monthly retainer budget (hours) used for the
  `% used` figures.
- An item with `aggregated: true` is the rolled-up tail of short tasks; `count`
  is how many were folded in. The report renders it as
  "Other retainer support (13 tasks)".
- `timezone` is the zone months were bucketed in, `memberCount` how many
  assignees the query covered, and `skippedEntries` how many entries were
  dropped for an unusable duration.
- `contributors.queried` is how many assignees the time-entries call covered;
  `contributors.contributing` is how many actually logged matched time.
  `contributing === 1` while `queried > 1` is the regression that hid the team
  for five months, and the report renders that state as visibly broken.
- `team[]` is one entry per contributing person, resolved through `roster.js`,
  plus at most one collapsed studio entry. `months[].contributorIds` carries ids
  only. No per-person hours or email addresses appear anywhere, including
  `?debug=1`.
- `?debug=1` adds `debug.unrosteredContributorIds` and `debug.rosterCoverage`,
  which is how you learn somebody needs adding to the roster.
- `unmatchedEntries` / `unmatchedHours` count time outside the four tracked
  folders (i.e. other clients in the shared workspace), a sanity check that the
  folder mapping is complete. It is deliberately **not** shown in the report,
  which is Moss-only.

### Team roster

`roster.js` maps ClickUp user id to the name, title and images shown for a
person. It is **generated** by `scripts/generate-roster.js`, hand-edited for
titles, then committed and reviewed like any other source file.

```bash
MOSS_CLICKUP_TOKEN=... npm run roster
```

ClickUp is authoritative for exactly one thing: **which user ids logged matched
time**. Names, titles and images come only from `roster.js`. Nothing
ClickUp-sourced (display name, username, avatar, initials, email) ever reaches
the client. A teammate can rename their account or change their avatar at any
time with no notice, and this report is live in front of a client, so a wrong
face is worse than a generic mark.

That is also why discovery is a one-off script and never happens at request
time. The generator auto-accepts only exact matches; anything looser is reported
as an error for a human to resolve rather than guessed at. `IGNORE_SLUGS` at the
top of the script holds images that will never match a ClickUp account.

Contributors with no roster entry collapse into a **single** studio entry
(`Founding Creative`), however many of them there are. Their real ids stay in
each month's `contributorIds` so counts remain accurate, but the frontend
resolves them all to one avatar.

`active: false` keeps a departed teammate resolving correctly for past years
while dropping them from the current year's contributors.

Images live at `team/roster/<slug>.webp` (160px source) and
`team/stack/<slug>.webp` (48px head crop). The report renders only the stack
crop, in the avatar row inside each month's expanded detail, where the name and
job title appear in a rendered tooltip below the face. The browser's own `title`
attribute is deliberately not used: it waits about a second, styles itself, and
never fires on touch. Never use a roster image there: it is four times the
weight and the face is unreadable at that size. The API still returns both, so
a future surface can use the larger one.

The studio mark is deliberately never rendered as an avatar. Among faces it read
as a person nobody could name, so unrostered contributors are simply not shown
and an avatar whose file fails to load is dropped rather than replaced with it.

`blake`, `diggy` and `stacey` have images but no matching ClickUp account, so
they are stored but unreferenced. The generator reports them rather than
guessing; wire them up by adding a roster entry once the right user id is known.

The roster is **agency-wide, not per-client**: the report already filters to
users who logged time against the configured folders, so one roster serves every
client this app is pointed at. A per-client fork should **regenerate**
`roster.js` rather than copy it, so a stale roster does not follow the fork.

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
into a single trailing row, `Other retainer support` or `Other project support`,
carrying a `count` and `aggregated: true`. The row is omitted when the sum is
zero. This replaced an earlier filter that dropped sub-0.005h tasks from the
list while still counting them in the total, so the rows could not sum to the
header.

`retainerHours` / `sowHours` are derived from the emitted items, so a month's
rows always reconcile against its header exactly. The tradeoff is that the
header can differ from the raw unrounded sum by a few hundredths of an hour;
reconciliation is the property that matters to a client reading the table.

### Folder mapping

| Bucket           | Folder              | ID            |
| ---------------- | ------------------- | ------------- |
| Creative         | Retainer (Active)   | `90114447278` |
| Creative         | Retainer (Archive)  | `90116369473` |
| Non-Creative     | SOW (Active)        | `90117343728` |
| Non-Creative     | SOW (Archive)       | `90117412643` |

Each entry's folder is read from `task_location.folder_id` (the canonical field
in ClickUp's v2 `/team/{id}/time_entries` response), with defensive fallbacks
for other shapes.

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

**The report is currently hidden.** `vercel.json` routes every request to
`construction.html`, so a visitor gets the holding page and nothing else: not
the report, not `/api/time`, not a fixture. `/assets` is the single exception,
because the holding page wears the same wordmark as the report.

To put the report back, delete the `routes` array from `vercel.json` and
redeploy. That is the whole switch. `construction.html` stays where it is,
costing nothing and ready for the next time.

Three things about it are worth knowing before changing any of it:

1. **`routes`, not `rewrites`.** A `rewrites` entry is only consulted once the
   filesystem has been checked, so a catch-all rewrite cannot shadow a file that
   exists and `index.html` would still answer at `/`. `routes` is the older,
   lower-level property, matched in order and *before* the filesystem, which is
   what makes hiding a deployed file possible at all. It cannot be combined with
   `rewrites`, `redirects` or `headers` in the same config, and there are none
   here.
2. **The holding page is served `no-store`**, so no one is left looking at a
   cached copy of it after the routes come off.
3. **The response is a plain 200.** A 503 is the honest status for a maintenance
   page and is what an uptime monitor wants to see, but this URL is a private
   link shared with one client rather than something crawled, so the page
   carries `noindex` and leaves the status alone.

`npm run dev` is unaffected. The static server knows nothing about
`vercel.json`, so the report still opens against the fixtures while the deployed
site is hidden, which is the point: this mode exists to cover work in progress.
Open `/construction.html` there to preview the holding page itself.

`npm run check` warns for as long as the routes are in place, so the switch
cannot be left on unnoticed.

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
```

| Fixture | What it is for |
| --- | --- |
| `2026-typical` | Mid-year. Eight tracked months, four projected, the data flag live, an aggregated tail row, a task with no permalink. Reach for this one by default. |
| `2026-edge` | The states real data rarely reaches. The one-account-reporting alarm, a single tracked month, an empty category on each side, no permalinks anywhere, and a contributor id missing from the roster. |

The fixtures are the API contract written down. Changing the shape of
`api/time.js`'s response means changing them too, and `npm run check` will catch
a fixture that has stopped parsing or lost a month.

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

It checks for em dashes (a standing house rule, see `CLAUDE.md`), that the CDN
URLs are intact, that the fixtures parse and carry all twelve months, and that
every `DATA_FLAGS` entry names real months and a real series. These are the
mistakes that have actually been made here, not a general linter.
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
