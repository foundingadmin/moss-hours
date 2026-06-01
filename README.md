# Moss · Client Hours

A tiny Vercel project that surfaces Moss client hours from ClickUp:

- **`api/time.js`** — a serverless proxy that fetches ClickUp time entries for a
  given year, buckets them by month across the Retainer and SOW folders, and
  returns clean JSON (CORS enabled).
- **`public/index.html`** — a self-contained React dashboard (no build step)
  styled with the [Founding Creative brand system](https://brand.foundingcreative.com).

## API

```
GET /api/time?year=2026
```

Response:

```json
{
  "year": 2026,
  "retainer": [/* 12 monthly hour totals, Jan→Dec */],
  "sow":      [/* 12 monthly hour totals, Jan→Dec */],
  "totalEntries": 284,
  "unmatchedEntries": 0,
  "unmatchedHours": 0
}
```

`unmatchedEntries` / `unmatchedHours` count time that fell outside the four
tracked folders — a quick sanity check that the folder mapping is complete.

### Folder mapping

| Bucket   | Folder              | ID            |
| -------- | ------------------- | ------------- |
| Retainer | Retainer (Active)   | `90114447278` |
| Retainer | Retainer (Archive)  | `90116369473` |
| SOW      | SOW (Active)        | `90117343728` |
| SOW      | SOW (Archive)       | `90117412643` |

Each entry's folder is read from `task_location.folder_id` (the canonical field
in ClickUp's v2 `/team/{id}/time_entries` response), with defensive fallbacks
for other shapes.

### Confirming the folder field against live data

If buckets ever look empty, dump a raw entry from production:

```
GET /api/time?year=2026&debug=1
```

This returns the first raw ClickUp entry plus the folder ID resolved from it, so
you can verify the field mapping without redeploying.

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

The dashboard calls the API at the same origin (`/api/time`), so once deployed
it works without further configuration. To point the dashboard at a different
API, append `?api=https://your-deploy.vercel.app/api/time`.

## Local notes

The dashboard is a single static file with React, ReactDOM, and Babel loaded
from a CDN — open it through `vercel dev` so the `/api/time` route resolves.

## Environment

| Variable        | Required | Description                          |
| --------------- | -------- | ------------------------------------ |
| `CLICKUP_TOKEN` | yes      | ClickUp personal API token (`pk_…`). |
