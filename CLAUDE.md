# moss-hours

Two client-facing reports for Moss, built by Founding Creative, on one Vercel
project.

- **Report A**, `index.html`, "Fractional Creative Usage". Retainer hours from
  ClickUp, via the `api/time.js` function.
- **Report B**, `report-b.html`, "Ad Hoc Creative Support". Days and dollars
  from `data/sows.json`, which is hand-maintained from signed documents.

**They never share a data source, and that is architectural rather than a
filter.** Report B contains no code path to ClickUp: not a disabled one, not a
filtered one, none. If it ever read a time entry, hours would be one flag away
from a client surface forever.

`README.md` is the real documentation and it is worth reading before changing
anything: it carries the reasoning behind most of the decisions in here, so a
change that looks like an obvious improvement has often already been tried. Its
**Repo map** section says which function or banner comment holds what, which
beats scrolling 2,900 lines of `index.html`.

## Working on this

```bash
npm run dev      # static server + committed fixtures, no ClickUp token needed
npm run check    # run before every commit
```

`npm run dev` prints the fixture URLs. Use `fixtures/2026-typical.json` for
ordinary layout work and `fixtures/2026-edge.json` to see the states real data
rarely reaches (no permalinks anywhere, a month that is entirely estimated, a
zero month inside the tracked range, one task carrying all three evidence
classes). Report B needs no fixture: `data/sows.json` is the real thing.
`npm run dev:api` (`vercel dev`) is only needed when the change touches
`api/time.js`.

**Fixtures are generated, not hand-edited.** `npm run fixtures` rebuilds them
from the specs in `scripts/build-fixtures.mjs`, which is what keeps a month's
header agreeing with the rows under it. `npm run check` verifies that
independently, so a hand-edited fixture that has drifted still fails.

Chart.js and the brand tokens come from CDNs. Pointing a report at local copies
to work offline is fine, and committing that swap ships an unstyled, chartless
report to the client. `npm run check` fails if either CDN URL has gone missing,
so run it.

These reports go in front of a client. Prefer a visible zero state or a plainly
broken-looking state over anything that quietly renders wrong numbers.

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
across both reports, `api/time.js`, `data/sows.json`, the scripts and the README.

### Report A conventions

- Percentages are always **% used**, never % unused or remaining. Unused
  capacity is not framed as a negative signal.
- There is **one series**, retainer hours, split three ways by how well each hour
  is evidenced: **logged**, **documented**, **estimated**. Documented and
  estimated together are **reconstructed**. That is a distinction inside the
  retainer, not between two kinds of work.
- "Retainer" is a term a client reads. "SOW" is an internal ClickUp folder name
  and appears nowhere in either interface.
- The retainer allowance accrues monthly whether or not hours are tracked, so
  `allowanceMonths()` counts elapsed months, not months that carry time.
- Percentages are measured against the **contracted 50** (clause 3.1), flat.
  Clause 4.1 rollover is stated in the definition block but is deliberately not
  in the denominator: see the reasoning in the README before changing it.
- The sum of logged and reconstructed is **Total**, and it is a per-row helper
  rather than a headline. It renders only where both are non-zero. Where a month
  has no reconstructed hours the cell is empty, not a zero and not a dash:
  silence is the signal that nothing needed adding.
- **Over 100% is not a failure state.** Clause 6.1 makes overage a negotiated,
  quarterly-billed supplement, so it renders in plain white with an `Overage`
  tag and a note citing the clause, never in an alarm colour.
- **Colour is reserved, and the reconstruction does not get a colour.** Mint
  means retainer hours, all three classes of them, and the classes are separated
  by pattern density on that one green. Cyan is the action colour and carries
  interface state, including the open month's outline and its label on the chart
  axis. Warn yellow means data integrity and never utilisation. The diagonal
  texture means projected, and means only that. The reconstruction hatches run at
  45 degrees in the series green for the same reason.
- The two hatches exist twice: `hatchPattern()` for the chart canvas and the
  `--hatch-*` custom properties for the DOM. They have to be changed together.
- Ghosting is a **20% opacity drop**, applied through `fade()` on the chart and
  a matching `.is-dim` rule in CSS. The two have to be changed together.
  Hovering a table row dims the chart; hovering the chart dims nothing.
- The team block is a **hardcoded array**. Nothing about a person comes from
  ClickUp, and no hours, percentages or contribution ordering appear in it.
- `[RECON:DOC]` and `[RECON:EST]` are internal machinery. They are read by the
  classifier in `api/time.js` and discarded, and must never reach a response, a
  fixture or a page.
- Two features are hidden behind a one-word switch rather than deleted:
  `SHOW_EXPORT` and `SHOW_PROJECTIONS`. Leave the code they gate alone, and keep
  it working: switching one back on should not land on a dead field name.

### Report B conventions

- **Days and dollars, never hours.** `npm run check` fails if the word appears in
  `report-b.html` or `data/sows.json` in any form, including in a comment.
- **Regions are the cut, not departments.** Departments are org chart, regions
  hold budget.
- Only **executed** documents contribute to any total. A document in drafting
  carries no figures.
- A scaffolded region renders a **skeleton bar, not a zero**. A zero would say
  the region bought nothing, which is the opposite of true, and the visual state
  has to carry that without a caption.
- The Multi-Region distribution toggle is **experimental and removable**. It
  lives entirely between four `EXPERIMENTAL: MULTI-REGION DISTRIBUTION`
  START/END marker pairs, and cutting between them must leave a working page.

### Both reports

- Copy is plain and unhedged. No semicolons or colons stacked into a sentence,
  no date ranges hardcoded into prose that the chart already shows, and nothing
  that reads as a disclaimer.
- Claims about the retainer cite a **numbered SLA clause**. These reports are
  read by people with no context and a stake in the outcome, so every claim
  should be one they can open the agreement and check.
- The agreement does **not** restrict retainer work to one department or one
  contact. Do not write copy implying that it does. The accurate and stronger
  claim is that work already covered by a separate signed agreement is fulfilled
  under that agreement (clause 2.2.2).
- `RETAINER_FOLDER_IDS` in `api/time.js` is the whole firewall keeping other
  agreements off Report A. Widening it is a contract decision, not a code
  change, and `npm run check` fails if it moves.
