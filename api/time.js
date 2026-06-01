const CLICKUP_TOKEN = process.env.CLICKUP_TOKEN;
const WORKSPACE_ID = '9011561475';

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

    const retainer = Array(12).fill(0);
    const sow = Array(12).fill(0);

    for (const entry of entries || []) {
      const startTs = parseInt(entry.start);
      if (isNaN(startTs)) continue;

      const d = new Date(startTs);
      if (d.getFullYear() !== year) continue;

      const month = d.getMonth();
      const hours = (parseInt(entry.duration) || 0) / 3600000;

      // Try every location field ClickUp might use
      const fid =
        entry?.task_location?.folder_id ||
        entry?.task_location?.folder?.id ||
        entry?.folder?.id ||
        entry?.list?.folder?.id ||
        '';

      if (FOLDER_IDS.retainer.includes(String(fid))) {
        retainer[month] += hours;
      } else if (FOLDER_IDS.sow.includes(String(fid))) {
        sow[month] += hours;
      }
    }

    return res.status(200).json({
      year,
      retainer,
      sow,
      totalEntries: (entries || []).length,
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
