#!/usr/bin/env node
/**
 * ClickUp OAuth token minter. Developer tool only, run once by hand.
 *
 * NEVER deploy this or call it at request time. It exists to solve one problem:
 * ClickUp issues exactly one personal token per user account, so every project
 * built against that account shares a credential that cannot be rotated or
 * revoked independently. An OAuth app gets its own token, scoped to the
 * workspaces approved during authorization and revocable on its own.
 *
 *   node scripts/clickup-oauth.js 000 000 https://your-report.vercel.app
 *
 * where the first 000 is the app's client id and the second is its secret.
 *
 * The redirect URI must match the one registered on the app in ClickUp exactly,
 * trailing slash included. It is only used during the handshake and never
 * again, so it does not need to resolve to a working page.
 *
 * Prints an access token. Per ClickUp's docs that token does not expire, uses
 * the same raw `Authorization: {token}` header as a personal token, and is a
 * drop-in replacement for one. Put it in Vercel as MOSS_CLICKUP_TOKEN.
 *
 * The token is a live credential. Do not commit it, do not paste it into a
 * ticket, and do not leave it in shell history (see the note the script prints
 * when it finishes).
 */

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const WORKSPACE_ID = '9011561475';

const AUTHORIZE_BASE = 'https://app.clickup.com/api';
const TOKEN_URL = 'https://api.clickup.com/api/v2/oauth/token';

function usage(message) {
  if (message) console.error(`\n  ${message}`);
  console.error(`
  Usage, where each 000 is a placeholder to paste over:
    node scripts/clickup-oauth.js 000 000 https://your-report.vercel.app

  Get the client id and secret from ClickUp:
    Settings -> Apps -> Create an App

  The redirect URI must match what you registered on that app, exactly.
`);
  process.exit(1);
}

/**
 * Accepts either a bare code or the whole URL pasted out of the address bar,
 * because copying the address bar is what people actually do.
 */
function extractCode(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const match = value.match(/[?&]code=([^&\s]+)/);
  if (match) return decodeURIComponent(match[1]);
  // A bare code has no scheme and no spaces. Anything else is a paste mistake.
  if (/^[A-Za-z0-9_-]+$/.test(value)) return value;
  return null;
}

async function exchange(clientId, clientSecret, code) {
  // ClickUp reads these as query parameters, not as a JSON body.
  const url =
    `${TOKEN_URL}?client_id=${encodeURIComponent(clientId)}` +
    `&client_secret=${encodeURIComponent(clientSecret)}` +
    `&code=${encodeURIComponent(code)}`;

  const res = await fetch(url, { method: 'POST' });
  const body = await res.text();

  if (!res.ok) {
    console.error(`\n  ClickUp returned ${res.status} exchanging the code.`);
    console.error(`  ${body}`);
    if (res.status === 400) {
      console.error(`
  The usual causes, in order of likelihood:
    - the code was already used (they are single use, start over)
    - the code expired (they are short lived, start over)
    - the redirect URI does not match the one registered on the app
`);
    }
    process.exit(1);
  }

  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    console.error(`\n  Could not parse ClickUp's response as JSON:\n  ${body}`);
    process.exit(1);
  }

  if (!parsed.access_token) {
    console.error(`\n  No access_token in ClickUp's response:\n  ${body}`);
    process.exit(1);
  }
  return parsed.access_token;
}

/**
 * Proves the token works before it is trusted, and shows which workspaces it
 * can actually see. A token authorized against the wrong workspace succeeds at
 * the handshake and then returns an empty report, which is a confusing failure
 * to debug later.
 */
async function verify(token) {
  const res = await fetch('https://api.clickup.com/api/v2/team', {
    headers: { Authorization: token, 'Content-Type': 'application/json' },
  });
  if (!res.ok) {
    console.error(`\n  ! Token minted, but /team returned ${res.status}: ${await res.text()}`);
    return false;
  }
  const { teams } = await res.json();
  const list = teams || [];

  console.log('  Workspaces this token can see:');
  for (const team of list) {
    const mark = String(team.id) === WORKSPACE_ID ? '  <- the one this report needs' : '';
    console.log(`    ${String(team.id).padEnd(14)} ${team.name || '(unnamed)'}${mark}`);
  }

  const found = list.some((t) => String(t.id) === WORKSPACE_ID);
  if (!found) {
    console.log(`
  ! Workspace ${WORKSPACE_ID} is NOT in that list, so this token cannot read the
    report's time entries. Re-run the authorize step and tick that workspace.
`);
  }
  return found;
}

async function main() {
  const [clientId, clientSecret, redirectUri] = process.argv.slice(2);
  if (!clientId || !clientSecret || !redirectUri) usage('Missing arguments.');
  if (!/^https?:\/\//.test(redirectUri)) {
    usage(`Redirect URI must be a full URL. Got: ${redirectUri}`);
  }

  const authorizeUrl =
    `${AUTHORIZE_BASE}?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}`;

  console.log(`
  Step 1. Open this in a browser and approve the app.
          Tick the workspace this report reads from (${WORKSPACE_ID}).

  ${authorizeUrl}

  Step 2. ClickUp bounces you to your redirect URI with ?code=... on the end.
          The page itself does not matter. Copy the address bar and paste it
          below. A bare code works too.
`);

  const rl = readline.createInterface({ input, output });
  const answer = await rl.question('  Paste the redirect URL or code: ');
  rl.close();

  const code = extractCode(answer);
  if (!code) {
    console.error('\n  Could not find a code in that. Expected ?code=... or a bare code.');
    process.exit(1);
  }

  const token = await exchange(clientId, clientSecret, code);

  console.log('\n  Token minted.\n');
  const ok = await verify(token);

  console.log(`
  MOSS_CLICKUP_TOKEN=${token}

  Next:
    vercel env add MOSS_CLICKUP_TOKEN     (Production, then Preview)
    vercel deploy --prod

  Confirm the report loads, then remove CLICKUP_TOKEN from THIS project only.
  Other projects still use it.

  This token is a live credential and is now in your shell scrollback. Clear it
  when you are done, and do not commit it.
`);

  process.exit(ok ? 0 : 2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
