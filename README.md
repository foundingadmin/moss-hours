# Moss · Client Hours

A tiny Vercel project that surfaces Moss client hours from ClickUp:

- **`api/time.js`** — a serverless proxy that fetches ClickUp time entries for a
  given year, buckets them by month across the Creative (retainer) and
  Non-Creative (SOW) folders — with a per-task breakdown, including each task's
  ClickUp permalink — and returns clean JSON (CORS enabled).
- **`index.html`** — a self-contained, client-facing hours **report** (no build
  step) styled with the [Founding Creative brand system](https://brand.foundingcreative.com).
- **`assets/`** — the Founding Creative and Moss logo files used in the header
  lockup, vendored so the report never depends on a third-party host at render
  time.

## The report

Laid out high level → low level:

1. **Masthead** — Founding Creative × Moss lockup, a live clock, the data's
   last-updated time, a manual refresh button and an export menu.
2. **Year to date** — total hours delivered, then Creative against its available
   retainer hours (with a usage meter and a *% used* chip) and Non-Creative as a
   share of the total.
3. **Monthly overview** — grouped bar chart. Hovering a legend entry ghosts every
   other series; clicking hides it.
4. **Summary by month** — per-month table (`15h 12m / 50h` plus *% used*).
   Selecting a row jumps to that month's detail.
5. **Task detail by month** — month tabs, sorting controls, and one row per
   ClickUp task with a permalink out to the task itself.

### Categories

The report uses two terms throughout, mapped from the ClickUp folder structure:

| Term             | Means                                                   |
| ---------------- | ------------------------------------------------------- |
| **Creative**     | Retainer work, drawn against the monthly retainer budget |
| **Non-Creative** | Separately scoped project work (SOW), outside the retainer |

Percentages are always *used*, never *unused* or *remaining*.

### Freshness

`api/time.js` sends `Cache-Control: no-store` and the report cache-busts every
request, so each page load — and each press of the refresh button — is a real
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

**Delete the entry once the underlying data is repaired** — nothing else needs
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
- `url` is the task's ClickUp permalink — `task_url` from the API when present,
  otherwise the stable `https://app.clickup.com/t/{task_id}` form. It can be
  `null`, and the report renders a disabled link icon in that case.
- `generatedAt` is when the payload was built server-side; the report surfaces
  it as "Data updated …".
- `retainerBudget` is the assumed monthly retainer budget (hours) used for the
  `% used` figures.
- `unmatchedEntries` / `unmatchedHours` count time outside the four tracked
  folders (i.e. other clients in the shared workspace) — a sanity check that the
  folder mapping is complete. It is deliberately **not** shown in the report,
  which is Moss-only.

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

This returns the first raw ClickUp entry plus the folder ID and task URL
resolved from it, so you can verify the mapping without redeploying.

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
