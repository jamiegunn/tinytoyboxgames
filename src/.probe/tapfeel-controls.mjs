// Controls for tapfeel's confusability metric.
//
// tapfeel came back saying the game has EIGHT distinguishable tap responses and
// ZERO confusable pairs -- that is, no problem to fix. That is the single most
// dangerous answer an instrument can give me, because it is the answer that
// lets me skip work, and this project has already produced several instruments
// that returned a convenient number for a broken reason. So the metric is run
// against rigged signature sets whose right answers are known in advance.
//
//   identical   two outcomes byte-identical.   MUST be confusable.
//   allsame     all eight identical.           MUST collapse to 1 component.
//   alldiff     all eight on distinct sounds.  MUST give 8 components.
//   countonly   identical but for count 10/11. MUST be confusable -- this is the
//               load-bearing one. A metric that separates these is counting
//               struct fields, not perceptions, and would score any cosmetic
//               tweak as a fix.
//   chain       A~B and B~C but A/C far apart. MUST give ONE component of three,
//               which is what makes this a connected-components metric and not
//               a clique metric.
//
// A metric that passes `alldiff` and fails `countonly` is worse than useless: it
// would have rubber-stamped a fix that changed nothing a child can see.

const lin = (u) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
function labOf([r, g, b]) {
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
function paletteDE(a, b) {
  if (!a.length || !b.length) return Infinity;
  const A = a.map(labOf);
  const B = b.map(labOf);
  const dir = (P, Q) => P.reduce((s, p) => s + Math.min(...Q.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))), 0) / P.length;
  return (dir(A, B) + dir(B, A)) / 2;
}

// Identical to tapfeel's analyse, deliberately duplicated rather than imported:
// a control that shares code with the thing it checks can only ever confirm the
// two agree, not that either is right. If these two drift apart the game arm and
// the control arm stop agreeing on the real signatures too, which is visible.
function analyse(sigs, de) {
  const n = sigs.length;
  const adj = Array.from({ length: n }, () => []);
  const confusable = [];
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const dE = sigs[i].preset === sigs[j].preset ? paletteDE(sigs[i].colors, sigs[j].colors) : Infinity;
      if (sigs[i].sound === sigs[j].sound && sigs[i].preset === sigs[j].preset && dE < de) {
        adj[i].push(j);
        adj[j].push(i);
        confusable.push(`${sigs[i].key}~${sigs[j].key}`);
      }
    }
  }
  const comp = new Array(n).fill(-1);
  let c = 0;
  for (let i = 0; i < n; i += 1) {
    if (comp[i] >= 0) continue;
    const stack = [i];
    comp[i] = c;
    while (stack.length) {
      const k = stack.pop();
      for (const q of adj[k]) {
        if (comp[q] < 0) {
          comp[q] = c;
          stack.push(q);
        }
      }
    }
    c += 1;
  }
  const mass = new Map();
  for (let i = 0; i < n; i += 1) mass.set(comp[i], (mass.get(comp[i]) ?? 0) + 1 / n);
  let H = 0;
  for (const p of mass.values()) H -= p * Math.log(p);
  return { components: c, perplexity: +Math.exp(H).toFixed(3), confusable };
}

const BLUE = [[0.5, 0.7, 1.0]];
const mk = (key, sound, preset, colors, count) => ({ key, sound, preset, colors, count });

// A three-link colour chain: each neighbour is under dE 20 of the next, the ends
// are over 20 apart. Values checked below rather than asserted by eye.
const c1 = [[0.5, 0.5, 0.5]];
const c2 = [[0.62, 0.62, 0.62]];
const c3 = [[0.74, 0.74, 0.74]];

const RIGS = {
  identical: {
    sigs: [mk('a', 's1', 'bubblePop', BLUE, 10), mk('b', 's1', 'bubblePop', BLUE, 10), mk('c', 's2', 'sparkle', [[1, 0.85, 0.2]], 15)],
    expect: { components: 2, confusable: ['a~b'] },
  },
  allsame: {
    sigs: Array.from({ length: 8 }, (_, i) => mk(`o${i}`, 's1', 'bubblePop', BLUE, 10)),
    expect: { components: 1, perplexity: 1 },
  },
  alldiff: {
    sigs: Array.from({ length: 8 }, (_, i) => mk(`o${i}`, `s${i}`, 'bubblePop', BLUE, 10)),
    expect: { components: 8, perplexity: 8 },
  },
  countonly: {
    sigs: [mk('a', 's1', 'bubblePop', BLUE, 10), mk('b', 's1', 'bubblePop', BLUE, 11)],
    expect: { components: 1, confusable: ['a~b'] },
  },
  chain: {
    sigs: [mk('a', 's1', 'bubblePop', c1, 10), mk('b', 's1', 'bubblePop', c2, 10), mk('c', 's1', 'bubblePop', c3, 10)],
    expect: { components: 1 },
  },
};

const out = [];
let failures = 0;
for (const [name, rig] of Object.entries(RIGS)) {
  const r = analyse(rig.sigs, 20);
  const checks = [];
  for (const [k, want] of Object.entries(rig.expect)) {
    const got = Array.isArray(want) ? JSON.stringify(r[k]) : r[k];
    const wnt = Array.isArray(want) ? JSON.stringify(want) : want;
    const ok = got === wnt;
    if (!ok) failures += 1;
    checks.push(`${k}: want ${wnt} got ${got} ${ok ? 'PASS' : 'FAIL'}`);
  }
  out.push({ rig: name, components: r.components, perplexity: r.perplexity, confusable: r.confusable, checks });
}

// The chain rig is only a valid test of connected-components if its ends really
// are far apart. Report the three distances so the rig cannot silently rot into
// a trivial case where all three are within dE 20 of each other.
const chainD = { ab: +paletteDE(c1, c2).toFixed(1), bc: +paletteDE(c2, c3).toFixed(1), ac: +paletteDE(c1, c3).toFixed(1) };
if (!(chainD.ab < 20 && chainD.bc < 20 && chainD.ac >= 20)) {
  failures += 1;
  out.push({ rig: 'chain-precondition', checks: [`want ab<20 bc<20 ac>=20, got ${JSON.stringify(chainD)} FAIL`] });
}

console.log(JSON.stringify({ chainDistances: chainD, results: out, failures, verdict: failures === 0 ? 'INSTRUMENT VALID' : 'INSTRUMENT INVALID' }, null, 1));
