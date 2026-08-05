/**
 * Validates data/sows.json.
 *
 *   node scripts/validate-sows.js
 *
 * data/sows.json is hand-maintained and it is the whole of Report B's data
 * layer, so the checks here are the only thing standing between a typo in a
 * signed contract's figures and a client reading that typo back as their own
 * spend. Exits non-zero on any failure.
 *
 * The last check is the important one. Report B is separated from time tracking
 * architecturally, not by a filter: nothing in it may ever be expressed in
 * hours, because the moment hours exist in this file they are one flag away
 * from a client surface forever.
 *
 * This file reads data/sows.json and nothing else. It must never import from
 * api/time.js or reference ClickUp.
 */
/* Deliberately CommonJS while the rest of scripts/ is ESM. package.json has no
   "type" field, so a .js file carrying import syntax runs only after Node
   reparses it and warns, and this file's name is fixed by the checklist that
   calls it. Adding "type": "module" would fix the warning and also change how
   Vercel treats api/time.js, which is not a trade worth making for a local
   validator. */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const PATH = join(__dirname, '..', 'data', 'sows.json');
const errors = [];
const fail = (msg) => errors.push(msg);

const round = (n) => Math.round(n * 100) / 100;
const cents = (n) => Math.round(n * 100);
const money = (n) => '$' + n.toLocaleString('en-US');

let raw;
try {
  raw = readFileSync(PATH, 'utf8');
} catch (e) {
  console.log(`FAIL  data/sows.json could not be read. ${e.message}`);
  process.exit(1);
}

/* Checked against the raw text rather than the parsed object, so it also
   catches the word in a key, a comment-style "_note" field or a SOW name. */
for (const word of ['hour', 'hours', 'hourly']) {
  const re = new RegExp(word, 'i');
  if (re.test(raw)) {
    const line = raw.split('\n').findIndex((l) => re.test(l)) + 1;
    fail(`data/sows.json:${line} contains "${word}". Report B is days and dollars only.`);
  }
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.log(`FAIL  data/sows.json is not valid JSON. ${e.message}`);
  process.exit(1);
}

const regions = Array.isArray(data.regions) ? data.regions : [];
const sows = Array.isArray(data.sows) ? data.sows : [];
if (!regions.length) fail('data/sows.json has no regions array.');
if (!sows.length) fail('data/sows.json has no sows array.');

const VALUES = regions.map((r) => r.value);
const seenRegion = new Set();
for (const r of regions) {
  if (typeof r.value !== 'string' || !r.value) fail(`region ${JSON.stringify(r)} has no value.`);
  if (typeof r.label !== 'string' || !r.label) fail(`region "${r.value}" has no label.`);
  if (typeof r.scaffolded !== 'boolean') fail(`region "${r.value}" needs a boolean scaffolded.`);
  if (seenRegion.has(r.value)) fail(`region "${r.value}" is defined twice.`);
  seenRegion.add(r.value);
}

const seenId = new Set();
const summary = [];

for (const s of sows) {
  const id = s.id || '(no id)';
  const at = (msg) => fail(`${id}: ${msg}`);

  if (typeof s.id !== 'string' || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(s.id || '')) {
    at('id must be kebab-case.');
  }
  if (seenId.has(s.id)) at('id is used twice.');
  seenId.add(s.id);

  if (typeof s.name !== 'string' || !s.name) at('name is missing.');
  if (s.status !== 'executed' && s.status !== 'drafting') {
    at(`status "${s.status}" must be "executed" or "drafting".`);
  }
  if (typeof s.department !== 'string' || !s.department) at('department is missing.');

  if (!VALUES.includes(s.region)) at(`region "${s.region}" is not one of: ${VALUES.join(', ')}.`);
  if (!Array.isArray(s.regions) || !s.regions.length) {
    at('regions must be a non-empty array.');
  } else {
    for (const v of s.regions) {
      if (!VALUES.includes(v)) at(`regions contains "${v}", which is not a defined region.`);
    }
    /* A SOW serving several named regions is labelled Multi-Region and lists
       its members; anything else names exactly itself. Splitting a multi-region
       SOW across rows is a display choice, made on the frontend and reversible,
       so the data layer never does it. */
    if (s.region === 'multi-region') {
      if (s.regions.length < 2) at('region is multi-region but regions lists fewer than two.');
      if (s.regions.includes('multi-region')) at('regions must list member regions, not multi-region itself.');
    } else if (s.regions.length !== 1 || s.regions[0] !== s.region) {
      at(`region is "${s.region}" so regions must be exactly ["${s.region}"].`);
    }
  }

  const items = Array.isArray(s.lineItems) ? s.lineItems : null;
  if (!items) {
    at('lineItems must be an array.');
  } else {
    items.forEach((li, i) => {
      for (const f of ['workstream', 'lineItem']) {
        if (typeof li[f] !== 'string' || !li[f]) at(`lineItems[${i}] has no ${f}.`);
      }
      if (typeof li.days !== 'number' || !(li.days >= 0)) at(`lineItems[${i}] days must be a number.`);
      if (typeof li.price !== 'number' || !(li.price >= 0)) at(`lineItems[${i}] price must be a number.`);
    });

    const days = round(items.reduce((a, li) => a + (li.days || 0), 0));
    if (round(s.totalDays) !== days) {
      at(`totalDays is ${s.totalDays} but the line items come to ${days}.`);
    }
    const price = items.reduce((a, li) => a + cents(li.price || 0), 0);
    if (cents(s.totalPrice) !== price) {
      at(`totalPrice is ${money(s.totalPrice)} but the line items come to ${money(price / 100)}.`);
    }
  }

  if (s.status === 'drafting') {
    if (s.executedDate !== null) at('is drafting, so executedDate must be null.');
    if (s.totalDays !== 0) at('is drafting, so totalDays must be 0.');
    if (s.totalPrice !== 0) at('is drafting, so totalPrice must be 0.');
    if (items && items.length) at('is drafting, so lineItems must be empty.');
  } else if (!/^\d{4}-\d{2}-\d{2}$/.test(s.executedDate || '')) {
    at(`executedDate "${s.executedDate}" must be an ISO date.`);
  }

  summary.push(
    `  ${s.status === 'drafting' ? 'drafting' : s.executedDate}  ${(s.region + '            ').slice(0, 14)}` +
    `${String(s.totalDays).padStart(6)} days  ${money(s.totalPrice).padStart(9)}  ${s.name}`
  );
}

for (const line of summary) console.log(line);
for (const e of errors) console.log('FAIL  ' + e);
console.log(
  errors.length
    ? `\n${errors.length} problem${errors.length === 1 ? '' : 's'} in data/sows.json.`
    : `\n${sows.length} SOW${sows.length === 1 ? '' : 's'} across ${regions.length} regions. All checks passed.`
);
process.exit(errors.length ? 1 : 0);
