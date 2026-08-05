/* Minted from the "Moss Hours Report" OAuth app in ClickUp, so this project
   holds its own revocable credential. ClickUp issues exactly one personal token
   per user account, which meant every project built against that account shared
   one key that could not be rotated independently. CLICKUP_TOKEN is that shared
   personal token and stays as a fallback so a deploy cannot land before the new
   variable is set. Remove it from this project once the new one is confirmed. */
const CLICKUP_TOKEN = process.env.MOSS_CLICKUP_TOKEN || process.env.CLICKUP_TOKEN;
const WORKSPACE_ID = '9011561475';

/* How long a response may be served from Vercel's CDN, which is what keeps a
   page load off ClickUp entirely. The current year moves, so it is held briefly
   and then served stale while it revalidates in the background: a reader gets
   an instant copy at most a few minutes old and never waits on ClickUp. A past
   year cannot change, so it is held for a day. */
const CACHE_CURRENT_YEAR = 's-maxage=300, stale-while-revalidate=3600';
const CACHE_PAST_YEAR = 's-maxage=86400, stale-while-revalidate=604800';

// Workspace membership changes a couple of times a year, so it is held between
// invocations of a warm function rather than refetched on every request.
const MEMBER_CACHE_MS = 10 * 60 * 1000;

// Monthly retainer allowance, in hours. Clause 3.1 of the service level
// agreement: 50 agency hours per month across a 24 month term.
const RETAINER_BUDGET_HOURS = 50;

/* The two Moss Creative Retainer folders, and the only two folders this report
   is allowed to see. Everything else in the workspace is discarded before it
   reaches a bucket, which is what keeps work running under a separate signed
   agreement off the client's surface. This list is the whole firewall, so treat
   widening it as a contract question rather than a code change. */
const RETAINER_FOLDER_IDS = ['90114447278', '90116369473'];

// The agency works out of Denver. Vercel runs in UTC, so months have to be
// resolved against Denver's offset or late-evening work lands on the next day
// and anything near a month boundary lands in the wrong month.
const TIMEZONE = 'America/Denver';

// Entries can start just outside the requested year in UTC yet still resolve
// into it in Denver, so each fetch window is padded and denverYM decides.
const BOUNDARY_PAD_MS = 48 * 60 * 60 * 1000;

// Tasks below this are rolled into a single aggregated row rather than filling
// the report with one and two minute entries.
const AGGREGATE_THRESHOLD_HOURS = 0.25;
const AGGREGATE_ROW_NAME = 'Additional retainer support';

const NO_TASK_KEY = '__no_task__';
const NO_TASK_NAME = '(no task)';

/* Reconstruction markers. January through May 2026 were not tracked as they
   happened and are being rebuilt from real sources, so an entry has to be able
   to say which of the three classes it belongs to.

   Two write paths need two levers. A person logging time by hand in the ClickUp
   UI applies a time entry tag. The API connector used for bulk writes cannot
   attach tags at all: it sends them as plain strings where ClickUp expects
   objects, and the tagged write fails after the entry already exists. So a
   programmatic write carries its marker as a description prefix instead.

   The tag names are the ones that exist in the workspace, used verbatim. Note
   the second is `estimate`, not `estimated`. */
const TAG_DOCUMENTED = 'documented';
const TAG_ESTIMATED = 'estimate';
const PREFIX_DOCUMENTED = '[RECON:DOC]';
const PREFIX_ESTIMATED = '[RECON:EST]';

const DENVER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
});

// Built from a parts map rather than formatToParts array order, which is not
// guaranteed across engines.
function denverYM(ms) {
  const p = Object.fromEntries(
    DENVER.formatToParts(new Date(ms)).map((x) => [x.type, x.value])
  );
  return { year: +p.year, month: +p.month - 1 };
}

/* The current year in Denver, not in UTC. Vercel runs in UTC, so for the last
   several hours of 31 December `new Date().getFullYear()` already reports next
   year. That decides how long a response is cached, and a year cached for a day
   does not quietly self-correct the way a live request did. */
function currentDenverYear() {
  return denverYM(Date.now()).year;
}

async function clickup(path) {
  const res = await fetch(`https://api.clickup.com/api/v2${path}`, {
    headers: {
      Authorization: CLICKUP_TOKEN,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const err = new Error(`ClickUp API error ${res.status}`);
    err.status = res.status;
    err.detail = await res.text();
    throw err;
  }
  return res.json();
}

// /team/{id}/time_entries silently scopes to the token holder unless assignee
// is supplied, which hid every other team member's hours for five months.
// Resolved per request rather than hardcoded, so people joining or leaving need
// no code change.
let memberCache = null;

async function fetchMemberIds() {
  if (memberCache && Date.now() - memberCache.at < MEMBER_CACHE_MS) {
    return memberCache.ids;
  }
  const { teams } = await clickup('/team');
  const team = (teams || []).find((t) => String(t.id) === WORKSPACE_ID);
  if (!team) throw new Error(`Workspace ${WORKSPACE_ID} not visible to this token`);
  const ids = (team.members || [])
    // `members[].user.id` is the documented v2 shape; the bare `id` fallback
    // guards against the flattened variant some responses use.
    .map((m) => m?.user?.id ?? m?.id)
    .filter((id) => id !== null && id !== undefined)
    .map(String);
  const unique = [...new Set(ids)];
  // Cached only on success, so a failed lookup is never remembered.
  memberCache = { at: Date.now(), ids: unique };
  return unique;
}

// ClickUp caps how many entries one time_entries call returns. With every
// member included the payload roughly triples, so the year is walked a month at
// a time and the results merged. Windows overlap by the boundary pad, hence the
// de-duplication by entry id.
async function fetchYearEntries(year, assignee) {
  // An empty assignee list would scope the query back to the token holder,
  // which is the bug this parameter exists to fix, so omit it instead.
  const scope = assignee ? `&assignee=${assignee}` : '';

  /* Issued together rather than one after another. Walking the year serially
     meant twelve round trips end to end before the first byte, which was the
     bulk of a cold response. Twelve at once is well inside ClickUp's per-minute
     rate limit. */
  const pages = await Promise.all(
    Array.from({ length: 12 }, (_, m) => {
      const start = Date.UTC(year, m, 1) - BOUNDARY_PAD_MS;
      const end = Date.UTC(year, m + 1, 1) - 1 + BOUNDARY_PAD_MS;
      return clickup(
        `/team/${WORKSPACE_ID}/time_entries?start_date=${start}&end_date=${end}${scope}`
      );
    })
  );

  // Merged in month order, so an entry landing in two overlapping windows is
  // kept from the earlier one exactly as it was when this ran serially.
  const seen = new Set();
  const entries = [];
  for (const page of pages) {
    for (const entry of page?.data || []) {
      const id = String(entry?.id ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      entries.push(entry);
    }
  }
  return entries;
}

/* Entries that carried both markers. An entry claiming to be documented and
   estimated at once is a data problem someone has to go and fix, so it is
   surfaced under ?debug=1 rather than resolved quietly.

   Module level because a handler is not the only thing that reads it, and
   cleared at the top of every request: a warm function would otherwise carry
   one request's conflicts into the next and grow this array without bound. */
let classificationConflicts = [];

/* Logged, documented or estimated, in that precedence. Tags first because they
   are what a person applies by hand and therefore the more deliberate signal;
   the description prefix second because it is what the bulk connector can
   manage.

   Absence is the logged state, deliberately. It means none of the correctly
   logged hours have to be touched, and a forgotten marker defaults to the
   truthful class rather than inflating the reconstruction. */
function classifyEntry(entry) {
  const tags = Array.isArray(entry?.tags) ? entry.tags : [];
  const hasTag = (wanted) => tags.some((t) => t?.name === wanted);

  const documented = hasTag(TAG_DOCUMENTED);
  const estimated = hasTag(TAG_ESTIMATED);
  if (documented && estimated) {
    classificationConflicts.push(String(entry?.id ?? ''));
    return 'documented';
  }
  if (documented) return 'documented';
  if (estimated) return 'estimated';

  const description = typeof entry?.description === 'string' ? entry.description : '';
  if (description.startsWith(PREFIX_DOCUMENTED)) return 'documented';
  if (description.startsWith(PREFIX_ESTIMATED)) return 'estimated';

  return 'logged';
}

const emptyHours = () => ({ logged: 0, documented: 0, estimated: 0 });

/* Debug view. Deliberately narrow: a raw ClickUp entry carries the logger's
   username, email and avatar, and the description carries the reconstruction
   markers, so nothing raw is ever echoed. */
function buildDebug(entries, memberIds, discarded, folderIdOf) {
  const sample = entries[0] || null;
  return {
    queriedCount: memberIds.length,
    totalEntries: entries.length,
    discardedEntries: discarded.count,
    discardedHours: Math.round(discarded.hours * 100) / 100,
    classificationConflicts,
    sampleResolved: sample
      ? {
          folderId: folderIdOf(sample),
          inRetainer: RETAINER_FOLDER_IDS.includes(folderIdOf(sample)),
          denverMonth: denverYM(parseInt(sample.start)),
          classification: classifyEntry(sample),
          hasTask: Boolean(sample?.task?.id),
        }
      : null,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  // Replaced below once the year is known. A preflight is never worth caching,
  // and neither is anything that falls over before it gets there.
  res.setHeader('Cache-Control', 'no-store, max-age=0');

  if (req.method === 'OPTIONS') return res.status(200).end();

  classificationConflicts = [];

  const year = parseInt(req.query.year) || currentDenverYear();

  /* Cached at Vercel's CDN rather than in a database: the response states its
     own window and the edge does the rest, so a page load costs nothing at
     ClickUp until the window lapses. `fresh` is what the report's refresh
     button sends and `debug` is a diagnostic, so both stay a real round trip.
     The browser is sent max-age=0 and revalidates every time; Vercel strips the
     shared-cache directives on the way out. */
  const live = Boolean(req.query.fresh || req.query.debug);
  if (!live) {
    const window = year < currentDenverYear() ? CACHE_PAST_YEAR : CACHE_CURRENT_YEAR;
    res.setHeader('Cache-Control', `public, max-age=0, ${window}`);
  }

  try {
    const memberIds = await fetchMemberIds();
    const assignee = memberIds.join(',');
    const entries = await fetchYearEntries(year, assignee);

    // ClickUp's v2 /team/{id}/time_entries returns each entry with a
    // `task_location: { list_id, folder_id, space_id }` object, so
    // task_location.folder_id is the canonical field. The fallbacks below
    // guard against shape differences. Hit /api/time?debug=1 in production
    // to dump a resolved entry and confirm the mapping against live data.
    const folderIdOf = (entry) =>
      String(
        entry?.task_location?.folder_id ||
          entry?.task_location?.folder?.id ||
          entry?.folder?.id ||
          entry?.list?.folder?.id ||
          ''
      );

    // Deep link back to the source of truth. `task_url` is returned by ClickUp
    // directly; the /t/{id} form is a stable fallback that resolves for any task.
    const taskUrlOf = (entry) => {
      if (entry?.task_url) return String(entry.task_url);
      const id = entry?.task?.id;
      return id ? `https://app.clickup.com/t/${id}` : null;
    };

    /* One bucket per month, each holding a per-task tally split three ways.
       Keyed on ClickUp task id: this workspace has several distinct tasks
       sharing a name, which keying on name silently merged, and a rename split
       one task's history in two. */
    const months = Array.from({ length: 12 }, () => new Map());

    const discarded = { count: 0, hours: 0 };
    let skippedEntries = 0;

    for (const entry of entries) {
      const startTs = parseInt(entry.start);
      if (!Number.isFinite(startTs)) {
        skippedEntries += 1;
        continue;
      }

      // Running timers report a negative duration; they are not elapsed work.
      const durationMs = parseInt(entry.duration);
      if (!Number.isFinite(durationMs) || durationMs < 0) {
        skippedEntries += 1;
        continue;
      }

      const { year: entryYear, month } = denverYM(startTs);
      if (entryYear !== year) continue;

      const hours = durationMs / 3600000;

      /* Anything outside the retainer folders is dropped here and never
         bucketed, so it cannot reach a total by any later route. */
      if (!RETAINER_FOLDER_IDS.includes(folderIdOf(entry))) {
        discarded.count += 1;
        discarded.hours += hours;
        continue;
      }

      const taskId = entry?.task?.id ? String(entry.task.id) : null;
      const key = taskId || NO_TASK_KEY;
      const bucket = months[month];

      let task = bucket.get(key);
      if (!task) {
        // Orphaned timers carry no task object; they collapse into one row
        // rather than one row per entry.
        task = {
          id: taskId,
          name: taskId ? entry?.task?.name || '(untitled task)' : NO_TASK_NAME,
          url: taskId ? taskUrlOf(entry) : null,
          listId: entry?.task_location?.list_id ? String(entry.task_location.list_id) : null,
          hours: emptyHours(),
        };
        bucket.set(key, task);
      }

      /* Accumulated raw and rounded once on the way out. Rounding each entry as
         it lands would drift a month's total away from the entries that make it
         up by a cent of an hour at a time. */
      task.hours[classifyEntry(entry)] += hours;
    }

    const round = (n) => Math.round(n * 100) / 100;

    const roundHours = (h) => {
      const out = {
        logged: round(h.logged),
        documented: round(h.documented),
        estimated: round(h.estimated),
      };
      // Derived from the rounded parts, not from the raw ones, so a reader who
      // adds up the three figures on screen gets the total printed beside them.
      return {
        hours: out,
        reconstructed: round(out.documented + out.estimated),
        total: round(out.logged + out.documented + out.estimated),
      };
    };

    /* Every task stays in the total. Anything under the threshold is rolled
       into one trailing row, so the visible rows always sum to the header
       rather than quietly dropping short entries. */
    const toItems = (map) => {
      const all = [...map.values()].map((t) => ({
        id: t.id,
        name: t.name,
        url: t.url,
        listId: t.listId,
        ...roundHours(t.hours),
      }));

      const items = all
        .filter((t) => t.total >= AGGREGATE_THRESHOLD_HOURS)
        .sort((a, b) => b.total - a.total);

      const small = all.filter((t) => t.total < AGGREGATE_THRESHOLD_HOURS && t.total > 0);
      if (small.length) {
        const summed = small.reduce((acc, t) => {
          acc.logged += t.hours.logged;
          acc.documented += t.hours.documented;
          acc.estimated += t.hours.estimated;
          return acc;
        }, emptyHours());
        items.push({
          id: null,
          name: AGGREGATE_ROW_NAME,
          url: null,
          listId: null,
          count: small.length,
          aggregated: true,
          ...roundHours(summed),
        });
      }
      return items;
    };

    /* A month's header is the sum of the rows printed under it, each already
       rounded, so the drawer can never disagree with the row it hangs from. */
    const sumItems = (items) =>
      roundHours(
        items.reduce((acc, t) => {
          acc.logged += t.hours.logged;
          acc.documented += t.hours.documented;
          acc.estimated += t.hours.estimated;
          return acc;
        }, emptyHours())
      );

    const monthsOut = months.map((bucket, i) => {
      const items = toItems(bucket);
      return { month: i, ...sumItems(items), items };
    });

    const yearTotals = sumItems(
      monthsOut.map((m) => ({ hours: m.hours }))
    );

    return res.status(200).json({
      year,
      timezone: TIMEZONE,
      retainerBudget: RETAINER_BUDGET_HOURS,
      /* When this payload was pulled from ClickUp, which since the response is
         cached is not the same as when the request arrived. That is the point:
         the report shows it as "last updated", so a cached copy states its real
         age rather than claiming to be current. */
      generatedAt: new Date().toISOString(),
      months: monthsOut,
      totals: yearTotals,
      ...(req.query.debug
        ? { debug: buildDebug(entries, memberIds, discarded, folderIdOf) }
        : {}),
      memberCount: memberIds.length,
      totalEntries: entries.length,
      skippedEntries,
    });
  } catch (e) {
    // A failure is never cached, at the edge or in the browser. Vercel would
    // not cache a 5xx anyway; this also stops the header set above from
    // reaching the client attached to an error body.
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    const status = e.status && e.status >= 400 ? 502 : 500;
    return res.status(status).json({ error: e.message, detail: e.detail });
  }
}
