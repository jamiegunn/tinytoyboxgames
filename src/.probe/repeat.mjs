// Repeats an arm N times and reports mean +/- sd. The shipped module seeds its
// headings from Math.random, so a single run of onscreen.mjs is one draw from a
// distribution, not a number. Every earlier instrument in this project died of
// treating one run as an answer.
import { execFileSync } from 'node:child_process';
const N = Number(process.env.N || 8);
const arms = [];
for (const range of [35, 18]) for (const moving of ['0', '1']) arms.push({ range, moving });
const stat = (a) => {
  const m = a.reduce((x, y) => x + y, 0) / a.length;
  const sd = Math.sqrt(a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1));
  return [m, sd];
};
const MODULE = process.env.MODULE;
for (const arm of arms) {
  const rows = [];
  for (let i = 0; i < N; i += 1) {
    const env = { ...process.env, RANGE: String(arm.range), MOVING: arm.moving, SECS: String(process.env.SECS || 300) };
    if (MODULE) env.MODULE = MODULE;
    rows.push(JSON.parse(execFileSync('node', ['.probe/onscreen.mjs'], { env, encoding: 'utf8' })));
  }
  const f = (sel) => stat(rows.map(sel));
  const [mm, ms] = f((r) => r.legible.mean);
  const [em, es] = f((r) => r.legible.emptyFrac);
  const [dm, ds] = f((r) => r.distinctSeen);
  const [tm, ts] = f((r) => r.entriesPerMin);
  const sp = rows.reduce((s, r) => s + r.speedingFramesWhileVisible, 0);
  console.log(
    `r${String(arm.range).padEnd(3)} m${arm.moving}  mean=${mm.toFixed(2)}+-${ms.toFixed(2)}  empty=${em.toFixed(3)}+-${es.toFixed(3)}  distinct=${dm.toFixed(1)}+-${ds.toFixed(1)}  ent/min=${tm.toFixed(1)}+-${ts.toFixed(1)}  speeding=${sp}`,
  );
}
