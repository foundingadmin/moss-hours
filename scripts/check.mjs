/**
 * Pre-commit checks for this repo, as one command.
 *
 *   npm run check
 *
 * These are the mistakes that have actually been made here, not a general
 * linter. Each one is cheap, and each one has cost somebody a round trip.
 *
 * Two of them are load-bearing rather than tidy. The firewall check is what
 * keeps work covered by a separate signed agreement off the client's retainer
 * report, and the unit check is what keeps Report B in days and dollars. Both
 * are separations this project chose to make architectural rather than
 * conditional, and a check is how an architectural decision stays one.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFile(join(ROOT, p), 'utf8');

const errors = [];
const warnings = [];

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/* 1. Em dashes. A standing house rule, and the one thing most likely to slip
      into a paragraph of UI copy written in a hurry. */
{
  // CLAUDE.md and this file are deliberately absent: both quote the character
  // in the rule that forbids it, so scanning them fails on the rule itself.
  const files = ['index.html', 'report-b.html', 'construction.html', 'api/time.js', 'README.md',
                 'data/sows.json', 'scripts/serve.mjs',
                 'scripts/build-fixtures.mjs', 'scripts/test-api.mjs',
                 'scripts/validate-sows.js', 'scripts/clickup-oauth.js'];
  for (const f of files) {
    const text = await read(f).catch(() => null);
    if (text === null) continue;
    let i = -1;
    while ((i = text.indexOf('—', i + 1)) !== -1) {
      errors.push(`${f}:${lineOf(text, i)} em dash. Use a period, colon, comma or parentheses.`);
    }
  }
}

/* There is deliberately no check for a spaced hyphen standing in for an em
   dash. It cannot tell ` - ` in a sentence from `a - b` in the spline maths,
   and firing forty times on correct arithmetic is how a check gets ignored.
   That substitution is a judgement call, and it stays a human one. */

/* 2. The vendored-CDN trap. Previewing a report offline means pointing it at
      local copies of Chart.js and the brand tokens, and committing that swap
      ships a report that renders unstyled and chartless for the client. */
{
  const required = {
    'index.html': [
      'https://brand.foundingcreative.com/css/tokens.css',
      'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
    ],
    // Report B draws no chart, so it needs the tokens and nothing else.
    'report-b.html': ['https://brand.foundingcreative.com/css/tokens.css'],
  };
  for (const [file, urls] of Object.entries(required)) {
    const text = await read(file).catch(() => null);
    if (text === null) { errors.push(`${file} is missing.`); continue; }
    for (const url of urls) {
      if (!text.includes(url)) {
        errors.push(`${file} no longer loads ${url}. A local preview copy was probably left in place.`);
      }
    }
  }
}

/* 3. The retainer firewall. api/time.js is allowed to see two ClickUp folders
      and no others. Anything else in that workspace is work running under a
      separate signed agreement, and clause 2.2.2 is the reason it must not
      appear on this report. Widening that list is a contract decision, so it
      should never happen quietly in a diff. */
{
  const text = await read('api/time.js');
  const declared = text.match(/const RETAINER_FOLDER_IDS = \[([^\]]*)\]/);
  if (!declared) {
    errors.push('api/time.js no longer declares RETAINER_FOLDER_IDS. The firewall check cannot run.');
  } else {
    const ids = [...declared[1].matchAll(/'(\d+)'/g)].map((m) => m[1]).sort();
    const expected = ['90114447278', '90116369473'].sort();
    if (ids.join(',') !== expected.join(',')) {
      errors.push(
        `api/time.js RETAINER_FOLDER_IDS is [${ids.join(', ')}], expected [${expected.join(', ')}]. ` +
        'Changing which folders reach the client report is a contract decision, not a code change.'
      );
    }
  }
  // Front-end files have no business naming a folder id at all.
  for (const f of ['index.html', 'report-b.html']) {
    const src = await read(f).catch(() => null);
    if (src && /\b901\d{8}\b/.test(src)) {
      errors.push(`${f} names a ClickUp folder id. Folder scoping belongs in api/time.js alone.`);
    }
  }
}

/* 4. Report B's unit. Every figure on that page comes from a signed document,
      in days and dollars. The moment an entry is expressed in tracked time it
      is one flag away from a client surface forever, so the word is banned
      outright rather than reviewed case by case. */
{
  for (const f of ['report-b.html', 'data/sows.json']) {
    const text = await read(f).catch(() => null);
    if (text === null) { errors.push(`${f} is missing.`); continue; }
    const m = text.match(/hourly|hours|hour/i);
    if (m) errors.push(`${f}:${lineOf(text, m.index)} says "${m[0]}". Report B is days and dollars only.`);
    if (/clickup|time_entries/i.test(text)) {
      errors.push(`${f} references time tracking. Report B reads signed documents and nothing else.`);
    }
  }
  const validator = spawnSync('node', [join(ROOT, 'scripts/validate-sows.js')], { encoding: 'utf8' });
  if (validator.status !== 0) {
    errors.push('data/sows.json failed validation. Run `npm run sows` for the detail.');
  }
}

/* 5. The experimental distribution block has to stay removable by cutting
      between its markers, which only works while they are balanced. */
{
  const text = await read('report-b.html').catch(() => '');
  const starts = (text.match(/EXPERIMENTAL: MULTI-REGION DISTRIBUTION START/g) || []).length;
  const ends = (text.match(/EXPERIMENTAL: MULTI-REGION DISTRIBUTION END/g) || []).length;
  if (starts !== ends) {
    errors.push(`report-b.html has ${starts} EXPERIMENTAL start markers and ${ends} ends. ` +
                'Removing the feature means cutting between matched pairs.');
  }
}

/* 6. Fixtures have to parse, carry every month, and reconcile. The chart
      indexes months positionally rather than looking them up, and the report's
      whole claim is that a month's header agrees with the rows under it. A
      fixture that breaks either is a page that lies in local preview and then
      passes review. */
{
  const dir = join(ROOT, 'fixtures');
  const files = await readdir(dir).catch(() => []);
  const round = (n) => Math.round(n * 100) / 100;
  for (const f of files.filter((n) => n.endsWith('.json'))) {
    let data;
    try {
      data = JSON.parse(await readFile(join(dir, f), 'utf8'));
    } catch (e) {
      errors.push(`fixtures/${f} is not valid JSON. ${e.message}`);
      continue;
    }
    const months = data.months || [];
    if (months.length !== 12) {
      errors.push(`fixtures/${f} has ${months.length} months. It needs all 12, January to December.`);
    }
    months.forEach((m, i) => {
      if (m.month !== i) errors.push(`fixtures/${f} month at position ${i} is labelled ${m.month}.`);
      const h = m.hours || {};
      for (const k of ['logged', 'documented', 'estimated']) {
        if (typeof h[k] !== 'number') errors.push(`fixtures/${f} month ${i} has no hours.${k}.`);
      }
      const parts = round((h.logged || 0) + (h.documented || 0) + (h.estimated || 0));
      if (round(m.total) !== parts) {
        errors.push(`fixtures/${f} month ${i} total is ${m.total} but its three classes come to ${parts}.`);
      }
      if (round(m.reconstructed) !== round((h.documented || 0) + (h.estimated || 0))) {
        errors.push(`fixtures/${f} month ${i} reconstructed does not equal documented plus estimated.`);
      }
      const rows = round((m.items || []).reduce((a, t) => a + (t.total || 0), 0));
      if (round(m.total) !== rows) {
        errors.push(`fixtures/${f} month ${i} header is ${m.total} but its items come to ${rows}.`);
      }
    });
  }
}

/* 7. Reconstruction markers are internal machinery. A client reading
      "[RECON:EST]" learns nothing, so they are read by the classifier and
      discarded, and neither report should ever contain the string. */
{
  for (const f of ['index.html', 'report-b.html', 'fixtures/2026-typical.json', 'fixtures/2026-edge.json']) {
    const text = await read(f).catch(() => null);
    if (text && text.includes('[RECON:')) {
      errors.push(`${f} contains a [RECON: marker. Those never leave api/time.js.`);
    }
  }
}

/* 8. Every data flag has to name months that exist and a series the report
      actually draws, or it silently flags nothing. */
{
  const text = await read('index.html');
  const block = text.match(/var DATA_FLAGS = \[([\s\S]*?)\n {4}\];/);
  if (!block) {
    warnings.push('index.html DATA_FLAGS array not found. The check for it needs updating.');
  } else {
    for (const m of block[1].matchAll(/months:\s*\[([^\]]*)\]/g)) {
      const bad = m[1].split(',').map((s) => Number(s.trim()))
        .filter((n) => !Number.isInteger(n) || n < 0 || n > 11);
      if (bad.length) errors.push(`index.html DATA_FLAGS has out-of-range months: ${bad.join(', ')}.`);
    }
    for (const m of block[1].matchAll(/series:\s*'([^']*)'/g)) {
      if (m[1] !== 'retainer') {
        errors.push(`index.html DATA_FLAGS series '${m[1]}' is not a series the report draws.`);
      }
    }
  }
}

/* 9. The API's own checks, run here so `npm run check` is the one command. */
{
  const api = spawnSync('node', [join(ROOT, 'scripts/test-api.mjs')], { encoding: 'utf8' });
  if (api.status !== 0) {
    errors.push('api/time.js failed its checks. Run `npm run test:api` for the detail.');
  }
}

/* 10. Under-construction mode. It hides both reports from the client, which
       makes it the one setting nobody notices is still on. Loud, but a warning
       rather than a failure: it has to be committable, since committing it is
       how it ships. */
{
  const text = await read('vercel.json').catch(() => null);
  if (text === null) {
    warnings.push('vercel.json is missing.');
  } else {
    let config = null;
    try {
      config = JSON.parse(text);
    } catch (e) {
      errors.push(`vercel.json is not valid JSON. ${e.message}`);
    }
    const holding = (config?.routes || []).filter((r) => r.dest === '/construction.html');
    if (holding.length) {
      /* The holding page is scoped to the hostnames a client could actually
         land on, so preview deployments serve the real reports. That scoping is
         the one thing standing between "hidden" and "live", and it fails open:
         a hostname missing from this list is a hostname serving the report to
         whoever visits it. Hence a hard failure rather than a warning. */
      const PUBLIC_HOSTS = [
        'moss.foundingcreative.com',
        'moss-hours.vercel.app',
        'moss-hours-foundingadmins-projects.vercel.app',
        'moss-hours-git-main-foundingadmins-projects.vercel.app',
      ];
      const covered = new Set(
        holding.flatMap((r) => (r.has || [])
          .filter((h) => h.type === 'host')
          .map((h) => h.value))
      );
      for (const host of PUBLIC_HOSTS) {
        if (!covered.has(host)) {
          errors.push(
            `vercel.json holds the site under construction but does not cover ${host}. ` +
            'That hostname would serve the live report.'
          );
        }
      }
      // A catch-all with no host condition takes preview deployments down too,
      // which is a legitimate thing to want and worth saying out loud.
      if (holding.some((r) => !(r.has || []).length)) {
        warnings.push('vercel.json has an unscoped construction route. Preview deployments are hidden too.');
      }
      warnings.push(
        'UNDER CONSTRUCTION is on. The client-facing hostnames serve construction.html, ' +
        `so neither report is reachable at ${PUBLIC_HOSTS[0]}. Preview deployments still ` +
        'serve the real pages. Delete the routes array to go live.'
      );
    }
  }
}

for (const w of warnings) console.log('warn  ' + w);
for (const e of errors) console.log('FAIL  ' + e);
console.log(
  errors.length
    ? `\n${errors.length} problem${errors.length === 1 ? '' : 's'} to fix.`
    : `\nAll checks passed${warnings.length ? `, with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}` : ''}.`
);
process.exit(errors.length ? 1 : 0);
