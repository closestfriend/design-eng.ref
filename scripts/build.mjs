// Rebuilds everything generated from items.csv:
//   README.md (between the LIST markers), llms.txt, items.json, assets/hero-{light,dark}.svg
// Usage: node scripts/build.mjs        (Node 20+, no dependencies)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VALID_AS_OF = '2026-10-09'; // bump when links are re-checked

// ---------------------------------------------------------------- CSV in
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row); }
  return rows;
}

const [header, ...body] = parseCsv(readFileSync(join(ROOT, 'items.csv'), 'utf8'));
const items = body.map((r) => {
  const o = Object.fromEntries(header.map((h, i) => [h, r[i] ?? '']));
  return {
    title: o.title,
    url: o.url,
    applications: o.applications.split(';').map((s) => s.trim()).filter(Boolean),
    confidence: o.confidence,
    agentReadable: o.agent_readable,
    topPick: o.top_pick === 'yes',
    paid: o.paid === 'yes',
    note: o.note,
    curators: o.curators.split(';').map((s) => s.trim()).filter(Boolean).map((s) => {
      const [name, channel] = s.split('|');
      return { name, channel };
    }),
  };
});

// ------------------------------------------------------- taxonomy + look
// Order is the order of sections, hero columns and llms.txt.
const APPS = [
  ['Core components & primitives', 'Components', '#2f6fed', 'Copy-paste component libraries, UI kits, shadcn-style registries.'],
  ['Micro-interactions & transitions', 'Micro-motion', '#8b5cf6', 'Hover/press/state motion, page transitions, motion libraries.'],
  ['Scroll & page motion', 'Scroll', '#14b8a6', 'Smooth scroll, scroll-driven animation, GSAP choreography.'],
  ['Text effects & type motion', 'Text FX', '#ec4899', 'Animated and kinetic text.'],
  ['Loaders & AI/agent status', 'Loaders', '#f59e0b', 'Spinners, skeletons, thinking and streaming indicators.'],
  ['Backgrounds, shaders & generative visuals', 'Shaders', '#ef4444', 'WebGL, canvas, GLSL, dither, 3D, procedural visuals.'],
  ['Theming, color & tokens', 'Theming', '#84cc16', 'Color systems, theme editors, gradient and shadow generators.'],
  ['Layout & CSS technique', 'CSS', '#06b6d4', 'Modern CSS, HTML and SVG references and techniques.'],
  ['Agent skills & motion vocabulary', 'Agent skills', '#f97316', 'Skill files for coding agents; glossaries for briefing an AI about motion.'],
  ['Inspiration & reference only', 'Inspiration', '#94a3b8', 'Galleries and showcases. Nothing to install; useful for taste.'],
];
const appIndex = new Map(APPS.map((a, i) => [a[0], i]));
const primary = (it) => it.applications[0];

for (const it of items) {
  if (!appIndex.has(primary(it))) throw new Error(`Unknown application "${primary(it)}" for ${it.url}`);
}
const byApp = APPS.map(([name]) => items.filter((it) => primary(it) === name));
const picks = items
  .filter((it) => it.topPick)
  .sort((a, b) => appIndex.get(primary(a)) - appIndex.get(primary(b)) || a.title.localeCompare(b.title));

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const mdEsc = (s) => s.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');

// ------------------------------------------------------------ hero SVGs
function hero(theme) {
  const dark = theme === 'dark';
  const bg = dark ? '#111114' : '#f6f3ee';
  const fg = dark ? '#f2efe8' : '#1b1a17';
  const mute = dark ? '#8d8a82' : '#6d6a62';
  const CELL = 11, GAP = 3, PITCH = CELL + GAP, COLS = 6, BLOCK_GAP = 20;
  const blockW = COLS * PITCH - GAP;
  const totalW = APPS.length * blockW + (APPS.length - 1) * BLOCK_GAP;
  const x0 = Math.round((1200 - totalW) / 2), y0 = 240;
  const maxRows = Math.max(...byApp.map((l) => Math.ceil(l.length / COLS)));
  const H = y0 + maxRows * PITCH + 62;
  let g = '';
  APPS.forEach(([name, short, color], bi) => {
    const x = x0 + bi * (blockW + BLOCK_GAP);
    const list = [...byApp[bi]].sort((a, b) => (b.topPick - a.topPick) || ((a.confidence === 'low') - (b.confidence === 'low')));
    g += `<text x="${x}" y="${y0 - 22}" font-size="12" font-weight="700" fill="${fg}">${esc(short)}</text>`;
    g += `<text x="${x}" y="${y0 - 8}" font-size="11" fill="${mute}">${list.length}</text>`;
    list.forEach((it, i) => {
      const cx = x + (i % COLS) * PITCH, cy = y0 + Math.floor(i / COLS) * PITCH;
      if (it.confidence === 'low') g += `<rect x="${cx + 0.75}" y="${cy + 0.75}" width="${CELL - 1.5}" height="${CELL - 1.5}" rx="2" fill="none" stroke="${color}" stroke-width="1.5"/>`;
      else if (it.topPick) g += `<rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" rx="2" fill="${color}" stroke="${fg}" stroke-width="1.5"/>`;
      else g += `<rect x="${cx}" y="${cy}" width="${CELL}" height="${CELL}" rx="2" fill="${color}"/>`;
    });
  });
  const ly = H - 26;
  const hasLow = items.some((it) => it.confidence === 'low');
  const pickX = hasLow ? 250 : 70; // the "unverified" legend entry only appears when there are unverified links
  const legend = `
  <rect x="${x0}" y="${ly - 9}" width="10" height="10" rx="2" fill="${mute}"/>
  <text x="${x0 + 16}" y="${ly}" font-size="12" fill="${mute}">${hasLow ? 'checked tag' : 'link'}</text>${hasLow ? `
  <rect x="${x0 + 112}" y="${ly - 8.25}" width="8.5" height="8.5" rx="2" fill="none" stroke="${mute}" stroke-width="1.5"/>
  <text x="${x0 + 128}" y="${ly}" font-size="12" fill="${mute}">unverified tag</text>` : ''}
  <rect x="${x0 + pickX}" y="${ly - 9}" width="10" height="10" rx="2" fill="${mute}" stroke="${fg}" stroke-width="1.5"/>
  <text x="${x0 + pickX + 16}" y="${ly}" font-size="12" fill="${mute}">start-here pick</text>
  <text x="${x0 + totalW}" y="${ly}" font-size="12" fill="${mute}" text-anchor="end">one square = one link · valid as of ${VALID_AS_OF}</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 ${H}" width="1200" height="${H}" role="img" aria-labelledby="t d" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, monospace">
  <title id="t">UI references for coding agents</title>
  <desc id="d">A mosaic of ${items.length} links, one square each, grouped into ${APPS.length} columns by the job they do in a UI build.</desc>
  <rect width="1200" height="${H}" rx="18" fill="${bg}"/>
  <text x="${x0}" y="86" font-size="54" font-weight="700" fill="${fg}" font-family="ui-serif, Georgia, 'Times New Roman', serif">UI references</text>
  <text x="${x0}" y="146" font-size="54" font-style="italic" fill="${fg}" font-family="ui-serif, Georgia, 'Times New Roman', serif">for coding agents</text>
  <text x="${x0}" y="182" font-size="15" fill="${mute}">${items.length} links, sorted by the job they do in a build</text>
  ${g}${legend}
</svg>
`;
}

// ------------------------------------------------------------ markdown
const flags = (it) => {
  const f = [];
  if (/llms\.txt/.test(it.agentReadable)) f.push('`llms.txt`');
  if (/shadcn/.test(it.agentReadable)) f.push('shadcn registry');
  if (it.agentReadable === 'github') f.push('GitHub');
  if (it.paid) f.push('paid');
  if (it.confidence === 'low') f.push('_tag unverified_');
  return f;
};
const line = (it) => {
  const f = flags(it), also = it.applications.slice(1);
  return `- ${it.topPick ? '★ ' : ''}[${it.title}](${it.url})${f.length ? ' — ' + f.join(' · ') : ''}${also.length ? ` (also: ${also.join(', ')})` : ''}`;
};

function listMarkdown() {
  const out = [];
  const unverified = items.filter((it) => it.confidence === 'low').length;
  out.push(`**${items.length} links** · valid as of ${VALID_AS_OF} · ${picks.length} start-here picks (★)${unverified ? ` · ${unverified} unverified tags` : ''}\n`);
  out.push('## Start here\n');
  const readable = picks.filter((it) => /llms\.txt|shadcn/.test(it.agentReadable)).length;
  out.push(`Where to start. ${readable} of these ${picks.length} publish \`llms.txt\` or a shadcn registry, so an agent can read the docs or install the code directly.\n`);
  out.push('| Pick | Job | Agent-readable | Note |\n|---|---|---|---|');
  for (const it of picks) {
    out.push(`| [${mdEsc(it.title)}](${it.url}) | ${primary(it)} | ${mdEsc(flags(it).filter((x) => !x.startsWith('_')).join(', ') || '-')} | ${mdEsc(it.note)} |`);
  }
  out.push('\n## Everything, by the job it does\n');
  out.push('Each link sits under its main job; secondary jobs are noted in parentheses. Open a section to browse.\n');
  APPS.forEach(([name, , , desc], i) => {
    const list = byApp[i].slice().sort((a, b) => (b.topPick - a.topPick) || a.title.localeCompare(b.title));
    if (!list.length) return;
    out.push(`<details>\n<summary><b>${esc(name)}</b> (${list.length}) — ${esc(desc)}</summary>\n`);
    out.push(list.map(line).join('\n'));
    out.push('\n</details>\n');
  });
  // credits
  const cur = new Map();
  for (const it of items) for (const c of it.curators) {
    const e = cur.get(c.channel) ?? { ...c, n: 0 };
    e.n++; cur.set(c.channel, e);
  }
  out.push('## Credits\n');
  out.push('Most of these links were found through other people\'s public [Are.na](https://www.are.na) channels. If this list is useful to you, their channels are worth following:\n');
  for (const c of [...cur.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name))) {
    out.push(`- ${c.name}: [${c.channel.split('/').pop()}](${c.channel}) (${c.n})`);
  }
  return out.join('\n');
}

function llmsTxt() {
  const out = ['# UI references for coding agents\n'];
  out.push(`> Index of ${items.length} component libraries, motion/GSAP resources, shaders, theming tools and agent skills for building interfaces, grouped by the job they do in a build. Valid as of ${VALID_AS_OF}. Tags are partly automated; see README.md. Items marked "unverified" are guesses.\n`);
  out.push('## Start here\n');
  for (const it of picks) out.push(`- [${it.title}](${it.url}): ${it.note || primary(it)}`);
  out.push('');
  APPS.forEach(([name, , , desc], i) => {
    if (!byApp[i].length) return;
    out.push(`## ${name}\n\n${desc}\n`);
    for (const it of byApp[i]) {
      const bits = [];
      if (it.agentReadable && it.agentReadable !== 'not found') bits.push(it.agentReadable);
      if (it.paid) bits.push('paid');
      if (it.confidence === 'low') bits.push('unverified tag');
      out.push(`- [${it.title}](${it.url})${bits.length ? ': ' + bits.join(', ') : ''}`);
    }
    out.push('');
  });
  return out.join('\n');
}

// ------------------------------------------------------------- write out
mkdirSync(join(ROOT, 'assets'), { recursive: true });
writeFileSync(join(ROOT, 'assets/hero-light.svg'), hero('light'));
writeFileSync(join(ROOT, 'assets/hero-dark.svg'), hero('dark'));
writeFileSync(join(ROOT, 'llms.txt'), llmsTxt());
writeFileSync(join(ROOT, 'items.json'), JSON.stringify(items.map(({ agentReadable, topPick, ...rest }) => ({ ...rest, agent_readable: agentReadable, top_pick: topPick })), null, 1) + '\n');

const START = '<!-- LIST:START -->', END = '<!-- LIST:END -->';
const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
const a = readme.indexOf(START), b = readme.indexOf(END);
if (a < 0 || b < 0 || b < a) throw new Error('README.md is missing the LIST:START / LIST:END markers');
writeFileSync(join(ROOT, 'README.md'), readme.slice(0, a + START.length) + '\n' + listMarkdown() + '\n' + readme.slice(b));
console.log(`built: ${items.length} items, ${picks.length} picks`);
