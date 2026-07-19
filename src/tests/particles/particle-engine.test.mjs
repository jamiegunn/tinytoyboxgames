/**
 * ParticleEngine contract + math test.
 *
 * Enforces architecture-standards.md#particleengine. Two concerns:
 *
 * 1. The area-correct cone sampling MATH — reimplemented here and validated
 *    statistically (a uniform-cosφ sample is area-uniform on the cone and never
 *    escapes [phiMin, phiMax]). This is the formula the engine uses; if the
 *    principle is wrong, sparkles would cluster at the pole.
 * 2. Preset invariants parsed from source (capacity ≥ max burst count, cones in
 *    [0, π], valid ranges, every preset in the PARTICLES registry), plus the
 *    structural guarantees of the engine itself (single clock subscription,
 *    disposal registration).
 *
 * Like the other contract suites, this parses source text rather than importing
 * the TS modules (three + canvas need a DOM), so it runs under plain `node --test`.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const particlesDir = path.join(packageRoot, 'src', 'utils', 'particles');
const engineSrc = readFileSync(path.join(particlesDir, 'engine.ts'), 'utf8');
const presetsSrc = readFileSync(path.join(particlesDir, 'presets.ts'), 'utf8');
const registrySrc = readFileSync(path.join(particlesDir, 'registry.ts'), 'utf8');

// ── 1. Cone sampling math ─────────────────────────────────────────────────────

/** Samples one cone direction exactly as engine.sampleDirection does (axis +Y). */
function sampleCone(phiMin, phiMax) {
  const theta = Math.random() * Math.PI * 2;
  const cosPhi = Math.cos(phiMax) + Math.random() * (Math.cos(phiMin) - Math.cos(phiMax));
  const sinPhi = Math.sqrt(Math.max(0, 1 - cosPhi * cosPhi));
  return { x: sinPhi * Math.cos(theta), y: cosPhi, z: sinPhi * Math.sin(theta) };
}

test('cone sampling never escapes [phiMin, phiMax]', () => {
  const phiMin = 0.2;
  const phiMax = 1.0;
  for (let i = 0; i < 20000; i++) {
    const d = sampleCone(phiMin, phiMax);
    const phi = Math.acos(Math.max(-1, Math.min(1, d.y)));
    assert.ok(phi >= phiMin - 1e-6 && phi <= phiMax + 1e-6, `phi ${phi} outside [${phiMin}, ${phiMax}]`);
    const len = Math.hypot(d.x, d.y, d.z);
    assert.ok(Math.abs(len - 1) < 1e-6, `direction not unit length: ${len}`);
  }
});

test('cone sampling is area-uniform (cosφ uniform), not clustered at the pole', () => {
  // A full-hemisphere cone [0, π/2]: an area-uniform sample has E[cosφ] = 0.5
  // (mean height of a uniform hemisphere). A naive uniform-φ sample would bias
  // toward the pole and give E[cosφ] ≈ 0.64. This catches that regression.
  let sum = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) sum += sampleCone(0, Math.PI / 2).y;
  const mean = sum / N;
  assert.ok(Math.abs(mean - 0.5) < 0.01, `E[cosφ] = ${mean}, expected ≈ 0.5 (area-uniform)`);
});

test('full-sphere cone [0, π] covers both hemispheres', () => {
  let up = 0;
  let down = 0;
  for (let i = 0; i < 20000; i++) {
    if (sampleCone(0, Math.PI).y >= 0) up++;
    else down++;
  }
  // Symmetric within a few percent.
  assert.ok(Math.abs(up - down) / (up + down) < 0.05, `sphere not symmetric: up=${up} down=${down}`);
});

// ── 2. Preset invariants (parsed from source) ─────────────────────────────────

/** Parses each `export const NAME: ParticlePreset = { ... };` block from presets.ts. */
function parsePresets() {
  const presets = [];
  const re = /export const (\w+): ParticlePreset = \{([\s\S]*?)\n\};/g;
  let m;
  while ((m = re.exec(presetsSrc)) !== null) {
    const [, name, body] = m;
    const num = (key) => {
      const mm = body.match(new RegExp(`\\b${key}:\\s*(-?[0-9.]+)`));
      return mm ? Number(mm[1]) : undefined;
    };
    const pair = (key) => {
      const mm = body.match(new RegExp(`\\b${key}:\\s*\\[\\s*(-?[0-9.]+)\\s*,\\s*([A-Za-z0-9_.*/ ]+?)\\s*\\]`));
      if (!mm) return undefined;
      const parse = (s) => (s.includes('Math.PI') ? Math.PI : Number(s));
      return [parse(mm[1]), parse(mm[2])];
    };
    presets.push({ name, body, count: num('count'), capacity: num('capacity'), cone: pair('cone'), lifetime: pair('lifetime'), speed: pair('speed') });
  }
  return presets;
}

test('every preset has valid ranges and capacity ≥ burst count', () => {
  const presets = parsePresets();
  assert.ok(presets.length >= 16, `expected ≥16 presets, found ${presets.length}`);
  for (const p of presets) {
    assert.ok(p.capacity !== undefined && p.capacity > 0, `${p.name}: capacity missing/invalid`);
    // count is a fixed number for bursts here (streams use count: 1).
    assert.ok(p.count !== undefined && p.capacity >= p.count, `${p.name}: capacity ${p.capacity} < count ${p.count}`);
    assert.ok(p.cone, `${p.name}: cone missing`);
    assert.ok(p.cone[0] >= 0 && p.cone[1] <= Math.PI + 1e-9 && p.cone[0] <= p.cone[1], `${p.name}: cone ${p.cone} outside [0, π]`);
    assert.ok(p.lifetime && p.lifetime[0] > 0 && p.lifetime[1] >= p.lifetime[0], `${p.name}: bad lifetime ${p.lifetime}`);
    assert.ok(p.speed && p.speed[0] >= 0 && p.speed[1] >= p.speed[0], `${p.name}: bad speed ${p.speed}`);
  }
});

test('every preset is exported in the PARTICLES registry', () => {
  const presets = parsePresets().map((p) => p.name);
  const registryBlock = presetsSrc.match(/export const PARTICLES = \{([\s\S]*?)\n\} as const;/);
  assert.ok(registryBlock, 'PARTICLES registry object not found');
  for (const name of presets) {
    assert.ok(registryBlock[1].includes(name), `${name} missing from PARTICLES registry`);
  }
});

// ── 3. Engine + registry structural guarantees ────────────────────────────────

test('engine subscribes to the FrameClock exactly once and registers teardown', () => {
  const subs = engineSrc.match(/clock\.subscribe\(/g) ?? [];
  assert.equal(subs.length, 1, 'engine must own exactly one clock subscription');
  assert.ok(/scope\.add\(unsubscribe\)/.test(engineSrc), 'engine must register its clock unsubscribe on the scope');
  assert.ok(/scope\.object3D\(points\)/.test(engineSrc), 'engine must register each batch Points on the scope');
  // No self-driven rAF loop — that is the whole point of the FrameClock.
  assert.ok(!/requestAnimationFrame\(/.test(engineSrc), 'engine must not start its own rAF loop');
});

test('registry binds engines weakly per scene and never throws on a miss', () => {
  assert.ok(/new WeakMap<Scene, ParticleEngine>/.test(registrySrc), 'registry must key weakly on Scene');
  assert.ok(/console\.warn/.test(registrySrc) && /NOOP_ENGINE/.test(registrySrc), 'a missing engine must degrade to a no-op, not throw');
});

test('stream emitter reads the follow target world position every tick (emitter-follow fix)', () => {
  assert.ok(/getWorldPosition/.test(engineSrc), 'stream must read follow world position (getWorldPosition)');
  assert.ok(/readFollow\(s\.follow, scratchPos\)/.test(engineSrc), 'stream must re-read follow position inside the tick');
});
