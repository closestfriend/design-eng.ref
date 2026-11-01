// Rebuilds everything generated from items.csv:
//   README.md (between the LIST markers), llms.txt, items.json, assets/hero-{light,dark}.svg
// Usage: node scripts/build.mjs        (Node 20+, no dependencies)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv } from './csv.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VALID_AS_OF = '2026-10-09'; // bump when links are re-checked

// ---------------------------------------------------------------- CSV in
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
  const bg = dark ? '#08090c' : '#faf9f7';
  const cardBg = dark ? '#0f1015' : '#ffffff';
  const border = dark ? '#1e2029' : '#e2e2e8';
  const innerBorder = dark ? '#1b1d26' : '#eae9ef';
  const trackBg = dark ? '#181922' : '#edecee';
  const fg = dark ? '#f4f4f7' : '#131316';
  const mute = dark ? '#8b8d99' : '#6b6c7a';
  const faint = dark ? '#4c4e5e' : '#9c9da8';
  const accentBlue = dark ? '#38bdf8' : '#0284c7';
  const accentAmber = dark ? '#f59e0b' : '#d97706';
  const statusGreen = dark ? '#10b981' : '#059669';

  const mono = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
  const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

  const agentReady = items.filter((it) => /llms\.txt|shadcn/.test(it.agentReadable)).length;
  const maxCatCount = Math.max(...byApp.map((l) => l.length), 1);

  // 10 category cards arranged in 5 columns x 2 rows
  const cardW = 208, cardH = 72, gapX = 16, gapY = 12;
  const startX = 48, startY = 252;

  let catSvg = '';
  APPS.forEach(([fullName, short, color], i) => {
    const list = byApp[i];
    const count = list.length;
    const catPicks = list.filter((it) => it.topPick).length;
    const col = i % 5;
    const row = Math.floor(i / 5);
    const x = startX + col * (cardW + gapX);
    const y = startY + row * (cardH + gapY);
    const barW = Math.max(8, Math.round(184 * (count / maxCatCount)));
    const num = (i + 1).toString().padStart(2, '0');

    catSvg += `
    <g transform="translate(${x}, ${y})">
      <rect width="${cardW}" height="${cardH}" rx="8" fill="${cardBg}" stroke="${innerBorder}" stroke-width="1"/>
      <text x="12" y="20" font-family="${mono}" font-size="10" font-weight="500" fill="${faint}">// ${num}</text>
      <circle cx="194" cy="17" r="3.5" fill="${color}"/>
      <text x="12" y="38" font-family="${sans}" font-size="13" font-weight="600" fill="${fg}">${esc(short)}</text>
      <rect x="12" y="47" width="184" height="3" rx="1.5" fill="${trackBg}"/>
      <rect x="12" y="47" width="${barW}" height="3" rx="1.5" fill="${color}"/>
      <text x="12" y="62" font-family="${mono}" font-size="10" fill="${mute}">${count} items</text>
      <text x="196" y="62" font-family="${mono}" font-size="10" font-weight="600" fill="${catPicks > 0 ? accentAmber : faint}" text-anchor="end">${catPicks > 0 ? `${catPicks} ★` : '—'}</text>
    </g>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 448" width="1200" height="448" role="img" aria-labelledby="t d">
  <title id="t">Design Engineer References</title>
  <desc id="d">Directory and category breakdown of ${items.length} design-engineering resources across ${APPS.length} build domains with ${picks.length} start-here picks and ${agentReady} agent-ready docs.</desc>

  <!-- Container -->
  <rect width="1200" height="448" rx="14" fill="${bg}"/>
  <rect x="1" y="1" width="1198" height="446" rx="13" fill="none" stroke="${border}" stroke-width="1"/>

  <!-- Top System Bar -->
  <circle cx="60" cy="36" r="4" fill="${statusGreen}"/>
  <text x="74" y="40" font-family="${mono}" font-size="11" font-weight="600" fill="${fg}" letter-spacing="0.05em">DESIGN-ENG.REF</text>
  <text x="206" y="40" font-family="${mono}" font-size="11" fill="${faint}">// SYSTEM SPEC &amp; BREAKDOWN</text>
  
  <text x="1152" y="40" font-family="${mono}" font-size="11" fill="${mute}" text-anchor="end">INDEX: ${items.length} NODES · ${APPS.length} DOMAINS · CC0-1.0</text>
  <line x1="48" y1="54" x2="1152" y2="54" stroke="${border}" stroke-width="1"/>

  <!-- Middle Tier: Left Typography Masthead -->
  <g transform="translate(48, 86)">
    <text x="0" y="20" font-family="${mono}" font-size="11" font-weight="600" fill="${accentBlue}" letter-spacing="0.08em">DESIGN ENGINEER REFERENCES</text>
    <text x="0" y="58" font-family="${sans}" font-size="34" font-weight="700" fill="${fg}" letter-spacing="-0.03em">A canonical index for UI craft.</text>
    <text x="0" y="88" font-family="${sans}" font-size="14" fill="${mute}">Component primitives, micro-motion, shaders, styling systems &amp; agent skills.</text>
    <text x="0" y="116" font-family="${mono}" font-size="11" fill="${faint}">SORTED BY JOB IN BUILD · CURATED BY CLOSESTFRIEND · SHIPS LLMS.TXT</text>
  </g>

  <!-- Middle Tier: Right Metric Readouts (3 Stat Cards) -->
  <g transform="translate(640, 78)">
    <!-- Stat 1: Total Links -->
    <g transform="translate(0, 0)">
      <rect width="158" height="124" rx="10" fill="${cardBg}" stroke="${innerBorder}" stroke-width="1"/>
      <text x="16" y="26" font-family="${mono}" font-size="10" font-weight="600" fill="${faint}" letter-spacing="0.06em">TOTAL REFS</text>
      <text x="16" y="68" font-family="${sans}" font-size="36" font-weight="700" fill="${fg}" letter-spacing="-0.02em">${items.length}</text>
      <text x="16" y="94" font-family="${mono}" font-size="10" fill="${mute}">Live entries</text>
      <line x1="16" y1="104" x2="142" y2="104" stroke="${border}" stroke-width="1"/>
      <text x="16" y="116" font-family="${mono}" font-size="9" fill="${faint}">100% curated</text>
    </g>

    <!-- Stat 2: Curated Picks -->
    <g transform="translate(176, 0)">
      <rect width="158" height="124" rx="10" fill="${cardBg}" stroke="${innerBorder}" stroke-width="1"/>
      <text x="16" y="26" font-family="${mono}" font-size="10" font-weight="600" fill="${accentAmber}" letter-spacing="0.06em">START HERE</text>
      <text x="16" y="68" font-family="${sans}" font-size="36" font-weight="700" fill="${accentAmber}" letter-spacing="-0.02em">${picks.length} <tspan font-size="24">★</tspan></text>
      <text x="16" y="94" font-family="${mono}" font-size="10" fill="${mute}">Selected picks</text>
      <line x1="16" y1="104" x2="142" y2="104" stroke="${border}" stroke-width="1"/>
      <text x="16" y="116" font-family="${mono}" font-size="9" fill="${faint}">Highest leverage</text>
    </g>

    <!-- Stat 3: Agent Ready -->
    <g transform="translate(352, 0)">
      <rect width="158" height="124" rx="10" fill="${cardBg}" stroke="${innerBorder}" stroke-width="1"/>
      <text x="16" y="26" font-family="${mono}" font-size="10" font-weight="600" fill="${accentBlue}" letter-spacing="0.06em">AGENT READY</text>
      <text x="16" y="68" font-family="${sans}" font-size="36" font-weight="700" fill="${accentBlue}" letter-spacing="-0.02em">${agentReady}</text>
      <text x="16" y="94" font-family="${mono}" font-size="10" fill="${mute}">Machine docs</text>
      <line x1="16" y1="104" x2="142" y2="104" stroke="${border}" stroke-width="1"/>
      <text x="16" y="116" font-family="${mono}" font-size="9" fill="${faint}">llms.txt / shadcn</text>
    </g>
  </g>

  <!-- Lower Section Divider -->
  <line x1="48" y1="224" x2="1152" y2="224" stroke="${border}" stroke-width="1"/>
  <text x="48" y="238" font-family="${mono}" font-size="10" font-weight="600" fill="${faint}" letter-spacing="0.06em">TAXONOMY // DOMAIN DISTRIBUTION</text>
  <text x="1152" y="238" font-family="${mono}" font-size="10" fill="${faint}" text-anchor="end">${APPS.length} ACTIVE DOMAINS</text>

  <!-- Bottom Tier: 10 Categories -->
  ${catSvg}

  <!-- Bottom Footer Line -->
  <text x="48" y="432" font-family="${mono}" font-size="9" fill="${faint}">SPEC: DESIGN-ENG.REF · BUILT FROM ITEMS.CSV · VALID AS OF ${VALID_AS_OF}</text>
  <text x="1152" y="432" font-family="${mono}" font-size="9" fill="${faint}" text-anchor="end">GITHUB.COM/CLOSESTFRIEND/DESIGN-ENG.REF</text>
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
  const out = ['# Design Engineer References\n'];
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
