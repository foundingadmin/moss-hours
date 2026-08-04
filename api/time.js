import { ROSTER, STUDIO_FALLBACK } from '../roster.js';

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

// Monthly Creative retainer budget, in hours (used for % / meter figures).
const RETAINER_BUDGET_HOURS = 50;

const FOLDER_IDS = {
  retainer: ['90114447278', '90116369473'],
  sow: ['90117343728', '90117412643'],
};

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

const NO_TASK_KEY = '__no_task__';
const NO_TASK_NAME = '(no task)';

const DENVER = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

// Built from a parts map rather than formatToParts array order, which is not
// guaranteed across engines. The day is carried as well as the month: it is
// what lets the report show where inside a month the work actually landed.
function denverYM(ms) {
  const p = Object.fromEntries(
    DENVER.formatToParts(new Date(ms)).map((x) => [x.type, x.value])
  );
  return { year: +p.year, month: +p.month - 1, day: +p.day };
}

/* The current year in Denver, not in UTC. Vercel runs in UTC, so for the last
   several hours of 31 December `new Date().getFullYear()` already reports next
   year. That decides which roster members are dropped and how long a response
   is cached, and a year cached for a day does not quietly self-correct the way
   a live request did. */
function currentDenverYear() {
  return denverYM(Date.now()).year;
}

// Days in a month, so a day series is exactly as long as its month.
function daysInMonth(year, month) {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
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
// is supplied, which hid every other team member's hours. Resolved per request
// rather than hardcoded, so people joining or leaving need no code change.
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

/* Debug view. Deliberately narrow: a raw ClickUp entry carries the logger's
   username and email, so nothing raw is echoed. rosterCoverage is how we learn
   somebody needs adding to roster.js. */
function buildDebug(entries, memberIds, contributingIds, unrosteredIds, folderIdOf, taskUrlOf) {
  const sample = entries[0] || null;
  const rostered = contributingIds.size - unrosteredIds.length;
  return {
    memberIds,
    queriedCount: memberIds.length,
    totalEntries: entries.length,
    unrosteredContributorIds: unrosteredIds,
    rosterCoverage: `${rostered}/${contributingIds.size}`,
    sampleResolved: sample
      ? {
          folderId: folderIdOf(sample),
          taskUrl: taskUrlOf(sample),
          denverMonth: denverYM(parseInt(sample.start)),
          hasTask: Boolean(sample?.task?.id),
          hasUser: Boolean(sample?.user?.id),
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
    // to dump a raw entry and confirm the mapping against live data.
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


    // One bucket per month, each holding a per-task tally for the Creative
    // (retainer) and Non-Creative (SOW) categories. Keyed on ClickUp task id:
    // this workspace has several distinct tasks sharing a name, which keying on
    // name silently merged, and a rename split one task's history in two.
    const months = Array.from({ length: 12 }, (_, m) => ({
      retainerTasks: new Map(),
      sowTasks: new Map(),
      contributors: new Set(),
      // Per-day totals, indexed by day-of-month minus one. Entries are placed
      // by their start day in Denver, the same rule the month buckets use.
      retainerDaily: new Array(daysInMonth(year, m)).fill(0),
      sowDaily: new Array(daysInMonth(year, m)).fill(0),
    }));
    const contributingIds = new Set();
    let unmatchedEntries = 0;
    let unmatchedHours = 0;
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

      const { year: entryYear, month, day } = denverYM(startTs);
      if (entryYear !== year) continue;

      const hours = durationMs / 3600000;
      const fid = folderIdOf(entry);

      let bucket, daily;
      if (FOLDER_IDS.retainer.includes(fid)) {
        bucket = months[month].retainerTasks;
        daily = months[month].retainerDaily;
      } else if (FOLDER_IDS.sow.includes(fid)) {
        bucket = months[month].sowTasks;
        daily = months[month].sowDaily;
      } else {
        unmatchedEntries += 1;
        unmatchedHours += hours;
        continue;
      }

      // Orphaned timers carry no task object; they collapse into one row rather
      // than one row per entry.
      // Who logged it. Ids only: names, titles and images come from the roster,
      // never from ClickUp, so a renamed account cannot reach the client.
      const userId = entry?.user?.id !== undefined && entry?.user?.id !== null
        ? String(entry.user.id) : null;
      if (userId) {
        months[month].contributors.add(userId);
        contributingIds.add(userId);
      }

      if (daily && day >= 1 && day <= daily.length) daily[day - 1] += hours;

      const taskId = entry?.task?.id ? String(entry.task.id) : null;
      const key = taskId || NO_TASK_KEY;
      const existing = bucket.get(key);
      if (existing) {
        existing.hours += hours;
      } else {
        bucket.set(key, {
          id: taskId,
          name: taskId ? entry?.task?.name || '(untitled task)' : NO_TASK_NAME,
          hours,
          url: taskId ? taskUrlOf(entry) : null,
          listId: entry?.task_location?.list_id ? String(entry.task_location.list_id) : null,
        });
      }
    }

    /* Resolve contributing ids to display metadata through ROSTER only. A
       contributor with no roster entry collapses into a single studio entry,
       never one per unknown person, and their real id never reaches the client
       through `team`. Inactive people still resolve for past years so historical
       reports stay accurate, but drop off the current year's strip. */
    const CURRENT_YEAR = currentDenverYear();
    const unrosteredIds = [...contributingIds].filter((id) => !ROSTER[id]).sort();
    const team = [];
    for (const id of [...contributingIds].sort()) {
      const person = ROSTER[id];
      if (!person) continue;
      if (person.active === false && year === CURRENT_YEAR) continue;
      team.push({
        id,
        name: person.name,
        title: person.title || '',
        roster: person.roster,
        stack: person.stack,
        isStudio: false,
      });
    }
    team.sort((a, b) => a.name.localeCompare(b.name));
    if (unrosteredIds.length) {
      team.push({
        id: 'studio',
        name: STUDIO_FALLBACK.name,
        title: STUDIO_FALLBACK.title,
        roster: STUDIO_FALLBACK.roster,
        stack: STUDIO_FALLBACK.stack,
        isStudio: true,
      });
    }

    const round = (n) => Math.round(n * 100) / 100;

    // Every task stays in the total. Anything under the threshold is rolled into
    // one trailing row, so the visible rows always sum to the header rather than
    // quietly dropping short entries as the old filter did.
    const toItems = (map, aggregateName) => {
      const all = [...map.values()].map((t) => ({ ...t, hours: round(t.hours) }));

      const items = all
        .filter((t) => t.hours >= AGGREGATE_THRESHOLD_HOURS)
        .sort((a, b) => b.hours - a.hours);

      const small = all.filter((t) => t.hours < AGGREGATE_THRESHOLD_HOURS && t.hours > 0);
      const aggregateHours = round(small.reduce((sum, t) => sum + t.hours, 0));

      if (aggregateHours > 0) {
        items.push({
          id: null,
          name: aggregateName,
          hours: aggregateHours,
          url: null,
          listId: null,
          count: small.length,
          aggregated: true,
        });
      }
      return items;
    };

    // The header is the sum of what is actually listed, so a month's rows always
    // reconcile against its total instead of drifting by rounding.
    const sumItems = (items) => round(items.reduce((sum, t) => sum + t.hours, 0));

    const monthsOut = months.map((mo, i) => {
      const retainerItems = toItems(mo.retainerTasks, 'Other retainer support');
      const sowItems = toItems(mo.sowTasks, 'Other project support');
      return {
        month: i,
        retainerHours: sumItems(retainerItems),
        sowHours: sumItems(sowItems),
        retainerItems,
        sowItems,
        // Ids only. The frontend resolves them through the roster and collapses
        // every unrostered id onto one studio avatar.
        contributorIds: [...mo.contributors].sort(),
        // One entry per day of the month. Rounded like every other figure, so
        // the day series sums to within a rounding step of the month's total.
        retainerDaily: mo.retainerDaily.map(round),
        sowDaily: mo.sowDaily.map(round),
      };
    });

    return res.status(200).json({
      year,
      timezone: TIMEZONE,
      retainerBudget: RETAINER_BUDGET_HOURS,
      /* queried is how many assignees the time_entries call covered; contributing
         is how many of them actually logged matched time. contributing === 1
         while queried > 1 is the exact regression that hid the team for five
         months, and the report renders that state as broken on sight. */
      contributors: {
        queried: memberIds.length,
        contributing: contributingIds.size,
      },
      team,
      ...(req.query.debug ? { debug: buildDebug(entries, memberIds, contributingIds, unrosteredIds, folderIdOf, taskUrlOf) } : {}),
      /* When this payload was pulled from ClickUp, which since the response is
         cached is not the same as when the request arrived. That is the point:
         the report shows it as "last updated", so a cached copy states its real
         age rather than claiming to be current. */
      generatedAt: new Date().toISOString(),
      months: monthsOut,
      // Flat aggregates kept for convenience / back-compat.
      retainer: monthsOut.map((m) => m.retainerHours),
      sow: monthsOut.map((m) => m.sowHours),
      memberCount: memberIds.length,
      totalEntries: entries.length,
      skippedEntries,
      unmatchedEntries,
      unmatchedHours: round(unmatchedHours),
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
