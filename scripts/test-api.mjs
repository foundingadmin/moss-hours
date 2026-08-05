/* Offline harness for api/time.js. Stubs ClickUp so the classifier, the folder
   firewall, Denver bucketing and the reconciliation arithmetic can be checked
   without a token and without a deploy.

   These are not general unit tests. Every case below is a defect this report
   has actually shipped, or an acceptance criterion the rebuild has to hold:
   work from a folder the client must never see, a running timer counted as
   negative work, late-evening work landing in the wrong month, two distinct
   tasks sharing a name merging into one row, and a reconstruction marker
   reaching the client surface.

   Run by `npm run check`. */
process.env.MOSS_CLICKUP_TOKEN = 'test-token';

const RETAINER = '90114447278';
const RETAINER_ARCHIVE = '90116369473';
const NOT_RETAINER = '90117343728'; // a folder the report must never see

const h = (n) => n * 3600000;

// 2026-01-15 12:00 Denver
const JAN = Date.UTC(2026, 0, 15, 19, 0, 0);
// 2026-01-31 23:00 Denver is 2026-02-01 06:00 UTC
const JAN_LATE_NIGHT = Date.UTC(2026, 1, 1, 6, 0, 0);
const JUN = Date.UTC(2026, 5, 10, 18, 0, 0);

const ENTRIES = [
  // The three fixture entries on task 868kmdh0u, all January.
  { id: '5202587059072133962', start: String(JAN), duration: String(h(111)),
    task: { id: '868kmdh0u', name: 'ZZ FIXTURE' }, task_location: { folder_id: RETAINER, list_id: '901109719902' } },
  { id: '5202587548111203151', start: String(JAN), duration: String(h(222)),
    task: { id: '868kmdh0u', name: 'ZZ FIXTURE' }, tags: [{ name: 'documented' }],
    description: '[RECON:DOC] rebuilt from the January invoice',
    task_location: { folder_id: RETAINER, list_id: '901109719902' } },
  { id: '5202587612284054352', start: String(JAN), duration: String(h(333)),
    task: { id: '868kmdh0u', name: 'ZZ FIXTURE' }, tags: [{ name: 'estimate' }],
    description: '[RECON:EST] from direct knowledge of the work',
    task_location: { folder_id: RETAINER, list_id: '901109719902' } },

  // Prefix-only markers must classify identically to tag-only markers.
  { id: 'p1', start: String(JAN), duration: String(h(2)), task: { id: 't-prefix', name: 'Prefix only' },
    description: '[RECON:EST] no tag on this one', task_location: { folder_id: RETAINER_ARCHIVE } },
  { id: 'p2', start: String(JAN), duration: String(h(2)), task: { id: 't-tag', name: 'Tag only' },
    tags: [{ name: 'estimate' }], task_location: { folder_id: RETAINER_ARCHIVE } },

  // Both markers: documented wins, and the id is reported as a conflict.
  { id: 'conflict-1', start: String(JAN), duration: String(h(1)), task: { id: 't-conflict', name: 'Conflicted' },
    tags: [{ name: 'documented' }, { name: 'estimate' }], task_location: { folder_id: RETAINER } },

  // 11pm Denver on 31 January must land in January, not February.
  { id: 'boundary', start: String(JAN_LATE_NIGHT), duration: String(h(3)),
    task: { id: 't-late', name: 'Late night' }, task_location: { folder_id: RETAINER } },

  // Two distinct tasks sharing a name must not merge.
  { id: 'n1', start: String(JUN), duration: String(h(4)), task: { id: 'ui-a', name: 'UI Design' }, task_location: { folder_id: RETAINER } },
  { id: 'n2', start: String(JUN), duration: String(h(6)), task: { id: 'ui-b', name: 'UI Design' }, task_location: { folder_id: RETAINER } },

  // Non-retainer work is discarded, not bucketed.
  { id: 'x1', start: String(JUN), duration: String(h(99)), task: { id: 'x', name: 'Separate agreement work' }, task_location: { folder_id: NOT_RETAINER } },

  // A running timer reports a negative duration.
  { id: 'neg', start: String(JUN), duration: String(-h(5)), task: { id: 't-neg', name: 'Running' }, task_location: { folder_id: RETAINER } },

  // Under the aggregate threshold, so it rolls into the trailing row.
  { id: 'tiny', start: String(JUN), duration: String(h(0.1)), task: { id: 't-tiny', name: 'Two minutes' }, task_location: { folder_id: RETAINER } },

  // No task object at all.
  { id: 'orphan', start: String(JUN), duration: String(h(1)), task_location: { folder_id: RETAINER } },
];

globalThis.fetch = async (url) => {
  const ok = (body) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) });
  if (url.includes('/api/v2/team?') || url.endsWith('/api/v2/team')) {
    return ok({ teams: [{ id: '9011561475', members: [{ user: { id: 1 } }, { user: { id: 2 } }] }] });
  }
  const u = new URL(url);
  const start = Number(u.searchParams.get('start_date'));
  const end = Number(u.searchParams.get('end_date'));
  return ok({ data: ENTRIES.filter((e) => Number(e.start) >= start && Number(e.start) <= end) });
};

const { default: handler } = await import(new URL('../api/time.js', import.meta.url).href);

function run(query) {
  return new Promise((resolve) => {
    const res = {
      setHeader() {},
      status(code) { this._code = code; return this; },
      json(body) { resolve({ code: this._code, body }); return this; },
      end() { resolve({ code: this._code, body: null }); },
    };
    handler({ method: 'GET', query }, res);
  });
}

let failures = 0;
const check = (label, actual, expected) => {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  const pass = a === e;
  if (!pass) failures += 1;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${label}${pass ? '' : `\n        expected ${e}\n        actual   ${a}`}`);
};

const { body } = await run({ year: '2026' });
const jan = body.months[0];
const feb = body.months[1];
const jun = body.months[5];
const fixture = jan.items.find((i) => i.id === '868kmdh0u');

console.log('--- Phase 02 fixture ---');
check('fixture task hours', fixture.hours, { logged: 111, documented: 222, estimated: 333 });
check('fixture task total', fixture.total, 666);
check('fixture task reconstructed', fixture.reconstructed, 555);

console.log('--- classification ---');
check('prefix-only estimate', jan.items.find((i) => i.id === 't-prefix').hours, { logged: 0, documented: 0, estimated: 2 });
check('tag-only estimate', jan.items.find((i) => i.id === 't-tag').hours, { logged: 0, documented: 0, estimated: 2 });
check('both markers resolve to documented', jan.items.find((i) => i.id === 't-conflict').hours, { logged: 0, documented: 1, estimated: 0 });

console.log('--- firewall and guards ---');
check('non-retainer folder discarded', JSON.stringify(body).includes('Separate agreement work'), false);
check('negative duration excluded', jun.items.some((i) => i.id === 't-neg'), false);
check('11pm Denver on 31 Jan lands in January', jan.items.some((i) => i.id === 't-late'), true);
check('...and not in February', feb.items.some((i) => i.id === 't-late'), false);
check('same-named tasks stay distinct', jun.items.filter((i) => i.name === 'UI Design').length, 2);
check('sub-threshold work rolls into one row', jun.items.some((i) => i.aggregated && i.total === 0.1), true);
check('orphan timer groups under (no task)', jun.items.some((i) => i.name === '(no task)'), true);

console.log('--- leakage ---');
const raw = JSON.stringify(body);
check('no [RECON: marker in the response', raw.includes('[RECON:'), false);
check('no description field', raw.includes('description'), false);
for (const f of ['other', 'combined', 'sow', 'email', 'username', 'initials', 'avatar', 'profilePicture']) {
  check(`no "${f}" field`, new RegExp(`"${f}"\\s*:`, 'i').test(raw), false);
}

console.log('--- arithmetic ---');
body.months.forEach((m, i) => {
  const sum = Math.round((m.hours.logged + m.hours.documented + m.hours.estimated) * 100) / 100;
  check(`month ${i} total equals its parts`, m.total, sum);
  const itemSum = Math.round(m.items.reduce((a, t) => a + t.total, 0) * 100) / 100;
  check(`month ${i} header equals sum of its rows`, m.total, itemSum);
  const ids = m.items.map((t) => t.id).filter(Boolean);
  check(`month ${i} has no repeated task id`, ids.length, new Set(ids).size);
});
check('year totals equal the sum of months',
  body.totals.total,
  Math.round(body.months.reduce((a, m) => a + m.total, 0) * 100) / 100);

console.log('--- debug gating ---');
check('no debug key on a normal call', 'debug' in body, false);
const dbg = (await run({ year: '2026', debug: '1' })).body;
check('debug key present under ?debug=1', 'debug' in dbg, true);
check('conflicts reported', dbg.debug.classificationConflicts, ['conflict-1']);
const dbg2 = (await run({ year: '2026', debug: '1' })).body;
check('conflicts do not accumulate across requests', dbg2.debug.classificationConflicts, ['conflict-1']);

console.log(failures ? `\n${failures} FAILURE(S)` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
