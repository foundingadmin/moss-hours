# Moss · Client Hours

A tiny Vercel project that surfaces Moss client hours from ClickUp:

- **`api/time.js`**: a serverless proxy that fetches ClickUp time entries for a
  given year, buckets them by month across the Creative (retainer) and
  Non-Creative (SOW) folders, with a per-task breakdown, including each task's
  ClickUp permalink, and returns clean JSON (CORS enabled).
- **`index.html`**: a self-contained, client-facing hours **report** (no build
  step) styled with the [Founding Creative brand system](https://brand.foundingcreative.com).
- **`assets/`**: the Founding Creative wordmark used in the masthead and the
  client wordmark used in the report title, vendored so the report never depends
  on a third-party host at render time.

## The report

Laid out high level → low level:

1. **Masthead**: the Founding Creative wordmark, on its own. Only the agency
   mark is chrome here, which is what makes the template reusable for another
   retainer client.
2. **Title**: the client wordmark, then the report title, then the range and the
   export link. The mark sits in a container of its own, centred on its **cap
   band** rather than on its bounding box: measured from Moss's artwork, the caps
   run 1.15 to 138.2 inside a 245.976 artboard while the spear descends to
   160.45, leaving 35% of the box empty below the mark, so centring the box
   floats the letters high. The shift is 21.7% of the rendered height. Doing it
   with a container rather than a per-logo baseline nudge is what survives
   swapping in a different client's artwork.
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
   other series; clicking hides it. The `Total` entry is a key, not a control.

   Then a per-month table, deliberately plain: no rules between rows, no tinted
   columns, no selected surface. Hierarchy is weight, colour, and one rule above
   the totals. Every row expands in place into that month's task detail, with the
   two categories side by side above 860px, one task per row with a permalink out
   to ClickUp, and the people who worked the month. Nothing opens on arrival.

### The drawer lede

The first thing inside an open month, above the two task lists. The row it hangs
from already carries the month, its split and its total, so the lede argues the
three things the row cannot: **who** worked it, **how much of the retainer** it
used, and **what mattered**. One third / two thirds, on the gutter the task lists
below use, stacking at the same 860px they do.

- **Your team.** The month's contributors, resolved through `roster.js`, as an
  overlapping stack of faces with no names on them. Hover, focus or tap a face and
  its `Name · Title` appears in a line under the stack whose height is reserved,
  so nothing moves. Six faces then `+N`.
- **Utilization.** The month's Creative hours, the monthly budget, and the share
  of it used, over a meter that fills from zero each time the drawer opens (1.1s,
  0.2s in). Reduced motion and print get the final width with no travel. **This
  is the only place the report states a percentage per month**: it used to sit on
  every Creative figure in the table, three columns from the budget it is a share
  of, and it came out of the table and the year-to-date row with it.
- **Highlights.** A hand-written sentence, the one piece of copy in the report
  not derived from the data. See below.

Two things in the task lists below belong to the same pass: a task carrying hours
in more than one month of the year gets a **`YTD 9h` chip** hugging its name
(whole hours, summed per task id across the payload, computed client-side), and
task names truncate to one line at every width rather than wrapping on a phone.

### Month highlights

The editorial line at the top of an open month, from a config map near the top of
the `<script>` in `index.html`, in the same spirit as `DATA_FLAGS`:

```js
var MONTH_HIGHLIGHTS = {
  '2026-2': '<b>Shirt designs</b> led the month, the <b>brochure template</b> shipped.'
};
```

Keyed `YEAR-monthIndex`, zero-indexed to match the payload. `<b>` marks the
keywords and is the only markup that survives; everything else is escaped.
Keywords are emphasised by **weight, not colour**, since a mint word in that
sentence would read as a third series.

A month with no entry renders no highlights block. The team column keeps its
third of the row either way, so the drawer does not change shape month to month.

### Chart and table are linked

Pointing at a month in either dims every other month in **both**. Clicking a bar
opens that month's row in the table and closes whichever was open. The two are
views of one set of months, so they behave like it.

### Projections

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
bars are hollow, its end labels and the total line ghost across it, and none of
it is counted in the legend's totals. The key under the chart names the texture
and states the basis:

> **Outlined bars represent future estimates, not actual time.** They are based on
> YoY data (if available) or the average of past completed months. The shaded band
> reflects a typical ±45% variance. These projections are excluded from the totals
> above.

The variance figure is **read off the payload on every render**, not written into
the copy: it is the spread the tracked months actually show, clamped to 12–45%,
so the sentence cannot claim a band the chart is not drawing. The band sentence
drops out entirely when the total line is hidden, since the band goes with it.

### Categories

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

`api/time.js` sends `Cache-Control: no-store` and the report cache-busts every
request, so each page load (and each press of the refresh button) is a real
round trip to ClickUp. The **footer** carries the current date and time
alongside `generatedAt` from the API response, plus the refresh control. It is a
note on how fresh the data is, which is a closing remark rather than the first
thing on the page. The readout is set in the platform monospace face: Manrope
ships no tabular-figure feature (measured, its digits run 7.47px to 8.00px
wide), so a proportional ticking seconds field twitched the whole line once a
second.

### Export

The export menu offers a monthly-summary CSV, a task-level line-item CSV
(including the ClickUp URL and any data note for each row), and Print / Save as
PDF. The print stylesheet re-points the design tokens to a light palette and
re-themes the chart canvas via the `beforeprint` / `afterprint` events.

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
    detail: 'Creative hours for January–May 2026 come from a partially corrupt …'
  }
];
```

One entry drives every surface at once: a hatched fill on the chart, a note in
that bar's tooltip, a label beside the **Creative** heading in the affected
month's expanded detail (icon plus dotted-underlined text, no container: a pill
there carried the weight of a status badge on the category it sits beside), and a
`Data note` column in both CSV exports.
The label opens a modal lined with the same diagonal, so one visual language runs
from the chart through to the note explaining it. The closed table row carries no
mark of its own: the chart shows it at a glance and the detail states it in full.

The flag sits with the series it applies to rather than with the month, since
under-reporting never applied to the non-Creative side.

Everywhere the diagonal appears outside the canvas it is drawn at `-45deg`: the
canvas hatch runs bottom-left to top-right, and CSS at `45deg` lays its bands the
other way, which silently mirrors it.

**Delete the entry once the underlying data is repaired.** Nothing else needs
to change.

The currently shipped flag covers **Creative, Jan–May 2026**, whose ClickUp
export is partially corrupt and understates real usage.

## API

```
GET /api/time?year=2026
```

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
CLICKUP_TOKEN=pk_... node scripts/generate-roster.js
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
`team/stack/<slug>.webp` (48px head crop). The faces in the drawer lede are 44px,
which is 88 physical pixels on a retina screen, so they render the **roster**
crop; the 48px stack file is soft at that size. The API returns both, and the
stack crop is the fallback where a roster path is missing.

Name and job title are rendered under the stack rather than into the browser's
`title` attribute, which waits about a second, styles itself and never fires on
touch. They are read out one at a time on hover, focus or tap, into a line whose
height is reserved so the lede never shifts.

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
   resolved per request from `GET /team` rather than hardcoded, so staffing
   changes need no code change.
2. **The year is walked one month at a time.** A single call is capped in how
   many entries it returns, and with every member included the payload is large
   enough to hit that cap and under-report silently. Twelve sequential calls are
   merged and de-duplicated by entry id.
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
   vercel env add CLICKUP_TOKEN
   # paste the pk_… token when prompted (Production + Preview)
   ```

2. Deploy:

   ```bash
   vercel deploy --prod
   ```

The report calls the API at the same origin (`/api/time`), so once deployed it
works without further configuration. To point it at a different API, append
`?api=https://your-deploy.vercel.app/api/time`.

## Local notes

The report is a single static file; Chart.js and the brand tokens load from a
CDN. Open it through `vercel dev` so the `/api/time` route resolves. To work on
the layout without a ClickUp token, serve the directory statically and point the
page at a local fixture:

```
index.html?api=./mock.json&year=2026
```

## Environment

| Variable        | Required | Description                          |
| --------------- | -------- | ------------------------------------ |
| `CLICKUP_TOKEN` | yes      | ClickUp personal API token (`pk_…`). |
