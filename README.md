# Moss · Client Hours

A tiny Vercel project that surfaces Moss client hours from ClickUp:

- **`api/time.js`**: a serverless proxy that fetches ClickUp time entries for a
  given year, buckets them by month across the Creative (retainer) and
  Non-Creative (SOW) folders, with a per-task breakdown, including each task's
  ClickUp permalink, and returns clean JSON (CORS enabled).
- **`index.html`**: a self-contained, client-facing hours **report** (no build
  step) styled with the [Founding Creative brand system](https://brand.foundingcreative.com).
- **`assets/`**: the Founding Creative and Moss logo files used in the header
  lockup, vendored so the report never depends on a third-party host at render
  time.

## The report

Laid out high level → low level:

1. **Masthead**: Founding Creative × Moss lockup, a live clock, the data's
   last-updated time, a manual refresh button and an export menu.
2. **Year to date**: total hours delivered, then Creative against its available
   retainer hours (with a usage meter and a *% used* chip) and Non-Creative as a
   share of the total.
3. **Monthly overview**: grouped bar chart. Hovering a legend entry ghosts every
   other series; clicking hides it.
4. **Summary by month**: per-month table (`15h 12m / 50h` plus *% used*).
   Selecting a row jumps to that month's detail.
5. **Task detail by month**: month tabs, sorting controls, and one row per
   ClickUp task with a permalink out to the task itself.

### Categories

The report uses two terms throughout, mapped from the ClickUp folder structure:

| Term             | Means                                                   |
| ---------------- | ------------------------------------------------------- |
| **Creative**     | Retainer work, drawn against the monthly retainer budget |
| **Non-Creative** | Separately scoped project work (SOW), outside the retainer |

Percentages are always *used*, never *unused* or *remaining*.

### Retainer allowance and pace

The Creative allowance is `50h × allowanceMonths()`. Those months are the ones
the client has **paid for**, not the ones that happen to carry tracked time: the
retainer accrues on the 1st whether or not anyone logs hours, so for the current
year the count runs from the first tracked month through the month we are in
now. A quiet August still adds 50h to the denominator.

The hero meter is segmented, one tick per month of retainer, so the bar reads as
"N months at 50h" rather than an abstract percentage. Reading it:

- The bar filling completely means the retainer is being consumed exactly as
  fast as it accrues.
- The fill covering 2.3 of 7 segments means roughly two and a bit months' worth
  of a seven-month retainer has been used, so there is unused capacity.

Per-month pace lives in the summary table's **Used** column.

### Freshness

`api/time.js` sends `Cache-Control: no-store` and the report cache-busts every
request, so each page load (and each press of the refresh button) is a real
round trip to ClickUp. The masthead shows the current date and time alongside
`generatedAt` from the API response, so the data's age is always visible.

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

One entry drives every surface at once: a hatched fill and a ▾ marker on the
chart, a warning tag in the summary table, a dot on the month tab, a note in the
tooltip, a full callout in the year-to-date panel and in the affected month's
detail panel, and a `Data note` column in both CSV exports.

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
while dropping them from the current year's header strip.

Images live at `team/roster/<slug>.webp` (160px, shown in the header strip) and
`team/stack/<slug>.webp` (48px head crop, shown in the monthly avatar stacks).
Never use a roster image in a stack: it is four times the weight and the face is
unreadable at that size. `team/roster/fc-mark.svg` and `team/stack/fc-mark.svg`
are the studio mark, used for unrostered contributors and as the `onerror`
fallback for any avatar that fails to load.

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
