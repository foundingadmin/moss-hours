#!/usr/bin/env node
/**
 * Roster generator. Developer tool only.
 *
 * NEVER import this from the app and never call it at request time. Matching a
 * ClickUp display name to an image on every request means a renamed account can
 * put the wrong person's face on a client-facing report with no warning. A
 * wrong face is worse than a generic mark, so discovery happens once, a human
 * reviews the result, and the reviewed file is committed.
 *
 *   CLICKUP_TOKEN=pk_... node scripts/generate-roster.js
 *
 * Writes roster.js in the repository root. Titles are not discoverable and are
 * filled in by hand afterwards; regenerating discards them, so diff before
 * committing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const WORKSPACE_ID = '9011561475';
const ROSTER_DIR = path.join(ROOT, 'team', 'roster');
const STACK_DIR = path.join(ROOT, 'team', 'stack');
const OUT_FILE = path.join(ROOT, 'roster.js');

/**
 * Slugs deliberately excluded from matching.
 *
 * cricket / quill  internal agents, no ClickUp account, will never match
 * titus-pixel      alternate treatment of a person already rostered as `titus`
 *
 * Ignored slugs are excluded from the error report but listed separately at the
 * end, so the list stays visible rather than silently growing.
 */
const IGNORE_SLUGS = ['cricket', 'quill', 'titus-pixel'];

const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

async function fetchMembers() {
  const token = process.env.CLICKUP_TOKEN;
  if (!token) {
    console.error('CLICKUP_TOKEN is not set. Export it and re-run.');
    process.exit(1);
  }
  const res = await fetch('https://api.clickup.com/api/v2/team', {
    headers: { Authorization: token, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    console.error(`ClickUp API error ${res.status}: ${await res.text()}`);
    process.exit(1);
  }
  const { teams } = await res.json();
  const team = (teams || []).find((t) => String(t.id) === WORKSPACE_ID);
  if (!team) {
    console.error(`Workspace ${WORKSPACE_ID} is not visible to this token.`);
    process.exit(1);
  }
  return (team.members || [])
    .map((m) => m?.user || m)
    .filter((u) => u && (u.id !== null && u.id !== undefined))
    .map((u) => ({
      id: String(u.id),
      username: u.username || '',
      email: u.email || '',
    }));
}

function readSlugs(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => /\.(webp|svg)$/i.test(f))
    .map((f) => f.replace(/\.(webp|svg)$/i, ''))
    .filter((slug) => slug !== 'fc-mark')      // the studio fallback is not a person
    .sort();
}

/**
 * Confidence of a slug against one user.
 *
 *   high    slug is exactly a first name, last name, whole name with separators
 *           stripped, the email local part, or one token of the username
 *   medium  slug is a substring (>= 4 chars) of the whole name or email local
 *   none    anything else
 *
 * Only `high` is ever auto-accepted.
 */
function confidence(slug, user) {
  const s = norm(slug);
  if (!s) return 'none';

  const emailLocal = norm((user.email || '').split('@')[0]);
  const tokens = String(user.username || '')
    .split(/[\s._-]+/)
    .map(norm)
    .filter(Boolean);
  const whole = tokens.join('');

  const exact = new Set([emailLocal, whole, ...tokens].filter(Boolean));
  if (exact.has(s)) return 'high';

  if (s.length >= 4 && ((whole && whole.includes(s)) || (emailLocal && emailLocal.includes(s)))) {
    return 'medium';
  }
  return 'none';
}

function main() {
  return fetchMembers().then((users) => {
    const allSlugs = readSlugs(ROSTER_DIR);
    const stackSlugs = new Set(readSlugs(STACK_DIR));
    const ignored = allSlugs.filter((s) => IGNORE_SLUGS.includes(s));
    const slugs = allSlugs.filter((s) => !IGNORE_SLUGS.includes(s));

    const errors = [];
    const accepted = [];               // { slug, user }
    const slugResult = new Map();      // slug -> { status, user }

    for (const slug of slugs) {
      const highs = users.filter((u) => confidence(slug, u) === 'high');
      const mediums = users.filter((u) => confidence(slug, u) === 'medium');

      if (highs.length === 1) {
        accepted.push({ slug, user: highs[0] });
        slugResult.set(slug, { status: 'high', user: highs[0] });
        continue;
      }
      if (highs.length > 1) {
        errors.push(
          `AMBIGUOUS  slug "${slug}" matches ${highs.length} users: ` +
            highs.map((u) => `${u.username || u.email} (${u.id})`).join(', ')
        );
        slugResult.set(slug, { status: 'ambiguous' });
        continue;
      }
      if (mediums.length) {
        // Never auto-accepted, however tempting it looks.
        errors.push(
          `LOW CONFIDENCE  slug "${slug}" only loosely matches: ` +
            mediums.map((u) => `${u.username || u.email} (${u.id})`).join(', ') +
            '  [not accepted, add an exact-named image or edit roster.js by hand]'
        );
        slugResult.set(slug, { status: 'medium' });
        continue;
      }
      errors.push(`NO USER  slug "${slug}" matches no ClickUp user`);
      slugResult.set(slug, { status: 'none' });
    }

    // One user picking up two images is as wrong as two users picking up one.
    const byUser = new Map();
    for (const { slug, user } of accepted) {
      if (!byUser.has(user.id)) byUser.set(user.id, []);
      byUser.get(user.id).push(slug);
    }
    for (const [id, list] of byUser) {
      if (list.length > 1) {
        const u = users.find((x) => x.id === id);
        errors.push(
          `AMBIGUOUS  user ${u.username || u.email} (${id}) matches ${list.length} slugs: ${list.join(', ')}`
        );
      }
    }

    const matchedIds = new Set(accepted.map((a) => a.user.id));
    const unmatchedUsers = users.filter((u) => !matchedIds.has(u.id));

    // Missing stack crop means the monthly avatar stack would 404.
    for (const { slug } of accepted) {
      if (!stackSlugs.has(slug)) {
        errors.push(`MISSING STACK  "${slug}" has a roster image but no team/stack/${slug}.webp`);
      }
    }

    writeRoster(accepted);
    report({ users, accepted, unmatchedUsers, errors, ignored, slugResult });
  });
}

function writeRoster(accepted) {
  // Warn before clobbering hand-written titles.
  if (fs.existsSync(OUT_FILE)) {
    const prev = fs.readFileSync(OUT_FILE, 'utf8');
    const titled = [...prev.matchAll(/title:\s*'([^']*)'/g)].filter((m) => m[1].trim());
    if (titled.length) {
      console.log('');
      console.log(`  !  roster.js already has ${titled.length} filled-in title(s).`);
      console.log('     Regenerating discards them. Diff before you commit.');
    }
  }

  const rows = accepted
    .slice()
    .sort((a, b) => (a.user.username || '').localeCompare(b.user.username || ''));

  const body = rows
    .map(({ slug, user }) =>
      [
        `  '${user.id}': {`,
        `    name:   ${JSON.stringify(user.username || slug)},`,
        `    title:  '',`,
        `    roster: '/team/roster/${slug}.webp',`,
        `    stack:  '/team/stack/${slug}.webp',`,
        `    active: true`,
        `  },`,
      ].join('\n')
    )
    .join('\n');

  // Deliberately no timestamp: the generator must be byte-reproducible so a
  // rerun that changes nothing produces no diff.
  const out = `/**
 * ClickUp user id to display metadata.
 *
 * GENERATED by scripts/generate-roster.js from ClickUp workspace ${WORKSPACE_ID},
 * then hand-edited for titles and committed. Do not hand-enter user ids.
 *
 * This file is the only source of names, titles and images that reach the
 * client. ClickUp is authoritative for exactly one thing: which user ids logged
 * matched time. A teammate can rename their ClickUp account or change their
 * avatar at any time, so nothing ClickUp-sourced is ever rendered.
 *
 * The roster is agency-wide, not per-client: the report already filters to
 * users who logged time against the configured folders, so one roster serves
 * every client this app is pointed at.
 */
export const ROSTER = {
${body}
};

/**
 * Anyone contributing without a roster entry collapses into the studio mark.
 * Their real id is never rendered.
 */
export const STUDIO_FALLBACK = {
  name:   'Founding Creative',
  title:  'Studio team',
  roster: '/team/roster/fc-mark.svg',
  stack:  '/team/stack/fc-mark.svg',
  isStudio: true,
  unrostered: true
};

/**
 * A misnamed or missing file should fail loudly at module load, not render as a
 * broken image on a live client report.
 */
for (const [id, person] of Object.entries(ROSTER)) {
  for (const field of ['roster', 'stack']) {
    const value = person[field];
    if (typeof value !== 'string' || !value.trim() || !/\\.(webp|svg)$/.test(value)) {
      throw new Error(
        \`roster.js: \${id} (\${person.name}) has an invalid "\${field}" path: \${JSON.stringify(value)}\`
      );
    }
  }
}
for (const field of ['roster', 'stack']) {
  const value = STUDIO_FALLBACK[field];
  if (typeof value !== 'string' || !value.trim() || !/\\.(webp|svg)$/.test(value)) {
    throw new Error(\`roster.js: STUDIO_FALLBACK has an invalid "\${field}" path\`);
  }
}
`;
  fs.writeFileSync(OUT_FILE, out);
}

function report({ users, accepted, unmatchedUsers, errors, ignored, slugResult }) {
  const pad = (s, n) => String(s).padEnd(n).slice(0, n);
  const bySlug = new Map(accepted.map((a) => [a.user.id, a.slug]));

  console.log('');
  console.log('  ClickUp workspace ' + WORKSPACE_ID + ': roster review');
  console.log('  ' + '-'.repeat(74));
  console.log('  ' + pad('USER', 30) + pad('ID', 13) + pad('SLUG', 16) + 'CONFIDENCE');
  console.log('  ' + '-'.repeat(74));

  const sorted = users
    .slice()
    .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
  for (const u of sorted) {
    const slug = bySlug.get(u.id) || '';
    console.log(
      '  ' + pad(u.username || '(no name)', 30) + pad(u.id, 13) + pad(slug || '-', 16) +
        (slug ? 'high' : '-')
    );
  }

  if (ignored.length) {
    console.log('');
    console.log('  Ignored by config (IGNORE_SLUGS)');
    for (const s of ignored) console.log(`    - ${s}`);
  }

  const hardErrors = errors.filter((e) => !e.startsWith('NO USER'));
  const orphanSlugs = errors.filter((e) => e.startsWith('NO USER'));

  if (hardErrors.length || orphanSlugs.length) {
    console.log('');
    console.log('  Needs attention');
    for (const e of [...hardErrors, ...orphanSlugs]) console.log(`    ! ${e}`);
  }

  if (unmatchedUsers.length) {
    console.log('');
    console.log(`  Users with no image file (${unmatchedUsers.length}). These fall back to the studio mark`);
    for (const u of unmatchedUsers) {
      console.log(`    - ${pad(u.username || '(no name)', 28)} ${u.id}`);
    }
  }

  console.log('');
  console.log(`  Written: ${accepted.length}   Needs attention: ${hardErrors.length + orphanSlugs.length}   Ignored: ${ignored.length}`);
  console.log(`  -> ${path.relative(ROOT, OUT_FILE)}`);
  console.log('  Fill in the title fields by hand, then diff and commit.');
  console.log('');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
