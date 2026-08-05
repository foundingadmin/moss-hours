/**
 * Pre-commit checks for this repo, as one command.
 *
 *   npm run check
 *
 * These are the mistakes that have actually been made here, not a general
 * linter. Each one is cheap, and each one has cost somebody a round trip.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (p) => readFile(join(ROOT, p), 'utf8');

const errors = [];
const warnings = [];

const lineOf = (text, index) => text.slice(0, index).split('\n').length;

/* 1. Em dashes. A standing house rule, and the one thing most likely to slip
      into a paragraph of UI copy written in a hurry. */
{
  // CLAUDE.md is deliberately absent: it quotes the character in the rule that
  // forbids it, so scanning it would fail on its own documentation.
  const files = ['index.html', 'construction.html', 'api/time.js', 'roster.js', 'README.md',
                 'scripts/serve.mjs', 'scripts/generate-roster.js', 'scripts/clickup-oauth.js'];
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

/* 2. The vendored-CDN trap. Previewing the report offline means pointing it at
      local copies of Chart.js and the brand tokens, and committing that swap
      ships a report that renders unstyled and chartless for the client. */
{
  const text = await read('index.html');
  const required = [
    'https://brand.foundingcreative.com/css/tokens.css',
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
  ];
  for (const url of required) {
    if (!text.includes(url)) {
      errors.push(`index.html no longer loads ${url}. A local preview copy was probably left in place.`);
    }
  }
}

/* 3. Fixtures have to parse, and have to carry every month, since the chart
      indexes months positionally rather than looking them up. */
{
  const dir = join(ROOT, 'fixtures');
  const files = await readdir(dir).catch(() => []);
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
    });
  }
}

/* 4. Every data flag has to name months that exist and a series the report
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
      if (!['creative', 'nonCreative'].includes(m[1])) {
        errors.push(`index.html DATA_FLAGS series '${m[1]}' is not a series the report draws.`);
      }
    }
  }
}

/* 5. Under-construction mode. It hides the whole report from the client, which
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
    const holding = (config?.routes || []).some((r) => r.dest === '/construction.html');
    if (holding) {
      warnings.push(
        'UNDER CONSTRUCTION is on. vercel.json routes every request to construction.html, ' +
        'so the report and the API are unreachable in production. Delete the routes array ' +
        'to put the report back. (Local preview: /construction.html under `npm run dev`.)'
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
