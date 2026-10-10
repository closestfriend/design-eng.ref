// Re-checks every link in items.csv against its LIVE page and prints a markdown report.
// Links rot and sites change what they are, so run this before bumping VALID_AS_OF in build.mjs.
//
// Usage: node scripts/check-links.mjs [--stale]   (Node 20+, no dependencies; set GITHUB_TOKEN for a higher API limit)
//
// Flags it raises:
//   DEAD    the page errors or no longer resolves
//   MOVED   the link now lands on a different domain
//   DRIFT   the page's current title/description no longer resembles the saved title (titles of 3+ words only)
//   AGENT   a non-pick row now mentions MCP / coding agents / agent skills but is not tagged for agents
//   GITHUB  the repo is archived (with --stale: or has had no push for over 2 years)
// A 403 or 429 is reported as "blocked", not dead: many good sites refuse automated requests.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const [header, ...body] = parseCsv(readFileSync(join(ROOT, 'items.csv'), 'utf8'));
const rows = body.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ''])));

const UA = 'Mozilla/5.0 (Macintosh) Chrome/120 Safari/537.36';
const STOP = new Set('the a an and or of for to in on with by your you is are as at from this that it its how free online tool tools app new best page site home web'.split(' '));
const words = (s) => new Set((s.toLowerCase().match(/[a-z0-9]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)));
const AGENT = /\b(mcp|model context protocol|coding agents?|agent skills?)\b/i;
const SHOW_STALE = process.argv.includes('--stale'); // also list repos with no push for 2+ years (noisy for old art sketches)
const host = (u) => new URL(u).host.replace(/^www\./, '');
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

async function get(url, ms = 12000, limit = 80000) {
  try {
    const res = await fetch(url, { headers: { 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(ms) });
    return { status: res.status, url: res.url, text: res.status === 200 ? (await res.text()).slice(0, limit) : '' };
  } catch (e) {
    return { status: 0, url, text: '', error: e.cause?.code ?? e.name };
  }
}

async function checkSite(row) {
  const flags = [];
  const res = await get(row.url);
  if (res.status === 403 || res.status === 429) return { row, flags: [`blocked (${res.status})`] };
  if (res.status !== 200) return { row, flags: [`DEAD (${res.status || res.error})`] };
  if (host(res.url) !== host(row.url)) flags.push(`MOVED to ${host(res.url)}`);
  const title = decode(res.text.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  const meta = decode(res.text.match(/<meta[^>]+(?:name|property)=["'](?:og:)?description["'][^>]+content=["']([\s\S]*?)["']/i)?.[1] ?? '').trim();
  const origin = new URL(res.url).origin;
  const llms = await get(`${origin}/llms.txt`, 8000, 1500);
  const llmsText = llms.status === 200 && !llms.text.trimStart().startsWith('<') ? llms.text : '';
  const saved = words(row.title), now = words(`${title} ${meta} ${llmsText.slice(0, 200)}`);
  const overlap = [...saved].filter((w) => now.has(w)).length / Math.max(1, saved.size);
  if (saved.size >= 3 && overlap < 0.34) flags.push(`DRIFT now "${title.slice(0, 70)}"`); // one- or two-word titles carry too little to compare
  if (row.top_pick !== 'yes' && !row.applications.includes('Agent skills') && AGENT.test(`${title} ${meta} ${llmsText}`)) flags.push('AGENT now mentions MCP / coding agents / skills');
  return { row, flags };
}

async function checkGithub(row) {
  const m = row.url.match(/^https:\/\/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!m) return { row, flags: [] }; // org or profile page
  const headers = { 'user-agent': UA, accept: 'application/vnd.github+json' };
  if (process.env.GITHUB_TOKEN) headers.authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  try {
    const res = await fetch(`https://api.github.com/repos/${m[1]}/${m[2]}`, { headers, signal: AbortSignal.timeout(12000) });
    if (res.status === 404) return { row, flags: ['DEAD (repo gone)'] };
    if (!res.ok) return { row, flags: [`blocked (${res.status})`] };
    const j = await res.json();
    const flags = [];
    if (j.archived) flags.push('GITHUB archived');
    else if (SHOW_STALE && Date.now() - Date.parse(j.pushed_at) > 2 * 365 * 864e5) flags.push(`GITHUB no push since ${j.pushed_at.slice(0, 10)}`);
    return { row, flags };
  } catch {
    return { row, flags: ['blocked (network)'] };
  }
}

// small worker pool so we stay polite
async function pool(items, fn, n = 8) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) { const i = next++; out[i] = await fn(items[i]); }
  }));
  return out;
}

const results = await pool(rows, (r) => (r.url.includes('github.com') ? checkGithub(r) : checkSite(r)));
const flagged = results.filter((r) => r.flags.length && !r.flags.every((f) => f.startsWith('blocked')));
const blocked = results.filter((r) => r.flags.every((f) => f.startsWith('blocked')) && r.flags.length);

console.log(`# Link check\n\n${rows.length} links checked, ${flagged.length} flagged, ${blocked.length} blocked (likely fine in a browser).\n`);
for (const { row, flags } of flagged) {
  console.log(`- **${row.title}** (${row.top_pick === 'yes' ? '★ pick, ' : ''}${row.applications.split(';')[0]})\n  ${row.url}\n  ${flags.join(' · ')}`);
}
if (blocked.length) console.log(`\n## Blocked (not verified)\n\n${blocked.map((b) => `- ${b.row.url} ${b.flags[0]}`).join('\n')}`);
