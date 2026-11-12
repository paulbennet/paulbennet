// Builds the profile SVGs (light + dark) into assets/.
// Run: node scripts/build.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "assets");
mkdirSync(out, { recursive: true });

const themes = {
  dark: {
    bg1: "#0d1117", bg2: "#161b22", fg: "#e6edf3", muted: "#8b949e",
    line: "#30363d", accent: "#58a6ff", accent2: "#f778ba",
    keyW: "#e6edf3", keyB: "#0d1117", keyEdge: "#30363d",
  },
  light: {
    bg1: "#ffffff", bg2: "#f6f8fa", fg: "#1f2328", muted: "#59636e",
    line: "#d1d9e0", accent: "#0969da", accent2: "#bf3989",
    keyW: "#ffffff", keyB: "#1f2328", keyEdge: "#d1d9e0",
  },
};

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace";
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ---------- melody ----------
// Voices play at the same time. Each voice: { hold, events: [[notes, length in units]] }.
// "hold" is the part of each event the keys stay lit. Keyboard range: C3..B6.
// Hold the Line intro, simplified from chord charts: F#m | A/C# | D | E (Esus4) in hammered triplets.
const SONG = "Hold the Line · Toto (intro, simplified)";
const BPM = 96;
const UNIT = 60 / BPM / 3; // one eighth-note triplet
const COUNT_IN = 12; // one silent bar (4 beats) before the song, in units
const bar = (chord, hits = 12) => Array(hits).fill([chord, 1]);
const FSm = ["F#4", "A4", "C#5"], A_C = ["E4", "A4", "C#5"], D = ["F#4", "A4", "D5"];
const E = ["E4", "G#4", "B4"], Esus = ["E4", "A4", "B4"];
const VOICES = [
  { hold: 0.55, events: [...bar(FSm), ...bar(A_C), ...bar(D), ...bar(E, 6), ...bar(Esus, 3), ...bar(E, 3)] },
  { hold: 0.95, events: [[["F#3"], 12], [["C#3"], 12], [["D3"], 12], [["E3"], 12]] },
];

// ---------- header ----------
function header(t) {
  const W = 1000, H = 300, KY = 236, KH = 64;

  // spider web in the top-right corner
  const cx = W, cy = 0, spokes = 7, rings = [45, 90, 135, 180, 225];
  const ang = (i) => Math.PI / 2 + (i * (Math.PI / 2)) / (spokes - 1);
  const pt = (r, i) => [cx + r * Math.cos(ang(i)), cy + r * Math.sin(ang(i))];
  let web = "";
  for (let i = 0; i < spokes; i++) {
    const [x, y] = pt(250, i);
    web += `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  }
  for (const r of rings) {
    const pts = [...Array(spokes).keys()].map((i) => pt(r, i).map((v) => v.toFixed(1)).join(",")).join(" ");
    web += `<polyline points="${pts}"/>`;
  }

  // piano: 28 white keys (C3..B6), black keys in the 2-3 pattern.
  // Each key that the melody uses gets its own keyframes, so it lights up on its notes.
  const n = 28, kw = W / n;
  const hasBlack = [1, 1, 0, 1, 1, 1, 0]; // after C D (no E) F G A (no B)
  const step = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };
  const keyOf = (note) => {
    const [, l, sharp, o] = note.match(/^([A-G])(#?)(\d)$/);
    return `${sharp ? "b" : "w"}${(+o - 3) * 7 + step[l]}`;
  };
  const timeline = {}; // key id -> [[start, end], ...] in units
  let total = 0;
  for (const { hold, events } of VOICES) {
    let t0 = COUNT_IN;
    for (const [notes, len] of events) {
      for (const note of notes) (timeline[keyOf(note)] ??= []).push([t0, t0 + len * hold]);
      t0 += len;
    }
    total = Math.max(total, t0);
  }
  for (const spans of Object.values(timeline)) spans.sort((a, b) => a[0] - b[0]);
  const dur = (total * UNIT).toFixed(2);
  const pct = (u) => ((u / total) * 100).toFixed(3);
  let css = "";
  for (const [id, spans] of Object.entries(timeline)) {
    const lit = id[0] === "w" ? t.accent : t.accent2;
    const base = id[0] === "w" ? t.keyW : t.keyB;
    const frames = spans.map(([a, b]) => `${pct(a)}%{fill:${lit}}${pct(b)}%{fill:${base}}`).join("");
    css += `#${id}{animation:${id} ${dur}s step-end infinite}@keyframes ${id}{0%{fill:${base}}${frames}100%{fill:${base}}}\n`;
  }
  // beat dots before the song title: one dot per beat, beat 1 in accent2.
  // They also count the silent first bar in. The bar loop divides the song loop, so they stay in sync.
  const barDur = (UNIT * 12).toFixed(4);
  let dots = "";
  for (let k = 0; k < 4; k++) {
    const lit = k === 0 ? t.accent2 : t.accent, a = k * 25, b = a + 20;
    const frames = k === 0
      ? `0%{fill:${lit}}${b}%{fill:${t.line}}`
      : `0%{fill:${t.line}}${a}%{fill:${lit}}${b}%{fill:${t.line}}`;
    css += `#beat${k}{animation:beat${k} ${barDur}s step-end infinite}@keyframes beat${k}{${frames}100%{fill:${t.line}}}\n`;
    dots += `<tspan id="beat${k}" class="beat">●</tspan>${k < 3 ? " " : ""}`;
  }

  let white = "", black = "";
  for (let i = 0; i < n; i++) {
    white += `<rect id="w${i}" x="${(i * kw).toFixed(2)}" y="${KY}" width="${kw.toFixed(2)}" height="${KH}"/>`;
    if (hasBlack[i % 7] && i < n - 1)
      black += `<rect id="b${i}" x="${(i * kw + kw * 0.68).toFixed(2)}" y="${KY}" width="${(kw * 0.64).toFixed(2)}" height="${KH * 0.6}" rx="2"/>`;
  }

  const tagline = "> lead web developer @ zoho";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Paul Bennet, lead web developer at Zoho">
<title>Paul Bennet</title>
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.bg1}"/><stop offset="1" stop-color="${t.bg2}"/></linearGradient>
  <linearGradient id="name" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient>
  <clipPath id="card"><rect width="${W}" height="${H}" rx="18"/></clipPath>
  <clipPath id="type"><rect x="56" y="140" width="0" height="40"><animate attributeName="width" from="0" to="620" begin="0.4s" dur="1.6s" fill="freeze" calcMode="discrete" values="0;24;48;72;96;120;144;168;192;216;240;264;288;312;336;360;384;408;432;456;480;504;528;552;576;600;620" keyTimes="0;0.04;0.08;0.12;0.16;0.2;0.24;0.28;0.32;0.36;0.4;0.44;0.48;0.52;0.56;0.6;0.64;0.68;0.72;0.76;0.8;0.84;0.88;0.92;0.96;0.98;1"/></rect></clipPath>
</defs>
<style>
  .keys rect { fill: ${t.keyW}; stroke: ${t.keyEdge}; stroke-width: 1; }
  .blacks rect { fill: ${t.keyB}; }
  .beat { fill: ${t.line}; }
${css}  @media (prefers-reduced-motion: reduce) { .keys rect, .blacks rect, .beat { animation: none; } }
</style>
<g clip-path="url(#card)">
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <g stroke="${t.muted}" stroke-opacity="0.35" stroke-width="1.2" fill="none">${web}</g>
  <g>
    <line x1="860" y1="95" x2="860" y2="150" stroke="${t.muted}" stroke-opacity="0.6" stroke-width="1"/>
    <circle cx="860" cy="156" r="7" fill="${t.fg}"/>
    <g stroke="${t.fg}" stroke-width="1.4" fill="none" stroke-linecap="round">
      <path d="M854 152 l-8 -5 M854 156 l-9 0 M854 160 l-8 5 M866 152 l8 -5 M866 156 l9 0 M866 160 l8 5"/>
    </g>
    <animateTransform attributeName="transform" type="rotate" values="-6 860 95; 6 860 95; -6 860 95" dur="4s" repeatCount="indefinite"/>
  </g>
  <text x="56" y="112" font-family="${SANS}" font-size="60" font-weight="800" fill="url(#name)" letter-spacing="-1">Paul Bennet</text>
  <g clip-path="url(#type)">
    <text x="56" y="168" font-family="${MONO}" font-size="24" fill="${t.fg}">${esc(tagline)}<tspan fill="${t.accent}">▋<animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></tspan></text>
  </g>
  <text x="56" y="206" font-family="${SANS}" font-size="18" fill="${t.muted}">🕸️ web  ·  🎮 games  ·  🎹 keys  ·  Chennai, India</text>
  <text x="${W - 24}" y="${KY - 12}" text-anchor="end" font-family="${SANS}" font-size="13" fill="${t.muted}"><tspan font-size="18" aria-hidden="true">${dots}</tspan><tspan dx="10">♪ ${esc(SONG)}</tspan></text>
  <g class="keys">${white}</g>
  <g class="blacks">${black}</g>
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="18" fill="none" stroke="${t.line}"/>
</svg>
`;
}

// ---------- project cards ----------
const lang = {
  JavaScript: "#f1e05a", TypeScript: "#3178c6", Java: "#b07219", HTML: "#e34c26",
};

const cards = [
  { id: "AndroidTVLauncher", icon: "📺", tag: "TV launcher", lang: "JavaScript",
    desc: ["Skinnable HTML/CSS/JS home screen for", "Android TV and Google TV. 9 skins."] },
  { id: "agent-response-config", icon: "💬", tag: "Claude plugin", lang: "JavaScript",
    desc: ["Short, structured agent replies you answer", "by ID. Skill and plugin for Claude, Codex."] },
  { id: "afk-mode-mcp", icon: "📱", tag: "MCP server", lang: "TypeScript",
    desc: ["Watch and answer VS Code Copilot", "from your phone while you are away."] },
  { id: "html-in-canvas-examples", icon: "✨", tag: "WebGL", lang: "TypeScript",
    desc: ["Shader effects on live, interactive DOM", "with Chrome's HTML-in-Canvas API."] },
  { id: "tab-reuse-manager", icon: "🗂️", tag: "Chrome extension", lang: "JavaScript",
    desc: ["Reuses open tabs for groups of related", "sites. No more duplicate tabs."] },
  { id: "server-webclient-data-transfer-perf", title: "data-transfer-perf", icon: "⏱️", tag: "Benchmark", lang: "HTML",
    desc: ["7 serialization formats, server to", "browser, measured end to end."] },
  { id: "json-object-list-perf", icon: "📊", tag: "Benchmark", lang: "Java",
    desc: ["Java JSON libraries on large payloads:", "Jackson, Gson, Moshi, org.json, JMH."] },
  { id: "topic-based-ws-messaging-demo", icon: "📡", tag: "WebSockets", lang: "JavaScript",
    desc: ["Topic-based publish/subscribe over", "WebSockets, with subscriber and broadcaster."] },
];

function card(c, t) {
  const W = 480, H = 150;
  const title = c.title ?? c.id;
  const tagW = c.tag.length * 7.4 + 22;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(title)}: ${esc(c.desc.join(" "))}">
<title>${esc(title)}</title>
<defs><linearGradient id="bar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}"/></linearGradient>
<clipPath id="c"><rect width="${W}" height="${H}" rx="14"/></clipPath></defs>
<g clip-path="url(#c)">
  <rect width="${W}" height="${H}" fill="${t.bg2}"/>
  <rect width="5" height="${H}" fill="url(#bar)"/>
</g>
<rect x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="14" fill="none" stroke="${t.line}"/>
<text x="26" y="42" font-family="${SANS}" font-size="20">${c.icon}</text>
<text x="56" y="41" font-family="${SANS}" font-size="19" font-weight="700" fill="${t.accent}">${esc(title)}</text>
<text font-family="${SANS}" font-size="15" fill="${t.muted}">
  <tspan x="26" y="76">${esc(c.desc[0])}</tspan>
  <tspan x="26" y="98">${esc(c.desc[1])}</tspan>
</text>
<circle cx="32" cy="127" r="6" fill="${lang[c.lang]}"/>
<text x="45" y="132" font-family="${SANS}" font-size="13" fill="${t.muted}">${c.lang}</text>
<rect x="${W - 22 - tagW}" y="113" width="${tagW}" height="24" rx="12" fill="none" stroke="${t.line}"/>
<text x="${W - 22 - tagW / 2}" y="130" text-anchor="middle" font-family="${MONO}" font-size="12" fill="${t.fg}">${esc(c.tag)}</text>
</svg>
`;
}

for (const [name, t] of Object.entries(themes)) {
  writeFileSync(join(out, `header-${name}.svg`), header(t));
  for (const c of cards) writeFileSync(join(out, `${c.id}-${name}.svg`), card(c, t));
}

// ---------- README ----------
const pic = (base, alt, width) =>
  `<picture><source media="(prefers-color-scheme: dark)" srcset="assets/${base}-dark.svg"><img alt="${alt}" src="assets/${base}-light.svg" width="${width}"></picture>`;

const grid = [];
for (let i = 0; i < cards.length; i += 2) {
  grid.push(
    cards.slice(i, i + 2)
      .map((c) => `<a href="https://github.com/paulbennet/${c.id}">${pic(c.id, c.title ?? c.id, "49%")}</a>`)
      .join("\n"),
  );
}

const readme = `<div align="center">

${pic("header", "Paul Bennet, lead web developer at Zoho", "100%")}

<a href="https://paulbennetjoshua.dev"><b>paulbennetjoshua.dev</b></a>

</div>

I build browser tools, developer tools and performance benchmarks. Lately: AI agent workflows, new Chrome APIs, web home screens for Android TV, and making data move faster from server to browser.

### 🧰 Things I made

<div align="center">

${grid.join("\n<br>\n")}

</div>

### ✍️ Writing

- [Your Android TV home screen is a web page now](https://dev.to/paulbennetjoshua/your-android-tv-home-screen-is-a-web-page-now-an-open-launcher-anyone-can-reskin-3ld5) · Nov 2026
- [Stop scrolling agent replies](https://dev.to/paulbennetjoshua/stop-scrolling-agent-replies-1o17) · Nov 2026

### 🛠️ Stack

\`JavaScript\` \`TypeScript\` \`Java\` \`Node.js\` \`WebGL\` \`Chrome extensions\` \`Android TV\` \`MCP\` \`WebSockets\`

<div align="center"><sub>🎮 when the build runs · 🎹 when it passes</sub></div>
`;
writeFileSync(join(out, "..", "README.md"), readme);
console.log("built", Object.keys(themes).length * (cards.length + 1), "svgs + README.md");
