# Moss Hours Reporting — Rundoc

**Version:** 1.0
**Status:** In progress
**Date:** 4 August 2026
**Prepared by:** Josh Titus / Claude
**Intended for:** Claude Code, working in the `moss-hours` repo

---

## Project overview

**What it is.** A rebuild of the live Moss reporting surface into two separate reports that never share a data source.

**What problem it solves.** The current report puts retainer hours and SOW hours in the same chart, in the same unit, and invites a comparison that is not valid. Retainer hours are the thing Moss purchased. SOW hours are Founding Creative's internal cost of goods and were never sold, never priced, and never a contract term.

**What it is NOT.** This is not a redesign of the existing report. Report A is a rebuild of the retainer view with SOW data removed at the API layer. Report B is a new report built from signed contracts, not from time tracking. No code path connects Report B to ClickUp.

**Tech stack.** Vercel serverless functions, vanilla JavaScript, Chart.js, no framework. Six files today: `api/time.js`, `index.html`, `vercel.json`, `package.json`, `README.md`, `.gitignore`.

**Key constraints.**

- Report A is live at `moss.foundingcreative.com`. The client can open it any day. Every deploy is a client-facing deploy.
- ClickUp workspace `9011561475`.
- Report A pulls from the two Moss Creative Retainer folders only: [`90114447278` Moss Creative Retainer, Delivery space](https://app.clickup.com/9011561475/v/f/90114447278) and [`90116369473` Moss Creative Retainer Archive](https://app.clickup.com/9011561475/v/f/90116369473).
- The two Moss SOW folders [`90117343728`](https://app.clickup.com/9011561475/v/f/90117343728) and [`90117412643`](https://app.clickup.com/9011561475/v/f/90117412643) must never be referenced in any file that ships to Report A.
- No per-person hours anywhere on any client-facing surface.
- No ClickUp-sourced images, usernames, initials, avatars, or email addresses anywhere.

---

## Contract facts that govern this build

Source: `SLA - Moss - 24 months v3 - Signed.pdf`. Executed 27 February 2025, effective 25 February 2025.

| Clause | Fact | Effect on the build |
|---|---|---|
| 3.1 / 3.2 | 50 agency hours per month, 24 months, $10,000 per month, term February 2025 to February 2027 | 50 is the contracted monthly allowance. `RETAINER_BUDGET_HOURS = 50` stays. |
| 4.1 | Up to 10 unused hours roll over to the following month | 50 is not the true monthly ceiling. See Phase 3, open decision. |
| 4.2 | Hours not used before end of term are forfeited | Forfeiture date is February 2027. Relevant at renewal, not on the report yet. |
| 4.3 | Client agrees to proactively use retainer hours to ensure maximum value | Moss has a contractual interest in high utilization. This is the strongest single line for the copy pass. |
| 2.2.1 | Retainer hours apply exclusively to new projects initiated under this contract after execution date | The firewall is contract-scoped. |
| 2.2.2 | Work on ongoing projects under existing agreements continues under those agreements | Work covered by an SOW cannot also draw retainer hours. This is the defensible separation. |
| 6.1 | Additional hours beyond the retainer are negotiated as supplemental overages, billed quarterly | Overage is a contract mechanism, not a failure state. Report A must show it plainly. |
| 5.3.2 / 5.3.3 | Josh Titus is the single primary POC. Client also has access to a Production Coordinator | Anchors the static team block in Phase 3. |
| Appendix A | 22 a la carte services, each with a Minimum Lead Time in days and an Hourly Cost Estimate range in hours | The retainer contract itself publishes hours per service. See Phase 6. |

### Correction to a prior assumption

The agreement does **not** say the retainer belongs to Andrea Murphy personally or to the Moss creative department exclusively. Andrea is listed as Main Contact. The signatory is Justin Sligh, Senior Director, Marketing.

Clause 2.2 scopes hours to projects initiated under this contract and excludes work running under other agreements. That is a contract boundary, not a departmental one.

Consequence for copy: do not write anything that claims other Moss departments cannot request retainer work. The accurate and still very strong claim is that work already covered by a separate signed agreement does not draw on the retainer. Build the copy on 2.2.2 and 4.3, not on an implied ownership that the document does not grant.

---

## Phase overview

| # | Phase | Status | Goal |
|---|-------|--------|------|
| 00 | Archive and freeze v1 | 🔵 Up next | Current build recoverable forever, unable to affect the rebuild |
| 01 | Retainer-only API | ⚪ Pending | API returns retainer data only, correctly scoped and bucketed |
| 02 | Reconstruction classification | ⚪ Pending | Every entry resolves to Logged, Documented, or Estimated |
| 03 | Report A frontend | ⚪ Pending | Chart and tables show Logged vs Reconstructed, SOW removed |
| 04 | Report A copy and trust layer | ⚪ Pending | Contract-anchored language, signed agreement linked |
| 05 | Report B data model | ⚪ Pending | Committed SOW index with regional attribution |
| 06 | Report B frontend | ⚪ Pending | Regional ad hoc view in days and dollars, never hours |
| 07 | Teardown and go-live | ⚪ Pending | Fixtures removed, acceptance criteria verified against real data |

---

## Phase 00 — Archive and freeze v1

The current report is the only working reference for how the data pipeline behaves. It has to survive the rebuild, and it has to be incapable of contaminating it. Two mechanisms, because one is not enough.

### Context

The archive must satisfy three properties. It must be downloadable as a unit. It must be inert, meaning no build step, import resolver, or Vercel function scanner can pick it up. It must be obvious to a future reader why it exists.

A git tag is the strongest and cheapest archive. It captures the exact tree, costs nothing, and cannot be imported. A committed zip covers the case where the repo history is lost or Josh wants a file he can hand to someone without git.

Do both. Do not commit a loose directory of live-looking `.js` files, because a directory named `api` anywhere in a Vercel project is the kind of thing that gets picked up by a future config change.

### Prompts

#### Prompt 00.1 — Tag the current build

Run this before any file is modified.

```
In the moss-hours repo, on the current default branch with a clean working tree,
create an annotated git tag named v1-final-2026-08-04.

Tag message: "Final state of the v1 combined Creative/Other report before the
Report A and Report B rebuild. Retainer and SOW data were combined in one chart
in this version."

Push the tag to origin.

Then print the output of: git show --stat v1-final-2026-08-04

Success looks like: the tag exists on origin and the stat output lists
api/time.js, index.html, vercel.json, package.json, README.md and .gitignore.
```

#### Prompt 00.2 — Create the inert archive directory

Run after 00.1.

```
In the moss-hours repo, create a directory at the repo root named _archive.

Inside it create a single subdirectory named 2026-08-04-v1-report.

Inside that subdirectory:

1. Create a zip archive named v1-report.zip containing the current state of
   api/time.js, index.html, vercel.json, package.json and README.md. Preserve
   the api/ directory structure inside the zip.

2. Create a README.md with this exact content:

   # Archived v1 report — 4 August 2026

   Frozen copy of the combined Creative/Other Moss hours report as it stood
   before the Report A and Report B rebuild.

   This directory is inert. Nothing here is imported, built, or deployed.
   The contents are zipped on purpose so no file in here can be resolved as a
   module or picked up as a Vercel serverless function.

   The same state is also available as git tag v1-final-2026-08-04.

   Do not unzip this into the working tree. Download it and open it elsewhere.

3. Do not place any loose .js, .html or .json file in this directory. The zip
   is the only payload.

Then create or update a .vercelignore file at the repo root and add the line:
_archive/

Then confirm the repo root .gitignore does NOT contain any pattern that would
exclude _archive/, since this directory must be committed.

Show me the resulting directory tree of _archive/ and the contents of
.vercelignore before committing.

Success looks like: _archive/2026-08-04-v1-report/ contains exactly two files,
v1-report.zip and README.md, and .vercelignore excludes _archive/ from deploys.
```

### Completion criteria

- [ ] `git tag -l` lists `v1-final-2026-08-04` and the tag exists on origin
- [ ] `_archive/2026-08-04-v1-report/` contains exactly two files: `v1-report.zip` and `README.md`
- [ ] No `.js`, `.html`, or `.json` file exists anywhere under `_archive/` outside the zip
- [ ] `.vercelignore` contains `_archive/`
- [ ] A deploy preview builds successfully and the deployment file list contains no path beginning with `_archive`
- [ ] Unzipping `v1-report.zip` in a temp directory produces a runnable copy of the v1 report files

---

## Phase 01 — Retainer-only API

`api/time.js` currently fetches both retainer and SOW folders and returns both. This phase removes SOW entirely and fixes the four data defects carried over from v1.

### Context

The confirmed v1 defect: `api/time.js` calls ClickUp v2 `/team/{id}/time_entries` with no `assignee` parameter. That endpoint scopes to the authenticated token holder. The report has only ever shown Josh Titus's hours. February 2026 read 7h 38m, which is his solo retainer total.

`folderIdOf()` works correctly and is a known non-issue. `task_location.folder_id` is populated in the raw ClickUp API even though the MCP connector returns it as null. Do not re-investigate it. It is now load-bearing, because it is the mechanism that keeps SOW data off Andrea's report.

Do not confuse two different things that share the word "assignee." The `&assignee=` API parameter stays and is required. The dynamic contributor roster, the fuzzy-matching generator, `roster.js`, per-month contributor stacks and the contributor count diagnostic are all cut. Those were spec items 6 through 16 of the previous plan and they are dead.

### Prompts

#### Prompt 01.1 — Scope to assignees and retainer folders only

```
In moss-hours/api/time.js, make the following changes. Show me the full modified
file before writing it.

1. Before fetching time entries, call GET https://api.clickup.com/api/v2/team
   using the existing CLICKUP_API_TOKEN. Extract every members[].user.id for
   team 9011561475. Join with commas. Pass the result as the &assignee= query
   parameter on every time_entries request. Fetch this list dynamically on each
   invocation. Do not hardcode user IDs anywhere in this file.

2. Define the retainer folder IDs as a module-level constant:
   const RETAINER_FOLDER_IDS = ['90114447278', '90116369473'];

3. Delete every reference to the SOW folder IDs 90117343728 and 90117412643.
   Delete any SOW bucket, SOW total, combined total, or "other" series from the
   response shape. After this change the string "SOW" must not appear anywhere
   in api/time.js, including comments.

4. Any time entry whose resolved folder id is not in RETAINER_FOLDER_IDS is
   discarded, not bucketed. It does not appear in any total.

Do not change the response shape for retainer data yet. That happens in 01.2.

Success looks like: the API response contains only retainer figures, and a grep
for "9011734" or "9011741" in api/time.js returns nothing.
```

#### Prompt 01.2 — Fix month bucketing, chunking, and task keying

```
In moss-hours/api/time.js, apply these four fixes. Show me the full modified file
before writing it.

1. Bucket months in America/Denver, not server local time. Vercel runs in UTC and
   Founding Creative is in Denver at UTC-6/-7. One contractor routinely works
   10pm to 2am, so late-evening work currently lands on the following day and
   month-boundary work lands in the wrong month.

   Use this helper:

   const DENVER = new Intl.DateTimeFormat('en-CA', {
     timeZone: 'America/Denver', year: 'numeric', month: '2-digit'
   });
   const denverYM = (ms) => {
     const p = Object.fromEntries(
       DENVER.formatToParts(new Date(ms)).map(x => [x.type, x.value])
     );
     return { year: +p.year, month: +p.month - 1 };
   };

   Widen the fetch window by 48 hours on each side, then let denverYM decide the
   month and discard anything that resolves outside the requested year.

2. Replace the single time_entries call with twelve sequential monthly calls, each
   passing the full assignee list. ClickUp caps entries returned per call and the
   assignee fix roughly triples the payload. Concatenate the results and
   de-duplicate by entry id.

3. Key per-task maps on entry.task.id, not entry.task.name. The workspace contains
   two distinct tasks named "UI Design" and two named "Find contractor", which
   currently merge into one row. Renaming a task currently splits its history.
   Store { id, name, hours } and emit id alongside name. Entries with no task
   object group under one synthetic key labeled "(no task)".

4. Guard duration. Running timers return negative values. Skip any entry where
   parseInt(entry.duration) is negative or NaN.

Success looks like: a request for year 2026 returns twelve month objects, each
task appears at most once per month, and no month contains an entry whose Denver
date falls outside that month.
```

### Completion criteria

- [ ] `grep -i "sow\|9011734\|9011741" api/time.js` returns nothing
- [ ] February 2026 retainer total is materially higher than 7h 38m, confirming assignee scoping is live
- [ ] The response contains no `combined` or `other` field at any level
- [ ] A time entry starting 31 January 2026 at 11pm Denver resolves to January, not February
- [ ] No month's item list contains the same `task.id` twice
- [ ] A manually inserted negative-duration entry is excluded from totals

---

## Phase 02 — Reconstruction classification

Every retainer hour resolves to one of three classes: Logged, Documented, or Estimated. Documented and Estimated together are Reconstructed. This is the spine of the honesty claim the report makes, so it is built and tested before anything renders.

### Context

January through May 2026 were not tracked as they happened. Founding Creative is rebuilding that record from real sources. Documented means the hour traces to an existing artifact such as an invoice, a calendar event with client acceptance, an email thread, or a dated contractor log. Estimated means real work happened but generated no record, and the figure comes from Josh's memory. June 2026 forward is tracked to the minute.

Two write paths exist and they need different levers.

ClickUp time entry tags exist in the workspace and are named exactly `documented` and `estimate`. Note that the second is `estimate`, not `estimated`. Use those exact strings. Tags are applied by hand in the ClickUp UI when a person logs time.

The API connector used for bulk writes cannot attach tags. It sends tags as plain strings where ClickUp expects objects, and every tagged write fails after the entry is already created. So programmatic writes carry a marker in the entry description instead: `[RECON:DOC]` or `[RECON:EST]` as a prefix.

The app therefore reads both, in a fixed order.

### Data model

Classification of a single time entry:

| Order | Test | Class |
|---|---|---|
| 1 | `entry.tags` contains a tag named `documented` | Documented |
| 2 | `entry.tags` contains a tag named `estimate` | Estimated |
| 3 | `entry.description` starts with `[RECON:DOC]` | Documented |
| 4 | `entry.description` starts with `[RECON:EST]` | Estimated |
| 5 | none of the above | Logged |

Absence is the Logged state. This is deliberate. It means none of the existing correctly-logged hours need to be touched, and a forgotten tag defaults to the truthful class rather than inflating the reconstruction.

If an entry carries both a `documented` and an `estimate` tag, classify as Documented and add its entry id to `debug.classificationConflicts`. Never silently pick one.

### Fixtures

A fixture task exists in ClickUp for wiring and verification.

**Task:** [`868kmdh0u` ZZ FIXTURE / DASHBOARD WIRING / DELETE BEFORE CLIENT VIEW](https://app.clickup.com/t/868kmdh0u)
**List:** [Moss | Intake & Ad Hoc, `901109719902`](https://app.clickup.com/9011561475/v/li/901109719902), inside [Moss Creative Retainer, `90114447278`](https://app.clickup.com/9011561475/v/f/90114447278)

Three entries, all January 2026, deliberately absurd so they are unmistakable on a chart:

| Entry id | Duration | Marker | Expected class |
|---|---|---|---|
| `5202587059072133962` | 111h | none | Logged |
| `5202587548111203151` | 222h | tag `documented` plus `[RECON:DOC]` prefix | Documented |
| `5202587612284054352` | 333h | tag `estimate` plus `[RECON:EST]` prefix | Estimated |

All three sit on one task on purpose. One task must be able to hold logged and reconstructed time simultaneously, differentiated at the entry level.

January 2026 should therefore read 666h on the fixture task alone while these exist.

### Open decisions

None. This phase is fully specified.

### Prompts

#### Prompt 02.1 — Build the classifier

```
In moss-hours/api/time.js, add a classification layer. Show me the full modified
file before writing it.

Add a module-level function classifyEntry(entry) that returns exactly one of the
strings 'logged', 'documented' or 'estimated', using this precedence:

1. If entry.tags is an array containing an object whose name equals 'documented'
   (exact, case-sensitive), return 'documented'.
2. If entry.tags contains an object whose name equals 'estimate' (exact,
   case-sensitive, note this is 'estimate' and NOT 'estimated'), return
   'estimated'.
3. If entry.description is a string that starts with '[RECON:DOC]', return
   'documented'.
4. If entry.description starts with '[RECON:EST]', return 'estimated'.
5. Otherwise return 'logged'.

If an entry matches both rule 1 and rule 2, return 'documented' and push
entry.id onto a module-level array named classificationConflicts.

Apply classifyEntry to every retained entry. Each month object in the response
gains:

  hours: { logged: <number>, documented: <number>, estimated: <number> }
  reconstructed: <documented + estimated>
  total: <logged + documented + estimated>

Each task item within a month gains the same hours object, so a single task can
report a split.

Round every hours value to two decimals at the point of emission, not during
accumulation.

Do not expose entry descriptions anywhere in the response. The [RECON:DOC] and
[RECON:EST] markers are internal machinery and must never reach the client
surface. Descriptions are read by classifyEntry and discarded.

Under ?debug=1 only, add debug.classificationConflicts containing the conflict
array.

Success looks like: a request for 2026 returns January with a task item for
task id 868kmdh0u showing logged 111, documented 222, estimated 333, total 666.
```

#### Prompt 02.2 — Verify classification against the fixtures

```
Without modifying any file, call the deployed moss-hours API for year 2026 and
report back the following, as raw numbers:

1. January hours.logged, hours.documented, hours.estimated and total
2. The hours object for the task item with id 868kmdh0u
3. Whether any string matching [RECON: appears anywhere in the full JSON response
4. Whether any entry description field appears anywhere in the response
5. The value of debug.classificationConflicts when called with ?debug=1

Do not fix anything. Report the numbers and stop.

Success looks like: task 868kmdh0u reports logged 111, documented 222, estimated
333, total 666, and answers 3 and 4 are both no.
```

### Completion criteria

- [ ] Task `868kmdh0u` reports logged 111, documented 222, estimated 333, total 666
- [ ] The string `[RECON:` does not appear anywhere in the API response, at any debug level
- [ ] No entry `description` field appears anywhere in the API response
- [ ] An entry tagged `estimate` and an entry prefixed `[RECON:EST]` classify identically
- [ ] An untagged, unprefixed entry classifies as `logged`
- [ ] Every month satisfies `total === logged + documented + estimated` to two decimals
- [ ] `debug.classificationConflicts` exists under `?debug=1` and is absent otherwise

---

## Phase 03 — Report A frontend

Report A is renamed **Fractional Creative Usage**. The SOW series comes off. The chart's second dimension becomes Logged versus Reconstructed, which is a better chart than the one it replaces, because the split does honest work. It shows the month the process changed without anyone having to say so.

### Context

Current header block: a hero figure of Combined hours, a "for scale" novelty stat computed from Combined, and a two-column definition block for Creative and Other.

Everything derived from Other or Combined goes. The "for scale" stat is currently computed off the combined figure and must be recomputed against retainer hours only or removed. Recompute it. It is a good piece of writing and it survives the change.

Combined is not deleted outright. It is demoted from a header consolidation of two incompatible units into a per-row helper that sums Logged plus Reconstructed so nobody does arithmetic in their head. It renders only where both values are non-zero, which means January through May show it and June forward do not. Silence becomes the signal that nothing needed adding.

The dynamic contributor roster is cut. Replace it with a static block of headshots for the creative team. No ClickUp lookup, no fuzzy matching, no per-month stacks, no contributor counts, no diagnostic warning state.

### Data model

Series encoding. Do not introduce a new hue. Reconstructed is the same green as Logged, differentiated by pattern only, so the whole reconstructed portion reads as one family.

| Series | Fill | Rationale |
|---|---|---|
| Logged | Solid green, existing value from index.html | Baseline |
| Documented | Same green, diagonal hatch, 3px stripe / 3px gap | Denser pattern reads as stronger evidence |
| Estimated | Same green, diagonal hatch, 2px stripe / 5px gap | Sparser pattern reads as a softer claim |

If the existing green cannot be located in `index.html`, fall back to `#7EF893`.

### Open decisions

**Rollover treatment. Josh must rule before Prompt 03.3 runs.**

Clause 4.1 allows up to 10 unused hours to roll into the following month. The report currently shows every percentage against a flat 50. That is not the contracted ceiling in any month that follows an underused month.

Worked example using current live figures. January consumed roughly 22h 45m of 50, so 10 hours roll into February. February's available allowance is 60, not 50. Following the same logic forward, June's available allowance is 60 and its 65h 25m reads as 109 percent, not the 131 percent currently displayed.

Three options:

1. **Percent of 50 contracted.** Simplest. Overstates consumption in every month after an underused one.
2. **Percent of available**, where available equals 50 plus rollover carried in, capped at 10. Accurate. Requires stating the rollover rule on the page so the denominator is not mysterious.
3. **Both.** Percent of 50 as the primary figure, with available shown as a secondary reference band on the chart.

A second question sits underneath: does rollover compound. The clause says up to 10 unused hours can roll over to the following month. The conservative read is a flat cap of 10 carried at any time, not an accumulating bank. Implement the conservative read unless Josh rules otherwise.

**Overage display.** June reads 131 percent and July 111 percent against 50. Clause 6.1 makes overage a negotiated, quarterly-billed mechanism rather than a failure state. Decide whether over-100 months render in a distinct treatment with a note pointing at clause 6.1, or simply exceed the reference line without comment.

### Prompts

#### Prompt 03.1 — Strip SOW from the frontend

```
In moss-hours/index.html, remove every element that renders SOW or combined data.
Show me the full modified file before writing it.

Remove:
1. The Other column from the monthly overview table, all rows and the year-to-date
   row.
2. The Combined column from the monthly overview table, all rows and the
   year-to-date row.
3. The Combined hero figure in the header summary block.
4. The purple series from the Chart.js dataset configuration, and the purple
   legend swatch and label.
5. The Other column inside every expanded month panel, including every per-task
   line item, its bar, its hours value and its external link icon.
6. The right half of the two-column definition block, the one describing "Other".

Recompute the "for scale" comparison stat so it is derived from the retainer
hours total only, not the combined total. Keep the stat. Update its copy so the
number it cites matches the new source figure.

After this change the strings "Other", "Combined", "purple" and any hex value for
the purple series must not appear anywhere in index.html.

Success looks like: the page renders a single-series green chart, the monthly
table has exactly two data columns (Creative and percent), and no SOW task name
is visible anywhere on the page.
```

#### Prompt 03.2 — Build the Logged vs Reconstructed encoding

```
In moss-hours/index.html, replace the single green series with a stacked
three-series encoding. Show me the full modified file before writing it.

1. Locate the existing green hex value used for the Creative series. Reuse it
   verbatim for all three series. Do not introduce a second hue. If no green hex
   can be found, use #7EF893.

2. Build two canvas patterns using an offscreen canvas and
   CanvasRenderingContext2D.createPattern, both drawn in the green from step 1
   on a transparent background, both at 45 degrees:
   - documentedPattern: 3px stripe, 3px gap
   - estimatedPattern: 2px stripe, 5px gap

3. Configure three stacked Chart.js bar datasets in this stacking order, bottom
   to top: Logged (solid green), Documented (documentedPattern), Estimated
   (estimatedPattern). Read the values from each month's
   hours.logged, hours.documented and hours.estimated.

4. Build a legend with three entries. Each entry shows its swatch and a text
   label. The labels are exactly:
   - "Logged as it happened"
   - "Reconstructed, documented"
   - "Reconstructed, estimated"
   The legend must carry text, not swatches alone. The pattern is carrying the
   entire honesty claim of this report and it has to be readable in words.

5. Verify the pattern is legible at the bar width the chart actually renders at
   on a 1280px viewport, which is roughly 20px. If a 3px stripe fills solid at
   that width, reduce stripe density rather than switching to a different hue or
   a different pattern type.

6. Keep the existing 50-hour reference line exactly as it renders today.

Success looks like: January through May render as visibly striped stacked bars,
June through August render as solid bars, and all three legend entries are
readable at a 1280px viewport width.
```

#### Prompt 03.3 — Monthly table, combined helper, and rollover

```
Do not run this prompt until Josh has ruled on the rollover and overage open
decisions in Phase 03 of RUNDOC.md. If either ruling is missing, stop and ask.

In moss-hours/index.html, rebuild the monthly overview table.

Columns, left to right:
1. Month
2. Logged
3. Reconstructed
4. Total (the combined helper)
5. Percent of allowance

The Total column renders a value only when both Logged and Reconstructed are
non-zero for that month. When Reconstructed is zero, render an empty cell, not a
zero and not a dash. Silence is the signal that nothing needed adding.

The year-to-date row always renders all columns.

Implement the percent column according to Josh's ruling. Record the ruling as a
comment directly above the calculation, citing the SLA clause number it
implements.

Success looks like: January through May show a value in the Total column, June
through August show an empty Total cell, and every row's Logged plus Reconstructed
equals its Total to two decimals.
```

#### Prompt 03.4 — Static team block

```
In moss-hours/index.html, replace the dynamic contributor roster with a static
block.

Delete entirely:
1. Any roster.js import or reference
2. Any per-month contributor avatar stack
3. Any contributor count, queried or contributing
4. Any diagnostic warning state tied to contributor counts
5. Any code that reads a name, image, username, initials, email or avatar from
   the ClickUp API response

Build a static team block in the report header beneath the summary cards. It
renders a hardcoded array of team members defined inline in index.html:

  { name, title, image }

Images are served from /public/team/roster/<slug>.webp at 160px square. Name and
title render beneath each image. Caption: "Your team".

Josh supplies the array contents. Scaffold it with Josh Titus, Partner and
Creative Director, image /team/roster/titus.webp, and leave a clearly marked
TODO comment for the remaining members.

Every image tag carries loading="lazy", explicit width and height, and an onerror
handler that hides the element rather than rendering a broken image.

No hours, percentages, or contribution ordering appear anywhere in this block.

Success looks like: the team block renders from a hardcoded array, and a grep of
index.html for "clickup" returns nothing inside the team block code.
```

### Completion criteria

- [ ] `grep -i "other\|combined\|roster.js" index.html` returns nothing outside the Total helper column
- [ ] No SOW task name renders anywhere on the page
- [ ] The chart shows three stacked series in one hue, differentiated by pattern
- [ ] All three legend labels are readable at 1280px, 768px and 375px viewport widths
- [ ] January through May bars are visibly striped, June through August are solid
- [ ] The Total column is empty for every month where Reconstructed is zero
- [ ] Every table row's Logged plus Reconstructed equals its Total to two decimals
- [ ] The team block renders with no network call to ClickUp
- [ ] Breaking a team image path hides the element rather than rendering a broken image
- [ ] The "for scale" stat cites the retainer-only total, verified by arithmetic against the header figure

---

## Phase 04 — Report A copy and trust layer

The numbers are only half the deliverable. The page has to explain what it is, why five months are reconstructed, and what the retainer actually is, in language drawn from the signed agreement rather than from assertion.

### Context

The report's real audience is not only Andrea Murphy. Moss went through a leadership change and she requested this report as a defense in an internal budget conversation. Anything on the page will be read by people with no context and a stated interest in the outcome.

That makes contract-anchored language the right register throughout. Every claim the page makes should be traceable to a clause a reader can open and check.

Three anchors, in priority order:

**Clause 4.3.** "Client agrees to proactively use their retainer hours to ensure maximum value." This is the strongest line in the document. It establishes that high utilization is the contracted intent, not overreach. It reframes the entire report from an audit into a progress check against a shared goal.

**Clause 2.2.2.** Work on ongoing projects under existing agreements continues under those agreements. This is the firewall, stated in Moss's own signed language. It explains, without defensiveness, why this report contains only retainer work.

**The May 2026 process change.** Requests in May 2026 prompted this reconstruction effort. From June forward every piece of Moss retainer work gets a ClickUp task and time is logged weekly. State this as a date and a fact. It also explains why June and July run over 100 percent, which currently looks like an anomaly and is actually the first fully honest reporting.

Do not write anything claiming other Moss departments cannot request retainer work. The agreement does not say that. See the correction note in the contract facts section above.

### Prompts

#### Prompt 04.1 — Definition block rewrite

```
In moss-hours/index.html, rewrite the single remaining definition block in the
header.

It currently reads: "Creative — 50h per month. Retainer work, drawn against your
monthly allowance. Every percentage in this report is the share of that allowance
used."

Rewrite it to cover three things in plain language, in this order:

1. What the retainer is: 50 agency hours per month under a service level
   agreement running February 2025 to February 2027, with up to 10 unused hours
   rolling to the following month.
2. What this report contains and does not contain: retainer work only. Work
   running under a separate signed agreement is fulfilled under that agreement
   and does not draw on these hours. Reference clause 2.2.2 by number.
3. What the percentage means, stated to match whatever rollover ruling was
   implemented in Prompt 03.3.

Constraints:
- No em dashes or en dashes anywhere. Use commas, colons, periods or parentheses.
- No defensive framing. No apology. State facts.
- Do not claim or imply that any Moss department is barred from requesting
   retainer work. The agreement does not say that and the copy must not either.
- Under 90 words total.

Success looks like: a reader who has never seen the agreement understands what
they are looking at and what is excluded, and every factual claim maps to a
numbered clause.
```

#### Prompt 04.2 — Reconstruction note

```
In moss-hours/index.html, add a short note explaining the January through May
reconstruction. Place it directly beneath the chart, above the monthly table.

Content requirements:
1. State that January through May 2026 were rebuilt from records rather than
   tracked live.
2. State the two reconstruction classes in plain language. Documented means the
   hour traces to an existing record such as an invoice, a calendar event, an
   email thread or a dated work log. Estimated means the work happened and the
   figure comes from the team's direct knowledge of it.
3. State that requests in May 2026 prompted the change in process, and that from
   June 2026 forward every piece of retainer work is tracked to the minute as it
   happens.
4. Do not apologize. Do not use the words "unfortunately", "regrettably" or
   "sorry". The process changed and the record improved. That is the story.

No em dashes or en dashes. Under 120 words.

Success looks like: the striped bars on the chart are self-explanatory to a
reader who scrolls no further than this note.
```

#### Prompt 04.3 — Contract footer link

```
In moss-hours/index.html, add a footer link to the signed service level
agreement.

Josh will supply the hosted URL. Scaffold it with a constant named
SLA_DOCUMENT_URL set to an empty string, and render the link only when that
constant is non-empty. When empty, render nothing at all rather than a dead link.

Link text: "View the signed agreement"
Place it in the existing footer, alongside the foundingcreative.com link and the
data freshness timestamp.

Add a one-line label above or beside it identifying the document:
"Service Level Agreement, executed 27 February 2025"

Success looks like: with SLA_DOCUMENT_URL empty the footer renders exactly as it
does today, and with a URL set the link and its label appear.
```

### Completion criteria

- [ ] No em dash or en dash appears anywhere in `index.html` copy
- [ ] Every factual claim in the definition block maps to a numbered SLA clause
- [ ] No copy anywhere states or implies that a Moss department is barred from requesting retainer work
- [ ] The reconstruction note contains none of: "unfortunately", "regrettably", "sorry", "apologize"
- [ ] With `SLA_DOCUMENT_URL` empty, the footer is byte-identical to its pre-change state
- [ ] Definition block is under 90 words, reconstruction note is under 120 words

---

## Phase 05 — Report B data model

Report B is **Ad Hoc Creative Support**. It answers the question the non-creative Moss departments are actually asking, in the unit they actually bought, without touching the retainer.

### Context

Every figure in Report B comes from a signed SOW document. Nothing comes from time tracking. This is not a filtering decision, it is an architectural one. If Report B ever reads a ClickUp time entry, hours are one flag away from a client surface forever, and the separation depends on nobody ever flipping that flag.

The unit is days and dollars. Both are contract terms. Both already appear in every signed SOW and are already in Moss's possession. Hours never appear in Report B in any form, including internal fields, debug output, or code comments.

Reference SOW for shape: "SOW - Moss - 2026 Wood Summit v2", executed 20 January 2026. Budget table columns are Workstream, Line Item, Description, Days, Price. Line items priced at 0.5, 2, 0.5 and 0.25 days. Total 3.75 days, $4,500. Blended rate $1,200 per day.

Regions are the primary cut, not departments. Departments are org chart. Regions hold budget. A report organized by who pays maps to how decisions get made and is useful to the regional leads rather than only to Andrea.

### Data model

Committed to the repo at `data/sows.json`. Hand-maintained. Updated when a SOW is executed, not continuously.

```
{
  "id": "sow-2026-wood-summit",
  "name": "2026 Wood Summit",
  "status": "executed" | "drafting",
  "executedDate": "2026-01-20",
  "region": "energy",
  "regions": ["energy"],
  "department": "biz-strat",
  "totalDays": 3.75,
  "totalPrice": 4500,
  "lineItems": [
    { "workstream": "Strategy", "lineItem": "Creative Director", "days": 0.5, "price": 600 }
  ]
}
```

Region enum, exactly these values:

| Value | Label |
|---|---|
| `mid-florida` | Mid-Florida |
| `south-florida` | South Florida |
| `dfw` | Dallas/Fort Worth |
| `hawaii` | Hawaii |
| `energy` | Energy |
| `nashville` | Nashville |
| `corporate` | Corporate |
| `multi-region` | Multi-Region |

Attribution rules:

- A SOW serving exactly one named region gets that region in `region`, and `regions` contains that one value.
- A SOW serving two or more named regions gets `region: "multi-region"` and lists every member region in `regions`.
- A SOW serving no specific region, meaning org-wide or head-office work, gets `region: "corporate"` and `regions: ["corporate"]`.
- Energy is not a geography. Moss treats it as a business unit in the same way it treats a region, so it lives in the same enum.

Nashville is scaffolded ahead of execution. A SOW is in drafting. It appears in the data with `status: "drafting"`, `totalDays: 0`, `totalPrice: 0` and an empty `lineItems` array.

### Open decisions

None. Josh ruled: multi-region SOWs get a Multi-Region label rather than being split at the data layer. Even distribution is a frontend expansion, built in Phase 06, and may be removed after testing.

### Prompts

#### Prompt 05.1 — Build the SOW index

```
In the moss-hours repo, create a directory named data at the repo root, and
inside it create sows.json.

Structure it as a JSON object with two top-level keys:

{
  "regions": [ ...region definition objects... ],
  "sows": [ ...sow objects... ]
}

Region definition objects: { "value": <enum>, "label": <display label>,
"scaffolded": <boolean> }

Use exactly these eight region values and labels, in this order:
mid-florida / Mid-Florida / false
south-florida / South Florida / false
dfw / Dallas Fort Worth / false
hawaii / Hawaii / false
energy / Energy / false
nashville / Nashville / true
corporate / Corporate / false
multi-region / Multi-Region / false

SOW objects use this exact shape:

{
  "id": <kebab-case string>,
  "name": <string>,
  "status": "executed" | "drafting",
  "executedDate": <ISO date string, or null when drafting>,
  "region": <one region enum value>,
  "regions": <array of region enum values>,
  "department": <string>,
  "totalDays": <number>,
  "totalPrice": <number>,
  "lineItems": [ { "workstream": <string>, "lineItem": <string>,
                   "days": <number>, "price": <number> } ]
}

Seed the file with two entries.

First, the 2026 Wood Summit SOW, executed 2026-01-20, region energy, department
biz-strat, totalDays 3.75, totalPrice 4500, with these five line items:
  Strategy / Creative Director / 0.5 / 600
  Strategy / Art Director / 0.5 / 600
  Presentations / New Slide Creation / 2 / 2400
  Management / Project Coordinator / 0.5 / 600
  Management / Content Management / 0.25 / 300

Second, a Nashville placeholder with id nashville-creative-support, status
drafting, executedDate null, region nashville, regions ["nashville"], totalDays 0,
totalPrice 0, empty lineItems.

Add a validation script at scripts/validate-sows.js that checks, and exits
non-zero on any failure:
- Every sow.region is one of the eight enum values
- Every value in sow.regions is one of the eight enum values
- Any sow with region "multi-region" has two or more entries in regions
- Any sow with region other than "multi-region" has exactly one entry in regions,
  equal to region
- sow.totalDays equals the sum of its lineItems days, to two decimals
- sow.totalPrice equals the sum of its lineItems prices, exactly
- Any sow with status "drafting" has totalDays 0, totalPrice 0 and empty lineItems
- The strings "hour", "hours" and "hourly" do not appear anywhere in sows.json,
  case-insensitive

Run the script and show me the output.

Success looks like: node scripts/validate-sows.js exits zero and prints a summary
line per SOW.
```

### Completion criteria

- [ ] `data/sows.json` exists with the two seed entries and eight region definitions
- [ ] `node scripts/validate-sows.js` exits zero
- [ ] Deliberately corrupting `totalDays` on the Wood Summit entry causes the validator to exit non-zero
- [ ] Adding the word "hours" anywhere in `sows.json` causes the validator to exit non-zero
- [ ] No file under `data/` or `scripts/validate-sows.js` imports anything from `api/time.js`
- [ ] `grep -ri "clickup" data/ scripts/validate-sows.js` returns nothing

---

## Phase 06 — Report B frontend

A separate page. Days and dollars by region. Never hours.

### Context

Nashville must read as deliberately scaffolded rather than as a bug or an oversight. The scaffolded state is a credibility move: it shows the report anticipates rather than reacts. It has to be honest without needing a sentence of explanation, which means the visual state itself has to carry the meaning.

The Multi-Region expansion is experimental. Josh wants it built to test it and may remove it. That means it must be cleanly separable: one toggle, one function, no changes to the underlying data, and removal should touch nothing else.

### Prompts

#### Prompt 06.1 — Regional view

```
In the moss-hours repo, create report-b.html at the repo root. Do not modify
index.html. Do not import from api/time.js.

Build a self-contained page titled "Ad Hoc Creative Support" that reads
data/sows.json and renders:

1. A header summary: total executed SOWs, total days scoped, total invested in
   dollars. Executed SOWs only. Drafting SOWs are excluded from every total.

2. A regional breakdown, one row per region in the order defined in
   sows.json regions. Each row shows region label, SOW count, total days, total
   dollars.

3. An expandable panel per region listing its SOWs by name, executed date, days
   and price. Expanding a SOW shows its line items with workstream, line item,
   days and price.

Hard constraints:
- The strings "hour", "hours" and "hourly" must not appear anywhere in
  report-b.html, including comments.
- No fetch, import, or reference to any ClickUp endpoint, folder id, task id,
  time entry, or api/time.js.
- Match the visual language of index.html: same fonts, same background, same
  card and table treatments. Do not reuse the green retainer series color for
  region bars. Pick a neutral from the existing palette.

Success looks like: the page renders one row per region, Wood Summit appears
under Energy with 3.75 days and $4,500, and a grep of report-b.html for "hour"
returns nothing.
```

#### Prompt 06.2 — Nashville scaffolded state

```
In moss-hours/report-b.html, give any region whose definition has scaffolded true
a distinct empty state.

Requirements:
1. The Nashville row renders in the table at its defined position. It is never
   hidden and never sorted to the bottom.
2. Its days and dollars cells render an em-free placeholder, not a zero.
3. It carries an inline label reading exactly: "SOW in drafting"
4. It renders at reduced opacity relative to executed regions, with a dashed
   rather than solid row border.
5. It is excluded from every total in the header summary and from any chart
   scaling.
6. Its expandable panel, if opened, states that no SOW has been executed for this
   region yet.

The visual state must communicate "planned, not yet started" without any reader
needing a caption to interpret it. Verify this by looking at the rendered row and
confirming it could not be mistaken for a region with zero activity.

Success looks like: Nashville is visible, obviously distinct from every other
row, and contributes nothing to any total.
```

#### Prompt 06.3 — Multi-Region even distribution toggle

```
In moss-hours/report-b.html, add an experimental toggle for Multi-Region
distribution.

This feature is on trial and may be removed. Build it so removal touches nothing
else: one toggle element, one pure function, one call site. Wrap all three in
comments reading EXPERIMENTAL: MULTI-REGION DISTRIBUTION START and
EXPERIMENTAL: MULTI-REGION DISTRIBUTION END so it can be deleted by cutting
between the markers.

Behavior:
1. A toggle labeled "Distribute Multi-Region evenly", off by default.
2. When on, every SOW with region "multi-region" has its totalDays and totalPrice
   divided evenly across the regions listed in its regions array, and those
   fractions are added to each member region's row totals.
3. When on, the Multi-Region row itself renders zero totals and a label reading
   "Distributed across N regions".
4. The function that performs this must be pure. It takes the parsed sows array
   and returns a new derived structure. It must not mutate the source data or
   write anything back to data/sows.json.
5. Toggling on and then off must return every displayed figure to its exact
   original value. Verify this by comparing rendered totals before and after a
   round trip.
6. Rounding: divide to two decimals for days and to whole cents for dollars.
   Assign any remainder from rounding to the first region in the regions array
   so the distributed total always equals the original total exactly.

Success looks like: toggling on redistributes Multi-Region totals into member
regions, the grand total is unchanged to the cent, and toggling off restores
every figure exactly.
```

### Completion criteria

- [ ] `grep -i "hour" report-b.html` returns nothing
- [ ] `grep -i "clickup\|time_entries\|9011" report-b.html` returns nothing
- [ ] Wood Summit renders under Energy at 3.75 days and $4,500
- [ ] Nashville renders visibly, reads as planned rather than empty, and contributes zero to all totals
- [ ] With the distribution toggle on, the grand total in days and dollars is unchanged to the cent
- [ ] Toggling distribution on then off restores every rendered figure to its exact original value
- [ ] Deleting everything between the two EXPERIMENTAL comment markers leaves a working page

---

## Phase 07 — Teardown and go-live

### Context

The fixture task is inside a retainer folder on a realtime feed. While it exists, January 2026 reads roughly 688 hours against a 50-hour allowance if the client opens the report. Removing it is the last gate.

The connector cannot delete time entries. Josh removes them by hand in the ClickUp UI, on the Time tracked panel of [task `868kmdh0u`](https://app.clickup.com/t/868kmdh0u).

### Prompts

#### Prompt 07.1 — Pre-teardown verification

```
Before Josh deletes the fixture entries, capture a baseline. Call the deployed
moss-hours API for year 2026 and record:

1. Every month's hours.logged, hours.documented, hours.estimated and total
2. Year-to-date logged, documented, estimated and total
3. The full item list for January

Save this output to _archive/2026-08-04-v1-report/pre-teardown-baseline.json
with a comment header stating it includes the 666h fixture on task 868kmdh0u.

Do not modify any application file.

Success looks like: the baseline file exists and January total is at least 666.
```

#### Prompt 07.2 — Post-teardown acceptance

```
After Josh confirms the fixture entries are deleted from ClickUp task 868kmdh0u,
call the deployed moss-hours API for year 2026 and verify every item below.
Report pass or fail per item. Do not fix anything, report and stop.

1. Task id 868kmdh0u does not appear in any month's item list
2. January total equals the pre-teardown January total minus exactly 666
3. February 2026 total is materially above 7h 38m, confirming assignee scoping
4. Every month satisfies total equals logged plus documented plus estimated, to
   two decimals
5. For every month, the sum of item hours equals that month's header total to two
   decimals
6. No task id appears twice within one month
7. The response contains no field named other, combined, sow, description, email,
   username, initials, avatar or profilePicture at any nesting level
8. The string [RECON: appears nowhere in the response
9. ?debug=1 returns a response and the normal response contains no debug key
10. A time entry logged at 11pm Denver on the last day of a month resolves to
    that month

Success looks like: ten passes.
```

### Completion criteria

- [ ] Fixture task `868kmdh0u` returns no time entries
- [ ] Fixture task is deleted or archived out of the retainer folder
- [ ] All ten items in Prompt 07.2 pass
- [ ] The live page at moss.foundingcreative.com shows no SOW data and no combined figure
- [ ] Report A renders correctly at 375px, 768px and 1280px viewport widths
- [ ] `_archive/` is present in the repo and absent from the deployed file list

---

## Carried forward, not in scope for this build

Recorded so they are not lost. Do not build these without a scope change.

**Appendix A benchmarking.** The SLA publishes an Hourly Cost Estimate range for 22 service types, from 2 to 4 hours for social content design up to 20 to 30 hours for interactive touchscreen applications. Mapping reconstructed line items to those service types would let the report show that an estimated figure lands inside a range Moss already signed. That converts an estimate from a judgment call into a contract-anchored figure. It is the strongest available upgrade to the reconstruction's defensibility and it belongs in a later version.

**Contract year versus calendar year.** The report shows calendar 2026. The agreement runs February 2025 to February 2027. Renewal conversations begin August 2026 and close October 2026. A contract-year view may be the more useful frame for that conversation. The year toggle already exists in the UI.

**Forfeiture at term end.** Clause 4.2 forfeits unused hours at end of term, February 2027. Combined with clause 4.3, a countdown of remaining contracted hours is a legitimate and client-favorable thing to surface as renewal approaches.

**Overage reconciliation.** Clause 6.1 makes hours beyond the retainer negotiable as quarterly-billed supplemental overages. June and July 2026 both exceeded 100 percent. Whether those are billed, absorbed, or applied against rollover is a business decision that has not been made.

---

## Decisions log

### v1.0 — Rundoc created (4 August 2026)

- Decided: one report becomes two, sourced separately. Report A reads ClickUp retainer folders only. Report B reads signed SOW contracts only. No code path connects Report B to time tracking.
- Decided: the Other column, the Combined header figure and all per-task SOW line items come off the client surface entirely.
- Decided: Combined is demoted from a header consolidation to a per-row helper that renders only where Logged and Reconstructed both exist.
- Decided: Logged versus Reconstructed is encoded in one hue with pattern density, not a second color. Purple was too high a contrast for what is a distinction within retainer hours rather than between two kinds of work.
- Decided: dynamic contributor roster, `roster.js`, the fuzzy-matching generator, per-month contributor stacks and the contributor diagnostic are all cut. Replaced with a static team block.
- Decided: the `&assignee=` API parameter stays and is required. It is a different mechanism from the roster and cutting it would reintroduce the original defect.
- Decided: classification reads ClickUp tags first, description prefix second, absence equals Logged. Two write paths need two levers because the API connector cannot attach tags.
- Decided: ClickUp tag names are `documented` and `estimate`, used verbatim.
- Decided: v1 is archived as git tag `v1-final-2026-08-04` plus a zipped copy under `_archive/`, excluded from deploys via `.vercelignore`.
- Decided: Report B is cut by region, not department. Regions hold budget.
- Decided: multi-region SOWs get a Multi-Region label rather than being split at the data layer. Even distribution is an experimental frontend toggle, removable by cutting between comment markers.
- Decided: Nashville is scaffolded in the data and visually distinct on the frontend, honest without a caption.
- Corrected: the SLA does not restrict retainer hours to Andrea Murphy or to the creative department. The signatory is Justin Sligh, Senior Director, Marketing. Clause 2.2 is a contract boundary, not a departmental one. Copy must not claim otherwise.
- Open: rollover treatment under clause 4.1, and overage display under clause 6.1. Both block Prompt 03.3.
