# moss-hours

Client-facing hours report for Moss, built by Founding Creative. Static
`index.html` plus a `api/time.js` Vercel function proxying ClickUp time entries.

`README.md` is the real documentation and it is worth reading before changing
anything: it carries the reasoning behind most of the decisions in here, so a
change that looks like an obvious improvement has often already been tried. Its
**Repo map** section says which function or banner comment holds what, which
beats scrolling 2,700 lines of `index.html`.

## Working on this

```bash
npm run dev      # static server + committed fixtures, no ClickUp token needed
npm run check    # run before every commit
```

`npm run dev` prints two fixture URLs. Use `fixtures/2026-typical.json` for
ordinary layout work and `fixtures/2026-edge.json` to see the states real data
rarely reaches (the data alarm, empty categories, missing permalinks, a
contributor who is not in the roster). `npm run dev:api` (`vercel dev`) is only
needed when the change touches `api/time.js`.

Chart.js and the brand tokens come from CDNs. Pointing `index.html` at local
copies to work offline is fine, and committing that swap ships an unstyled,
chartless report to the client. `npm run check` fails if either CDN URL has gone
missing, so run it.

This report is live in front of a client. Prefer a visible zero state or a
plainly broken-looking state over anything that quietly renders wrong numbers.

## Lessons

### Never use em dashes

Do not use em dashes (`—`) anywhere: UI copy, code comments, commit messages,
PR descriptions, or chat replies. This is a standing preference, not a one-off
cleanup request.

Use instead, in rough order of preference:

- a period, splitting the sentence in two
- a colon, when the second half explains the first
- a comma, or a pair of commas around an aside
- parentheses for a true aside
- a semicolon for two linked independent clauses

Do not swap in an en dash (`–`) or a spaced hyphen (` - `) as a substitute:
those read as the same tic. En dashes remain correct in numeric and date
ranges (`Jan–May`, `2024–2026`), which is a different job.

Also avoid the em dash as a placeholder glyph for "no value" in the UI. Prefer
the real zero state (`0h`) or an ellipsis for genuinely-loading content, both of
which say something the dash does not.

Before committing front-end work, run `npm run check`, which scans for this
across `index.html`, `api/time.js`, `roster.js`, the scripts and this README.

### Report-specific conventions

- Percentages are always **% used**, never % unused or remaining. Unused
  capacity is not framed as a negative signal.
- The two categories are **Creative** and, in the interface, **Other**. Prose
  about the report calls the second one Non-Creative; the label a client reads
  is `Other`, set once as `CATS[1].label`. "Retainer" and "SOW" are internal
  ClickUp folder names and never appear in the interface.
- The retainer allowance accrues monthly whether or not hours are tracked, so
  `allowanceMonths()` counts elapsed months, not months that carry time.
- **Colour is reserved.** Mint means Creative and lavender means Other,
  everywhere, so neither can carry interface state. Cyan is the action colour.
  Warn yellow means data integrity and never utilisation. The diagonal texture
  means projected, and now means only that.
- Ghosting is a **10% opacity drop**, applied through `fade()`. Anything that
  dims on hover keeps its own colour and steps back one notch.
- Copy in this report is plain and unhedged. No semicolons or colons stacked
  into a sentence, no date ranges hardcoded into prose that the chart already
  shows, and nothing that reads as a disclaimer.
