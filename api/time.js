const CLICKUP_TOKEN = process.env.CLICKUP_TOKEN;
const WORKSPACE_ID = '9011561475';

// Monthly Creative Retainer budget, in hours (used for % / remaining figures).
const RETAINER_BUDGET_HOURS = 50;

const FOLDER_IDS = {
  retainer: ['90114447278', '90116369473'],
  sow: ['90117343728', '90117412643'],
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const year = parseInt(req.query.year) || new Date().getFullYear();
  const startMs = new Date(`${year}-01-01T00:00:00Z`).getTime();
  const endMs = new Date(`${year}-12-31T23:59:59Z`).getTime();

  try {
    const url = `https://api.clickup.com/api/v2/team/${WORKSPACE_ID}/time_entries?start_date=${startMs}&end_date=${endMs}`;
    const cuRes = await fetch(url, {
      headers: {
        Authorization: CLICKUP_TOKEN,
        'Content-Type': 'application/json',
      },
    });

    if (!cuRes.ok) {
      const errText = await cuRes.text();
      return res.status(502).json({ error: `ClickUp API error ${cuRes.status}`, detail: errText });
    }

    const { data: entries } = await cuRes.json();

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

    if (req.query.debug) {
      const sample = (entries || [])[0] || null;
      return res.status(200).json({
        year,
        totalEntries: (entries || []).length,
        resolvedFolderIdOfSample: sample ? folderIdOf(sample) : null,
        sampleEntry: sample,
      });
    }

    // One bucket per month, each tracking total hours plus a per-task tally
    // (keyed by task name) for the Retainer and SOW categories.
    const months = Array.from({ length: 12 }, () => ({
      retainerHours: 0,
      sowHours: 0,
      retainerTasks: new Map(),
      sowTasks: new Map(),
    }));
    let unmatchedEntries = 0;
    let unmatchedHours = 0;

    for (const entry of entries || []) {
      const startTs = parseInt(entry.start);
      if (isNaN(startTs)) continue;

      const d = new Date(startTs);
      if (d.getFullYear() !== year) continue;

      const month = d.getMonth();
      const hours = (parseInt(entry.duration) || 0) / 3600000;
      const fid = folderIdOf(entry);
      const taskName = entry?.task?.name || '(untitled task)';

      let bucket;
      if (FOLDER_IDS.retainer.includes(fid)) bucket = months[month].retainerTasks;
      else if (FOLDER_IDS.sow.includes(fid)) bucket = months[month].sowTasks;
      else {
        unmatchedEntries += 1;
        unmatchedHours += hours;
        continue;
      }

      bucket.set(taskName, (bucket.get(taskName) || 0) + hours);
      if (bucket === months[month].retainerTasks) months[month].retainerHours += hours;
      else months[month].sowHours += hours;
    }

    const round = (n) => Math.round(n * 100) / 100;
    const toItems = (map) =>
      [...map.entries()]
        .map(([name, hours]) => ({ name, hours: round(hours) }))
        .filter((t) => t.hours > 0) // drop tasks that round to 0h (milestones, sub-second timers)
        .sort((a, b) => b.hours - a.hours);

    const monthsOut = months.map((mo, i) => ({
      month: i,
      retainerHours: round(mo.retainerHours),
      sowHours: round(mo.sowHours),
      retainerItems: toItems(mo.retainerTasks),
      sowItems: toItems(mo.sowTasks),
    }));

    return res.status(200).json({
      year,
      retainerBudget: RETAINER_BUDGET_HOURS,
      months: monthsOut,
      // Flat aggregates kept for convenience / back-compat.
      retainer: monthsOut.map((m) => m.retainerHours),
      sow: monthsOut.map((m) => m.sowHours),
      totalEntries: (entries || []).length,
      unmatchedEntries,
      unmatchedHours: round(unmatchedHours),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
