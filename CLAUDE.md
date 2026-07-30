# moss-hours

Client-facing hours report for Moss, built by Founding Creative. Static
`index.html` plus a `api/time.js` Vercel function proxying ClickUp time entries.
See `README.md` for architecture, the API shape and the `DATA_FLAGS` annotation
system.

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

Before committing front-end work, check: `grep -n "—" index.html api/*.js`

### Report-specific conventions

- Percentages are always **% used**, never % unused or remaining. Unused
  capacity is not framed as a negative signal.
- Category terms in the UI are **Creative** and **Non-Creative**. "Retainer" and
  "SOW" are internal folder names and stay out of the interface.
- The retainer allowance accrues monthly whether or not hours are tracked, so
  `allowanceMonths()` counts elapsed months, not months that carry time.
