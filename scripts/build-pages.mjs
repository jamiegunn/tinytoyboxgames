/**
 * Assembles the GitHub Pages site into `_site/`:
 *   _site/index.html      → landing page with nav (Play · Docs)
 *   _site/game/           → the built Vite game (placed here by the workflow)
 *   _site/docs/           → the repo's Markdown docs rendered to HTML
 *
 * The game is built separately (vite build --outDir ../_site/game) before this
 * script runs; this script only adds the landing page and the rendered docs.
 * Run from the repo root: `node scripts/build-pages.mjs`.
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, cpSync, existsSync } from 'node:fs';
import { join, dirname, relative, extname, basename } from 'node:path';
import { marked } from 'marked';

const ROOT = process.cwd();
const DOCS = join(ROOT, 'docs');
const SITE = join(ROOT, '_site');

marked.setOptions({ gfm: true, breaks: false });

mkdirSync(SITE, { recursive: true });

const CSS = `
:root { --bg:#f7f1e7; --card:#fffdf8; --ink:#3a332b; --muted:#7c7266; --accent:#e0a24a; --accent2:#7bb0a8; --line:#e7dccb; }
* { box-sizing: border-box; }
body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color:var(--ink); background:var(--bg); line-height:1.6; }
a { color:#b9772a; text-decoration:none; } a:hover { text-decoration:underline; }
.topbar { display:flex; align-items:center; justify-content:space-between; padding:14px 22px; background:var(--card); border-bottom:1px solid var(--line); position:sticky; top:0; }
.topbar .brand { font-weight:700; font-size:1.05rem; color:var(--ink); }
.topbar nav a { margin-left:18px; font-weight:600; }
.doc { max-width:820px; margin:0 auto; padding:32px 22px 80px; }
.doc h1,.doc h2,.doc h3 { line-height:1.25; }
.doc h1 { border-bottom:2px solid var(--line); padding-bottom:.3em; }
.doc code { background:#efe7d8; padding:.15em .4em; border-radius:5px; font-size:.9em; }
.doc pre { background:#2c2822; color:#f3ecdf; padding:14px 16px; border-radius:10px; overflow:auto; }
.doc pre code { background:none; padding:0; color:inherit; }
.doc table { border-collapse:collapse; width:100%; margin:1em 0; }
.doc th,.doc td { border:1px solid var(--line); padding:7px 10px; text-align:left; }
.doc th { background:#f0e7d6; }
.doc img { max-width:100%; border-radius:10px; }
.doc blockquote { border-left:4px solid var(--accent); margin:1em 0; padding:.3em 1em; color:var(--muted); background:#fbf5ea; border-radius:0 8px 8px 0; }
/* landing */
.hero { min-height:calc(100vh - 0px); display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; padding:40px 22px; background:radial-gradient(1200px 600px at 50% -10%, #fff6e6, var(--bg)); }
.hero h1 { font-size:clamp(2.2rem,6vw,4rem); margin:.1em 0 .1em; }
.hero p.tag { font-size:clamp(1rem,2.4vw,1.35rem); color:var(--muted); margin:0 0 2rem; }
.cards { display:flex; gap:22px; flex-wrap:wrap; justify-content:center; }
.card { background:var(--card); border:1px solid var(--line); border-radius:18px; padding:28px 30px; width:280px; box-shadow:0 8px 26px rgba(120,90,40,.08); transition:transform .15s ease, box-shadow .15s ease; }
.card:hover { transform:translateY(-4px); box-shadow:0 14px 34px rgba(120,90,40,.14); text-decoration:none; }
.card .emoji { font-size:2.6rem; }
.card h2 { margin:.4em 0 .2em; color:var(--ink); }
.card p { margin:0; color:var(--muted); font-size:.95rem; }
.foot { color:var(--muted); font-size:.85rem; margin-top:2.5rem; }
.doc ul.docindex { list-style:none; padding:0; }
.doc ul.docindex li { padding:8px 0; border-bottom:1px solid var(--line); }
`;

mkdirSync(join(SITE, 'assets'), { recursive: true });
writeFileSync(join(SITE, 'assets', 'site.css'), CSS.trim());

/**
 * Wraps rendered content in the shared page chrome.
 *
 * @param title - Page title.
 * @param bodyHtml - Inner HTML for the main region.
 * @param depth - Directory depth below the site root (for relative asset paths).
 * @returns A full HTML document string.
 */
function page(title, bodyHtml, depth) {
  const up = '../'.repeat(depth);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} · Tiny Toybox Games</title><link rel="stylesheet" href="${up}assets/site.css"></head>
<body><header class="topbar"><a class="brand" href="${up}index.html">🧸 Tiny Toybox Games</a>
<nav><a href="${up}game/index.html">▶ Play</a><a href="${up}docs/index.html">📖 Docs</a></nav></header>
<main class="doc">${bodyHtml}</main></body></html>`;
}

/** Recursively lists .md files under a directory. */
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (extname(name) === '.md') out.push(full);
  }
  return out;
}

// Copy the whole docs tree (so images/assets referenced by the markdown resolve),
// then render each .md into an .html sibling.
const entries = [];
if (existsSync(DOCS)) {
  cpSync(DOCS, join(SITE, 'docs'), { recursive: true });
  for (const file of walk(DOCS)) {
    const rel = relative(DOCS, file).replace(/\\/g, '/');
    const outRel = rel.replace(/\.md$/, '.html');
    const outPath = join(SITE, 'docs', outRel);
    mkdirSync(dirname(outPath), { recursive: true });
    const depth = 1 + (outRel.split('/').length - 1); // under _site/docs + nesting
    const body = marked.parse(readFileSync(file, 'utf8'));
    writeFileSync(outPath, page(basename(rel, '.md'), body, depth));
    entries.push({ href: outRel, group: dirname(rel) === '.' ? 'Overview' : dirname(rel), name: basename(rel, '.md') });
  }
}

// Docs index, grouped by folder.
const groups = {};
for (const e of entries) (groups[e.group] ??= []).push(e);
let indexBody = `<h1>Documentation</h1><p>Reference docs for Tiny Toybox Games. Source lives in <a href="https://github.com/jamiegunn/tinytoyboxgames/tree/main/docs">/docs</a>.</p>`;
for (const g of Object.keys(groups).sort()) {
  indexBody += `<h2>${g}</h2><ul class="docindex">`;
  for (const e of groups[g].sort((a, b) => a.name.localeCompare(b.name))) {
    indexBody += `<li><a href="${e.href}">${e.name}</a></li>`;
  }
  indexBody += `</ul>`;
}
writeFileSync(join(SITE, 'docs', 'index.html'), page('Docs', indexBody, 1));

// Landing page.
const landing = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Tiny Toybox Games</title><link rel="stylesheet" href="assets/site.css"></head>
<body><section class="hero">
<div class="emoji" style="font-size:3.4rem">🧸</div>
<h1>Tiny Toybox Games</h1>
<p class="tag">A gentle browser-based 3D toybox — where every tap sparks wonder.</p>
<div class="cards">
  <a class="card" href="game/index.html"><div class="emoji">▶️</div><h2>Play the Game</h2><p>Open the toybox and explore the playroom, kitchen, living room, nature, and pirate cove.</p></a>
  <a class="card" href="docs/index.html"><div class="emoji">📖</div><h2>Documentation</h2><p>Vision, design standards, architecture, and current-state reference.</p></a>
</div>
<p class="foot">Built with React + Three.js · <a href="https://github.com/jamiegunn/tinytoyboxgames">Source on GitHub</a></p>
</section></body></html>`;
writeFileSync(join(SITE, 'index.html'), landing);

console.log(`Pages site assembled: ${entries.length} docs rendered into _site/`);
