// Audit the shared portrait pull-back rule across the whole aspect domain.
//
//   distanceMultiplierForAspect = (a) => a < 1 ? (1.0 / a) * 0.75 : 1
//
// The comment says "portrait viewports are narrower than the authored framing
// assumes, so the camera is pulled back". A pull-back rule must be >= 1
// everywhere and must not jump. This one is neither.
const mult = (a) => (a < 1 ? (1.0 / a) * 0.75 : 1);
console.log('aspect   multiplier   radius@distance=10   verdict');
const rows = [0.4, 0.45, 0.4505, 0.5, 0.6, 0.7, 0.7499, 0.75, 0.7501, 0.8, 0.9, 0.95, 0.99, 0.999, 1.0, 1.333, 1.778];
for (const a of rows) {
  const m = mult(a);
  const v = m > 1.0001 ? 'pulls back' : m < 0.9999 ? 'PUSHES IN — closer than the authored distance' : 'no change';
  console.log(`${a.toFixed(4)}   ${m.toFixed(4)}       ${(10 * m).toFixed(2)}              ${v}`);
}
const below = 10 * mult(0.999);
const at = 10 * mult(1.0);
console.log(
  `\ndiscontinuity at a = 1: radius ${below.toFixed(2)} at a=0.999 vs ${at.toFixed(2)} at a=1.000 — a ${((100 * (at - below)) / below).toFixed(1)}% jump for a 0.1% aspect change`,
);
console.log(`the rule is a no-op at exactly a = 0.75 (an iPad in portrait): ${mult(0.75).toFixed(6)}`);
let lo = 0.4;
for (let a = 0.4; a < 1; a += 0.0001) {
  if (mult(a) < 1) {
    lo = a;
    break;
  }
}
console.log(`the rule PUSHES THE CAMERA IN for every aspect in (${lo.toFixed(4)}, 1.0) — that is every portrait viewport narrower than 4:3 but wider than 3:4`);
