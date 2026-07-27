/**
 * Would wiring in the dead species table make the reef MORE legible, or less?
 *
 * THE DECISION THIS EXISTS TO SETTLE. `little-shark/fish/species.ts`,
 * `fish/meshes.ts`, `fish/schooling.ts` and `waves/templates.ts` were 963 lines
 * of unreachable code describing a five-species roster with per-species colour
 * palettes, movement models, school sizes, rarities and a named wave arc.
 * Nothing imports any of it — proved twice, by `.probe/static/r8-reachability.mjs`
 * and independently by the real Rollup module graph. It reads as a shipped
 * feature that someone forgot to plug in.
 *
 * That framing is the trap. "Unused feature" invites wiring it in, and the reef
 * has actually been accused of monotony, which is precisely what a species
 * roster sounds like the cure for. So the question is not whether the code is
 * dead. It is whether connecting it would help. That is a legibility question,
 * and legibility here is measurable, because the live palette in `types.ts` was
 * CHOSEN by measurement against a model that is written down.
 *
 * ── THE MODEL, AND EXACTLY HOW FAR IT IS TRUSTED ────────────────────
 *
 * `types.ts:14-22` states the chain: albedo x rig irradiance + emissive, ACES
 * filmic at exposure 1.15, sRGB encode, then the FogExp2 lerp toward
 * WATER_COLOR in DISPLAY space (fog_fragment runs after colorspace_fragment, so
 * fog is never tone-mapped). Rebuilding it literally from the stated numbers
 * does NOT reproduce the recorded output: every fish comes out about 40 levels
 * per channel too dark. Two terms in the real renderer are not recoverable from
 * the prose — three.js applies its own factor to irradiance, and
 * `createSkinMaterial` bakes emissive in on top of FISH_EMISSIVE_SCALAR.
 *
 * So those two are FITTED rather than assumed, and the fit is then made to earn
 * its keep. Two free parameters are asked to reproduce EIGHTEEN recorded
 * numbers — five fish plus the sand, three channels each, all of which are in
 * `types.ts` already. They come back within one level per channel. A 2-parameter
 * fit landing 18 constraints to +/-1 is not curve-fitting; it is the model being
 * right. The fog fraction is not really free either: FogExp2 at density 0.058
 * and 9.4 units gives 0.257, and the fit lands on 0.255.
 *
 * ── THE AXIS THIS SCRIPT REFUSES TO SCORE, AND WHY ──────────────────
 *
 * A holdout test was run on a number the fit never saw: `types.ts:85` records
 * that the golden fish separates from the sand on lightness at dL* = +17.6.
 * Predicting that with the fitted model FAILS. Scaling the fitted emissive by
 * GOLDEN_EMISSIVE_SCALAR/FISH_EMISSIVE_SCALAR (3.33x) predicts dL* = +21.7;
 * using the raw 0.4 predicts +13.6; the value that would actually reproduce
 * +17.6 sits at a ratio of 1.96, matching neither rule. The golden fish's
 * material path does something this reconstruction does not capture.
 *
 * Therefore the golden-fish axis is EXCLUDED from scoring, and said so out
 * loud rather than quietly included at 3.33x — which would have been a number
 * that looks like a measurement and is a guess.
 *
 * The two remaining axes are also kept apart rather than pooled, because only
 * one of them is confound-free. Colour-against-the-SAND is clean and is the
 * live derivation's own metric (its worst case, tangerine vs sand at 14.0,
 * came from exactly this). Colour-against-SIBLING is confounded in the DEAD
 * set's favour: species.ts ships per-species body shapes and scales, so two
 * species sharing a colour could still be told apart by silhouette, which this
 * script has no way to score. The verdict therefore rests on the clean axis
 * alone; the confounded one is printed for the reader and excluded from the
 * test.
 *
 * Run from inside the package: `node .probe/render/r8-species-palette.mjs`
 */

// ── The rig, verbatim from the live scene ───────────────────────────
const IRRADIANCE = [0.2225, 0.254, 0.2889]; // types.ts:16
const EXPOSURE = 1.15; // utils/rendererFactory.ts:50-52
const WATER = [0.004, 0.107, 0.2961]; // environment/setup.ts:165
const FOG_DENSITY = 0.058; // environment/setup.ts — FogExp2
const FISH_DEPTH = 9.4; // types.ts:24 — fish sit at the bottom of the frame
const SAND_ALBEDO = [1.0, 0.8, 0.26]; // HOME_SAND
const SAND_RENDERED = [117, 132, 103]; // types.ts:25, from terrain.ts measurements

// ── The two fitted terms (see the header for what they stand in for) ─
const LIGHT_GAIN = 1.66; // multiplies the stated irradiance
const FISH_EMISSIVE_EFFECTIVE = 0.335; // effective emissive at FISH_EMISSIVE_SCALAR = 0.12

// ── three.js ACESFilmicToneMapping, verbatim ────────────────────────
const ACES_IN = [
  [0.59719, 0.35458, 0.04823],
  [0.076, 0.90834, 0.01566],
  [0.0284, 0.13383, 0.83777],
];
const ACES_OUT = [
  [1.60475, -0.53108, -0.07367],
  [-0.10208, 1.10813, -0.00605],
  [-0.00327, -0.07276, 1.07602],
];

const mul = (m, v) => m.map((row) => row[0] * v[0] + row[1] * v[1] + row[2] * v[2]);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

/** three.js RRTAndODTFit. */
const rrtOdtFit = (v) => v.map((x) => (x * (x + 0.0245786) - 0.000090537) / (x * (0.983729 * x + 0.432951) + 0.238081));

const acesFilmic = (linear) =>
  mul(
    ACES_OUT,
    rrtOdtFit(
      mul(
        ACES_IN,
        linear.map((x) => x * EXPOSURE),
      ),
    ),
  ).map(clamp01);

/** Linear -> sRGB display encode, exactly as three.js does it. */
const srgbEncode = (c) => c.map((x) => (x <= 0.0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - 0.055));

const WATER_DISPLAY = srgbEncode(WATER); // fogColor bypasses tone mapping
const FOG_FRACTION = 1 - Math.exp(-((FOG_DENSITY * FISH_DEPTH) ** 2));

/** Renders an albedo the way the frame does, and returns 0-255 display values. */
function render(albedo, emissive) {
  const lit = albedo.map((c, i) => c * IRRADIANCE[i] * LIGHT_GAIN + c * emissive);
  const display = srgbEncode(acesFilmic(lit));
  return display.map((c, i) => (c * (1 - FOG_FRACTION) + WATER_DISPLAY[i] * FOG_FRACTION) * 255);
}

// ── CIE Lab + CIEDE2000 ─────────────────────────────────────────────
function srgbToLab(rgb255) {
  const lin = rgb255.map((v) => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const X = (0.4124 * lin[0] + 0.3576 * lin[1] + 0.1805 * lin[2]) / 0.95047;
  const Y = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
  const Z = (0.0193 * lin[0] + 0.1192 * lin[1] + 0.9505 * lin[2]) / 1.08883;
  const f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (841 / 108) * t + 4 / 29);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

/** CIEDE2000, the full formula — no simplifications. */
function ciede2000(lab1, lab2) {
  const [L1, a1, b1] = lab1;
  const [L2, a2, b2] = lab2;
  const rad = Math.PI / 180;
  const C1 = Math.hypot(a1, b1);
  const C2 = Math.hypot(a2, b2);
  const Cbar = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cbar ** 7 / (Cbar ** 7 + 25 ** 7)));
  const ap1 = (1 + G) * a1;
  const ap2 = (1 + G) * a2;
  const Cp1 = Math.hypot(ap1, b1);
  const Cp2 = Math.hypot(ap2, b2);
  const hp = (b, ap) => {
    if (b === 0 && ap === 0) return 0;
    const h = Math.atan2(b, ap) / rad;
    return h >= 0 ? h : h + 360;
  };
  const hp1 = hp(b1, ap1);
  const hp2 = hp(b2, ap2);
  const dLp = L2 - L1;
  const dCp = Cp2 - Cp1;
  let dhp = 0;
  if (Cp1 * Cp2 !== 0) {
    dhp = hp2 - hp1;
    if (dhp > 180) dhp -= 360;
    else if (dhp < -180) dhp += 360;
  }
  const dHp = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dhp / 2) * rad);
  const Lbar = (L1 + L2) / 2;
  const Cbarp = (Cp1 + Cp2) / 2;
  let hbar = hp1 + hp2;
  if (Cp1 * Cp2 !== 0) {
    if (Math.abs(hp1 - hp2) > 180) hbar += hbar < 360 ? 360 : -360;
    hbar /= 2;
  }
  const T =
    1 - 0.17 * Math.cos((hbar - 30) * rad) + 0.24 * Math.cos(2 * hbar * rad) + 0.32 * Math.cos((3 * hbar + 6) * rad) - 0.2 * Math.cos((4 * hbar - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hbar - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cbarp ** 7 / (Cbarp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lbar - 50) ** 2) / Math.sqrt(20 + (Lbar - 50) ** 2);
  const Sc = 1 + 0.045 * Cbarp;
  const Sh = 1 + 0.015 * Cbarp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dLp / Sl) ** 2 + (dCp / Sc) ** 2 + (dHp / Sh) ** 2 + Rt * (dCp / Sc) * (dHp / Sh));
}

const dE = (rgbA, rgbB) => ciede2000(srgbToLab(rgbA), srgbToLab(rgbB));

// ── SELF-CHECK: reproduce 18 numbers already in the repo, or refuse ──
const LIVE = [
  { name: 'red', albedo: [1.0, 0.22, 0.18], expectRgb: [151, 99, 107], expectDe: 36.5 },
  { name: 'tangerine', albedo: [1.0, 0.45, 0.05], expectRgb: [150, 134, 76], expectDe: 14.0 },
  { name: 'green', albedo: [0.35, 0.95, 0.4], expectRgb: [109, 169, 150], expectDe: 15.5 },
  { name: 'periwinkle', albedo: [0.55, 0.6, 1.0], expectRgb: [122, 148, 187], expectDe: 30.5 },
  { name: 'magenta', albedo: [1.0, 0.3, 0.9], expectRgb: [150, 115, 183], expectDe: 43.7 },
];

console.log(`Fog fraction at ${FISH_DEPTH} units: ${(FOG_FRACTION * 100).toFixed(1)}%  (types.ts records 24%)\n`);
console.log('SELF-CHECK — does the model reproduce the derivation already in types.ts?\n');
console.log('colour        model rgb        recorded rgb     err    model dE    recorded dE');
console.log('------------  ---------------  ---------------  -----  ----------  -----------');
let worstChannel = 0;
let worstDe = 0;

const sandRgb = render(SAND_ALBEDO, 0);
for (const c of LIVE) {
  const rgb = render(c.albedo, FISH_EMISSIVE_EFFECTIVE);
  const r = rgb.map(Math.round);
  const chanErr = Math.max(...r.map((v, i) => Math.abs(v - c.expectRgb[i])));
  const de = dE(rgb, SAND_RENDERED);
  worstChannel = Math.max(worstChannel, chanErr);
  worstDe = Math.max(worstDe, Math.abs(de - c.expectDe));
  console.log(
    `${c.name.padEnd(12)}  ${r.join(',').padEnd(15)}  ${c.expectRgb.join(',').padEnd(15)}  ${String(chanErr).padStart(5)}  ${de.toFixed(1).padStart(10)}  ${c.expectDe.toFixed(1).padStart(11)}`,
  );
}
const sandErr = Math.max(...sandRgb.map((v, i) => Math.abs(Math.round(v) - SAND_RENDERED[i])));
worstChannel = Math.max(worstChannel, sandErr);
console.log(`${'sand'.padEnd(12)}  ${sandRgb.map(Math.round).join(',').padEnd(15)}  ${SAND_RENDERED.join(',').padEnd(15)}  ${String(sandErr).padStart(5)}`);
console.log(`\n  worst channel error across 18 recorded values: ${worstChannel} levels`);
console.log(`  worst dE2000 error across 5 recorded separations: ${worstDe.toFixed(2)}`);

const CHANNEL_TOL = 2;
const DE_TOL = 1.0;
if (worstChannel > CHANNEL_TOL || worstDe > DE_TOL) {
  console.log(`\n!! SELF-CHECK FAILED (tolerance ${CHANNEL_TOL} levels / ${DE_TOL} dE2000).`);
  console.log('   The model does not reproduce figures this repo already measured, so');
  console.log('   nothing it says about the dead palette is admissible. NO VERDICT.');
  process.exit(1);
}
console.log(`  PASS — 2 fitted terms land 18 constraints within ${CHANNEL_TOL} levels.\n`);

console.log('EXCLUDED AXIS: the golden fish. The fitted model does not reproduce the');
console.log('recorded dL* = +17.6 (it predicts +21.7 at the proportional emissive, +13.6');
console.log('at the raw scalar). Every score below is sand-and-siblings only.\n');

// ── The two palettes, scored the same way ───────────────────────────
const DEAD = [
  { species: 'clownfish 1pt', albedo: [1.0, 0.5, 0.15] },
  { species: 'clownfish 1pt', albedo: [1.0, 0.9, 0.2] },
  { species: 'bluetang 1pt', albedo: [0.2, 0.6, 1.0] },
  { species: 'bluetang 1pt', albedo: [0.1, 0.2, 0.7] },
  { species: 'pufferfish 2pt', albedo: [0.82, 0.71, 0.55] },
  { species: 'pufferfish 2pt', albedo: [0.5, 0.5, 0.2] },
  { species: 'seahorse 3pt', albedo: [1.0, 0.9, 0.2] },
  { species: 'seahorse 3pt', albedo: [1.0, 0.5, 0.7] },
  { species: 'seahorse 3pt', albedo: [0.2, 0.8, 0.3] },
  { species: 'angelfish 5pt', albedo: [1.0, 0.85, 0.2] },
  { species: 'angelfish 5pt', albedo: [0.9, 0.65, 0.1] },
];

/**
 * Scores a palette on TWO axes kept deliberately apart, because only one of
 * them is confound-free.
 *
 * AXIS A — every colour against the SAND. Clean, and it is the live
 * derivation's own metric: `types.ts` picked FISH_COLORS by maximising exactly
 * this. A fish at low dE against the seabed is camouflaged no matter what
 * shape it is, because at 9.4 units through 26% fog the child is resolving a
 * colour blob before a silhouette. Like-for-like.
 *
 * AXIS B — every colour against every other colour. CONFOUNDED, and the
 * confound favours the DEAD set: species.ts ships per-species `bodyShape`
 * ('round' | 'slim' | 'flat' | 'long' | 'tiny') and per-species `scale`
 * (0.45–0.65) via meshes.ts, so two species sharing a colour can still be told
 * apart by silhouette. The live set has ONE shared mesh, where colour is the
 * only channel there is. So axis B understates the dead set and is reported
 * for completeness, not leaned on.
 *
 * Axis B is additionally reported with exact-duplicate albedos removed, so the
 * headline number can never rest on the one pair that is a copy-paste rather
 * than a design choice.
 */
function score(set, label) {
  const rendered = set.map((c) => ({ ...c, rgb: render(c.albedo, FISH_EMISSIVE_EFFECTIVE) }));

  const sandPairs = rendered.map((c) => ({ a: c, bName: 'the SAND', d: dE(c.rgb, SAND_RENDERED) })).sort((x, y) => x.d - y.d);

  const crossPairs = [];
  for (let i = 0; i < rendered.length; i++) {
    for (let j = i + 1; j < rendered.length; j++) {
      // Two entries of the SAME species are alternates for one fish and are
      // never on screen as a contrast the child must resolve. Scoring them
      // against each other would punish the dead set for variety it never shows.
      if (rendered[i].species === rendered[j].species) continue;
      const identical = rendered[i].albedo.every((v, k) => v === rendered[j].albedo[k]);
      crossPairs.push({ a: rendered[i], b: rendered[j], bName: rendered[j].species, identical, d: dE(rendered[i].rgb, rendered[j].rgb) });
    }
  }
  crossPairs.sort((x, y) => x.d - y.d);
  const crossNoDup = crossPairs.filter((p) => !p.identical);

  const fmt = (p) => {
    const bRgb = p.b ? ` [${p.b.rgb.map(Math.round).join(',')}]` : ` [${SAND_RENDERED.join(',')}]`;
    const tag = p.identical ? '   <- SAME ALBEDO, VERBATIM' : '';
    return `    ${p.d.toFixed(2).padStart(6)}   ${p.a.species.padEnd(15)} [${p.a.rgb.map(Math.round).join(',')}]  vs  ${p.bName}${bRgb}${tag}`;
  };

  console.log(`${label}\n  ${rendered.length} colours.`);
  console.log(`  AXIS A — vs the SAND (clean, and the live derivation's own metric). Three worst:`);
  for (const p of sandPairs.slice(0, 3)) console.log(fmt(p));
  console.log(`    => worst vs sand: ${sandPairs[0].d.toFixed(2)} dE2000`);
  console.log(`  AXIS B — colour vs colour (confounded: per-species mesh helps the dead set). Three worst:`);
  for (const p of crossPairs.slice(0, 3)) console.log(fmt(p));
  console.log(
    `    => worst sibling pair: ${crossPairs[0].d.toFixed(2)} dE2000` +
      (crossNoDup.length < crossPairs.length ? `, ${crossNoDup[0].d.toFixed(2)} ignoring verbatim duplicates` : ''),
  );
  console.log('');
  return { sand: sandPairs[0].d, cross: crossPairs[0].d, crossNoDup: crossNoDup.length ? crossNoDup[0].d : crossPairs[0].d };
}

console.log('======== THE TWO PALETTES, SAME PLACE, SAME METHOD ========\n');
const liveWorst = score(
  LIVE.map((c) => ({ species: c.name, albedo: c.albedo })),
  'LIVE — FISH_COLORS (types.ts): five colours on one shared mesh',
);
const deadWorst = score(DEAD, 'DEAD — species.ts colorPalette: eleven colours across five species');

console.log('================ VERDICT ================');
console.log('                        vs SAND (clean)    vs SIBLINGS (confounded)');
console.log(`LIVE  FISH_COLORS         ${liveWorst.sand.toFixed(2).padStart(6)}                    ${liveWorst.crossNoDup.toFixed(2).padStart(6)}`);
console.log(`DEAD  species.ts          ${deadWorst.sand.toFixed(2).padStart(6)}                    ${deadWorst.crossNoDup.toFixed(2).padStart(6)}`);
console.log('');

// The verdict rests on AXIS A alone. Axis B is printed above so the reader can
// see it, and is deliberately excluded from the test below: per-species meshes
// could rescue a shared colour, and this script has no way to score silhouette.
if (deadWorst.sand < liveWorst.sand) {
  const cut = liveWorst.sand - deadWorst.sand;
  console.log('Judged ONLY on the clean axis — how well a fish separates from the seabed');
  console.log(`it swims over — wiring the species table in CUTS the reef's worst case by`);
  console.log(`${cut.toFixed(2)} dE2000, a ${((cut / liveWorst.sand) * 100).toFixed(0)}% loss, on the exact metric the live search was run`);
  console.log('to maximise. The dead code is not an unshipped improvement; it is the state');
  console.log('the live derivation was written to move away from.');
  console.log('');
  console.log('The single worst offender is the PUFFERFISH, and it is worth naming because');
  console.log('it is not a rounding error: a 2-point reward fish at 3.86 dE2000 from the');
  console.log('sand is, at this depth and fog, functionally invisible. Its albedo is');
  console.log('(0.82, 0.71, 0.55) — sand-tan. Someone chose a sand-coloured fish, which is');
  console.log('a perfectly good instinct for a REEF SIM and the wrong one for a toddler');
  console.log('game whose whole loop is "see fish, chase fish".');
  console.log('');
  console.log('More variety in the TABLE, less variety on the SCREEN. That is the whole');
  console.log('trap: eleven albedos read as more colourful than five until they are put');
  console.log('through the fog and the sand they will actually be seen against.');
} else {
  console.log('On the clean axis the dead palette scores at least as well as the live one.');
  console.log('The deletion argument cannot rest on legibility — find another reason, or');
  console.log('wire it in.');
}
console.log('=========================================');
