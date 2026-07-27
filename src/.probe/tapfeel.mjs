// tapfeel -- measures how many DISTINGUISHABLE things can happen when a child
// touches the screen.
//
// WHY THIS AND NOT A JUDGEMENT. "Boring and monotonous" is, for a tap toy,
// mostly a statement about the feedback vocabulary: the child pokes ten
// different things and the game answers with the same noise and the same puff
// of bubbles. Kirkorian, Choi & Pempek (2016) is the reason this matters rather
// than being a matter of taste -- a 2-to-3-year-old learns from a screen only
// when the response is CONTINGENT AND SPECIFIC to what they did. A response
// that is identical across actions carries no information about the action, so
// it teaches no affordance, and an affordance the child never learns is a thing
// they stop trying.
//
// So the measurable claim is: how large is the game's feedback alphabet, in
// symbols the child can actually tell apart?
//
// HOW. Not by reading the source and typing up a table -- that is just my
// reading with extra steps, and this project has a long record of my readings
// being wrong. Instead the REAL handlers are called against a REAL Scene with a
// REAL registered particle engine whose `emit` is recorded, and a recording
// audio stub. What comes out is what the game actually does.
//
// The one trap here is module identity: `getParticleEngine` looks the scene up
// in a WeakMap that lives in the registry module. Bundling interactions.ts on
// its own gives it a PRIVATE copy of that module, so the engine registered by
// the probe is invisible to it and every emit falls through to the silent
// no-op engine. That failure mode looks exactly like a genuine finding ("no
// feedback at all!"), which is why .probe/tapentry.ts exists: bundling one
// entry that re-exports both forces a single instance. `emits > 0` on the
// control arm is the assertion that this actually worked.
//
// THE METRIC. Pairwise confusability, then connected components, then
// perplexity.
//
//   audio distance   0 if the two outcomes play the same sound id (or both play
//                    none), else 1. Binary on purpose: these are categorically
//                    different synth patches, not points on a continuum, and
//                    pretending otherwise would invent precision.
//   visual distance  if the emitted particle PRESET differs the two bursts have
//                    different shape, speed, gravity and lifetime, so they are
//                    distinguishable. If the preset is the same, the only thing
//                    left is colour and count, and colour is compared as
//                    CIE Lab dE*ab.
//
// Two outcomes are CONFUSABLE iff same sound AND same preset AND dE < DE_THRESH.
// DE_THRESH defaults to 20, which is deliberately strict against my own fix:
// a large dE is required before I am allowed to call a colour change a real
// difference. It has to be strict, because these are semi-transparent additive
// particles moving fast over a blue-green background, and -- the part that
// matters most -- the two feedbacks are never seen side by side. They are
// separated in time by seconds or minutes, and successive colour discrimination
// from memory is far coarser than the simultaneous kind the dE=2.3 JND figure
// comes from. The headline is reported across dE 5/10/20/30 so the conclusion
// does not rest on this number.
//
// Confusable pairs form a graph; its CONNECTED COMPONENTS are the alphabet.
// Components rather than cliques is the conservative reading: if the child
// cannot separate A from B and cannot separate B from C, the vocabulary they
// have is smaller than three regardless of whether A and C differ.
//
// The headline is perplexity, exp(H), over the components under a weighting of
// how often each outcome occurs. That is the "effective number of distinct
// feedbacks". It is chosen over a raw component count because it resists the
// obvious way to game this: giving a brand new sound to an outcome nobody ever
// triggers adds a component but barely moves perplexity.

import { Scene, Mesh, BoxGeometry, MeshBasicMaterial, Vector3, Color, Group } from 'three';
import { bundleTs } from '../tests/framework/_tsload.mjs';

const MODULE = process.env.MODULE || '.probe/tapentry.ts';
const DE_THRESH = Number(process.env.DE || 20);
const m = await bundleTs(MODULE);

// ---- harness -------------------------------------------------------------

const scene = new Scene();
const clock = { elapsed: 0, delta: 1 / 60, frame: 0, subscribe: () => () => {} };
const disposers = [];
const scope = { add: (fn) => disposers.push(fn), dispose: () => disposers.splice(0) };
const engine = m.setSceneParticleEngine(scene, clock, scope);

let emits = [];
let sounds = [];
engine.emit = (preset, position, overrides) => {
  emits.push({ preset, position: position.clone(), overrides: overrides ?? {} });
};
const audio = { playSound: (id) => sounds.push(id) };

// A preset object has no name, so identity is by reference against PARTICLES.
const presetName = new Map();
for (const [k, v] of Object.entries(m.PARTICLES)) presetName.set(v, k);

// Builds a named mesh, parented into the scene, so `worldPositionOf` and
// `propRootOf` walk a real hierarchy rather than a bare object.
function prop(name, x, z, colour) {
  const root = new Group();
  root.position.set(x, 0, z);
  const mesh = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: colour ?? 0xffffff }));
  mesh.name = name;
  root.add(mesh);
  scene.add(root);
  return mesh;
}

const state = m.createInteractionState();
const sharkAnim = m.createSharkAnimState();
const sharkRoot = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial());
sharkRoot.name = 'shark_root';
scene.add(sharkRoot);

// Each entry fires ONE real tap outcome and returns nothing; the recorders are
// read afterwards. `weight` is how often that outcome plausibly occurs in a
// session -- see the WEIGHTS note below.
const OUTCOMES = [
  { key: 'coral', run: () => state.handleCoralTap(prop('coral_a', 30, 10), scene, audio) },
  { key: 'anemone', run: () => state.handleAnemoneTap(prop('anemone_tent_a', -12, 4, 0xf2809f), scene, audio) },
  { key: 'seaweed', run: () => state.handleSeaweedTap(prop('seaweed_a', 8, -20), audio) },
  { key: 'treasure', run: () => state.handleTreasureChestTap(prop('treasure_lid', 2, 6), scene, audio) },
  { key: 'rock', run: () => m.handleRockTap(prop('rock_a', -4, 14), scene, audio) },
  { key: 'water', run: () => m.handleWaterTap(scene, new Vector3(1, 0, 2), audio) },
  { key: 'miss', run: () => m.handleMissedTap(scene, new Vector3(3, 0, 5), audio) },
  { key: 'shark', run: () => m.handleSharkTap(sharkAnim, scene, sharkRoot, audio) },
];

const sig = [];
for (const o of OUTCOMES) {
  emits = [];
  sounds = [];
  // The barrel roll is on a cooldown, so the shark arm needs its state fresh
  // or it returns false and emits nothing -- which would read as "the shark
  // gives no feedback", a false finding produced by the probe itself.
  if (o.key === 'shark') Object.assign(sharkAnim, m.createSharkAnimState());
  o.run();
  const e = emits[0];
  sig.push({
    key: o.key,
    sound: sounds[0] ?? null,
    nSounds: sounds.length,
    preset: e ? (presetName.get(e.preset) ?? 'unnamed') : null,
    count: e ? (e.overrides.count ?? e.preset.count) : 0,
    colors: (e ? (e.overrides.colors ?? e.preset.colors) : []).map((c) => [c.r, c.g, c.b]),
    emitted: emits.length,
  });
}

// ---- colour distance -----------------------------------------------------

// sRGB -> CIE Lab (D65). Written out rather than pulled from a package because
// the package would have to be added to the game's dependencies to be committed.
function labOf([r, g, b]) {
  const lin = (u) => (u <= 0.04045 ? u / 12.92 : ((u + 0.055) / 1.055) ** 2.4);
  const [R, G, B] = [lin(r), lin(g), lin(b)];
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const Y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  const [fx, fy, fz] = [f(X), f(Y), f(Z)];
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}

// Distance between two particle bursts' palettes: the mean over each burst's
// colours of the distance to the NEAREST colour in the other burst, symmetrised.
// A burst is seen as a cloud, not as an ordered list, so nearest-neighbour is
// the right pairing; taking the max would let one stray accent colour claim the
// whole burst looks different.
function paletteDE(a, b) {
  if (!a.length || !b.length) return Infinity;
  const A = a.map(labOf);
  const B = b.map(labOf);
  const dir = (P, Q) => P.reduce((s, p) => s + Math.min(...Q.map((q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]))), 0) / P.length;
  return (dir(A, B) + dir(B, A)) / 2;
}

// ---- confusability, components, perplexity -------------------------------

function analyse(sigs, de) {
  const n = sigs.length;
  const pairs = [];
  const adj = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const sameSound = sigs[i].sound === sigs[j].sound;
      const samePreset = sigs[i].preset === sigs[j].preset;
      const dE = samePreset ? paletteDE(sigs[i].colors, sigs[j].colors) : Infinity;
      const confusable = sameSound && samePreset && dE < de;
      pairs.push({ a: sigs[i].key, b: sigs[j].key, sameSound, samePreset, dE: Number.isFinite(dE) ? +dE.toFixed(1) : null, confusable });
      if (confusable) {
        adj[i].push(j);
        adj[j].push(i);
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
  // WEIGHTS. Uniform over outcomes. This is not what a child's taps look like,
  // and it is used anyway because the alternative -- inventing a plausible
  // distribution -- would let me choose the answer. Uniform is the only
  // weighting I did not pick to favour a result. `perplexityUniform` is
  // therefore an alphabet size, not a session statistic, and is only ever
  // compared before-to-after under the identical weighting.
  const mass = new Map();
  for (let i = 0; i < n; i += 1) mass.set(comp[i], (mass.get(comp[i]) ?? 0) + 1 / n);
  let H = 0;
  for (const p of mass.values()) H -= p * Math.log(p);
  const groups = {};
  for (let i = 0; i < n; i += 1) (groups[comp[i]] ??= []).push(sigs[i].key);
  return {
    de,
    components: c,
    perplexity: +Math.exp(H).toFixed(3),
    confusablePairs: pairs.filter((p) => p.confusable).map((p) => `${p.a}~${p.b}`),
    groups: Object.values(groups),
    pairs,
  };
}

const main = analyse(sig, DE_THRESH);
const sweep = [5, 10, 20, 30].map((d) => {
  const r = analyse(sig, d);
  return { de: d, components: r.components, perplexity: r.perplexity, confusable: r.confusablePairs };
});

console.log(
  JSON.stringify(
    {
      tag: process.env.TAG || 'arm',
      module: MODULE,
      // Assertion that the bundle-identity trap above did not fire.
      engineWired: sig.some((s) => s.emitted > 0),
      outcomes: sig.length,
      signatures: sig,
      soundsUsed: [...new Set(sig.map((s) => s.sound).filter(Boolean))],
      distinctSounds: new Set(sig.map((s) => s.sound)).size,
      silentOutcomes: sig.filter((s) => s.emitted === 0).map((s) => s.key),
      main: { de: main.de, components: main.components, perplexity: main.perplexity, confusablePairs: main.confusablePairs, groups: main.groups },
      sweep,
    },
    null,
    1,
  ),
);
