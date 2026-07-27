/**
 * Are `swayAmplitude`/`swayFrequency`/`chainPopRadius` levers worth wiring in?
 *
 * THE CLAIM UNDER TEST. `bubble-pop/balance.ts` exports three difficulty curves
 * that nothing imports, while the game runs on three fixed constants in
 * `types.ts`:
 *
 *   swayAmplitude(ed)          0.3 → 0.8      vs  SWAY_AMPLITUDE   = 0.6
 *   swayFrequency(ed)          0.8 → 1.6      vs  SWAY_FREQUENCY   = 1.2
 *   chainPopRadius(ed, n)      2.0 → 3.0      vs  CHAIN_POP_RADIUS = 2.5
 *                              (x1.3 when < 8 active)
 *
 * Each live constant sits at or near the midpoint of the curve that was meant
 * to replace it, which is what an unfinished swap looks like. `types.ts` even
 * carries a doctrine block saying balance questions are answered by balance.ts
 * — so a reader who obeys the doctrine reads a difficulty ramp that the game
 * does not have. That much is certain from reading.
 *
 * What reading does NOT settle is the direction of the repair. "Unused curve"
 * invites wiring it in; whether that is a fix or a regression depends on
 * whether the difference is something a child can see and act on. So it is
 * measured here in the only unit that matters for a finger: pixels of bubble
 * travel, against the size of the bubble and against the tap-forgiveness
 * radius the interaction controller already grants.
 *
 * WHY THE SWAY NUMBER IS NOT THE NUMBER IN THE DOCSTRING. `updateBubbleMotion`
 * applies sway as a VELOCITY, not a position offset:
 *
 *   position.x += sin(t * SWAY_FREQUENCY + phase) * SWAY_AMPLITUDE * 0.3 * dt
 *
 * so "amplitude 0.3–0.8" is a velocity coefficient in u/s, and the actual
 * excursion is its integral — which shrinks as frequency RISES. The curves
 * raise both together, and that partly cancels. This integrates the real
 * expression frame by frame and cross-checks against the closed form
 * (peak-to-peak = 2 * 0.3 * A / omega) so the reported number is not an
 * algebra mistake of mine.
 *
 * Run from inside the package: `node .probe/gameplay/r8-bubble-sway-lever.mjs`
 */

const SWAY_COEFF = 0.3; // the literal `* 0.3` in updateBubbleMotion
const VISIBLE_BAND_HEIGHT = 7.08; // types.ts — world units spanning the 60deg fov
const SIZE_VARIANTS = [0.2, 0.32, 0.45]; // types.ts — rendered bubble radii
const PROXIMITY_PX = 70; // gestureRules.ts — tap-forgiveness radius
const WOBBLE_TAP_TOLERANCE_PX = 28; // gestureRules.ts — smear-tap slop

// Live values (types.ts) and the curve endpoints (balance.ts).
const LIVE = { A: 0.6, F: 1.2, label: 'live constants' };
const EASY = { A: 0.3, F: 0.8, label: 'balance.ts ed=0' };
const HARD = { A: 0.8, F: 1.6, label: 'balance.ts ed=1' };

/** Integrates the real sway line for 30 s at 60 fps and returns peak-to-peak x. */
function excursionIntegrated(A, F) {
  const dt = 1 / 60;
  let x = 0;
  let min = 0;
  let max = 0;
  const phase = 0;
  for (let t = 0; t < 30; t += dt) {
    x += Math.sin(t * F + phase) * A * SWAY_COEFF * dt;
    if (x < min) min = x;
    if (x > max) max = x;
  }
  return max - min;
}

/** Closed form: integral of a sinusoidal velocity, peak-to-peak. */
const excursionClosedForm = (A, F) => (2 * SWAY_COEFF * A) / F;

// Shipping viewports this project measures at (frame height in CSS px).
const VIEWPORTS = [
  { name: 'phone portrait', h: 810 },
  { name: 'tablet landscape', h: 820 },
];

console.log('SWAY — how far the bubble actually moves sideways\n');
console.log('config              A     F     peak-to-peak (world u)   integrated vs closed form');
console.log('------------------  ----  ----  ----------------------   -------------------------');
for (const c of [EASY, LIVE, HARD]) {
  const i = excursionIntegrated(c.A, c.F);
  const cf = excursionClosedForm(c.A, c.F);
  const agree = Math.abs(i - cf) < 0.005 ? 'agree' : `DISAGREE (${(i - cf).toFixed(4)})`;
  console.log(
    `${c.label.padEnd(18)}  ${c.A.toFixed(1).padEnd(4)}  ${c.F.toFixed(1).padEnd(4)}  ${i.toFixed(4).padStart(22)}   ${i.toFixed(4)} / ${cf.toFixed(4)} ${agree}`,
  );
}

console.log('\nIn pixels, against what a finger is aiming at:\n');
for (const vp of VIEWPORTS) {
  const pxPerUnit = vp.h / VISIBLE_BAND_HEIGHT;
  const easy = excursionIntegrated(EASY.A, EASY.F) * pxPerUnit;
  const live = excursionIntegrated(LIVE.A, LIVE.F) * pxPerUnit;
  const hard = excursionIntegrated(HARD.A, HARD.F) * pxPerUnit;
  const spread = Math.max(easy, live, hard) - Math.min(easy, live, hard);
  const smallDia = 2 * SIZE_VARIANTS[0] * pxPerUnit;
  const bigDia = 2 * SIZE_VARIANTS[2] * pxPerUnit;

  console.log(`  ${vp.name} (${vp.h} px tall, ${pxPerUnit.toFixed(1)} px/unit)`);
  console.log(`    sway travel:  easy ${easy.toFixed(1)} px   live ${live.toFixed(1)} px   hard ${hard.toFixed(1)} px`);
  console.log(`    full spread across the whole difficulty ramp: ${spread.toFixed(1)} px`);
  console.log(
    `    bubble diameter: ${smallDia.toFixed(0)}-${bigDia.toFixed(0)} px    tap forgiveness: ${PROXIMITY_PX} px, smear slop ${WOBBLE_TAP_TOLERANCE_PX} px`,
  );
  console.log(`    spread as a fraction of the SMALLEST bubble: ${((spread / smallDia) * 100).toFixed(1)}%`);
  console.log(`    spread as a fraction of tap forgiveness:     ${((spread / PROXIMITY_PX) * 100).toFixed(1)}%\n`);
}

console.log('CHAIN POP — the other curve, which is not imperceptible\n');
const pxPerUnit = 810 / VISIBLE_BAND_HEIGHT;
const chain = (ed, n) => (2.0 + (3.0 - 2.0) * ed) * (n < 8 ? 1.3 : 1.0);
console.log('  radius in world units (and px at phone portrait), 13 active on easy / 21 on hard:');
console.log(`    live constant          2.50 u  (${(2.5 * pxPerUnit).toFixed(0)} px)`);
console.log(`    balance.ts ed=0, n=13  ${chain(0, 13).toFixed(2)} u  (${(chain(0, 13) * pxPerUnit).toFixed(0)} px)   <- the YOUNGEST player`);
console.log(`    balance.ts ed=1, n=21  ${chain(1, 21).toFixed(2)} u  (${(chain(1, 21) * pxPerUnit).toFixed(0)} px)`);
console.log(`    balance.ts sparse field n<8  x1.3 -> ${chain(0, 5).toFixed(2)} u at ed=0`);
console.log(`\n  Wiring the curve in as written moves the easy player from 2.50 to ${chain(0, 13).toFixed(2)} world units,`);
console.log(
  `  a ${(((2.5 - chain(0, 13)) / 2.5) * 100).toFixed(0)}% CUT in chain reach (${((2.5 - chain(0, 13)) * pxPerUnit).toFixed(0)} px) for the least able player.`,
);

console.log('\n================ VERDICT ================');
const spreadPx = (excursionIntegrated(HARD.A, HARD.F) - excursionIntegrated(EASY.A, EASY.F)) * pxPerUnit;
const smallDia = 2 * SIZE_VARIANTS[0] * pxPerUnit;
if (spreadPx < smallDia * 0.25 && spreadPx < WOBBLE_TAP_TOLERANCE_PX) {
  console.log(`SWAY CURVES ARE NOT A LEVER: the entire easy->hard ramp is ${spreadPx.toFixed(1)} px of travel,`);
  console.log(`  under a quarter of the smallest bubble (${smallDia.toFixed(0)} px) and inside the ${WOBBLE_TAP_TOLERANCE_PX} px smear slop`);
  console.log('  a tap already forgives. Wiring them in would change nothing a child can see or act on.');
} else {
  console.log(`SWAY CURVES ARE A REAL LEVER: ${spreadPx.toFixed(1)} px spread — wiring them in is a gameplay change.`);
}
console.log('');
console.log('CHAIN POP CURVE IS A LEVER, AND IT POINTS THE WRONG WAY: it is perceptible');
console.log(`  (${((2.5 - chain(0, 13)) * pxPerUnit).toFixed(0)} px) and it spends that perceptibility taking reach AWAY from the`);
console.log("  youngest player, against this codebase's standing generosity rule.");
console.log('=========================================');
