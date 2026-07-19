/**
 * CameraDescriptor contract test — behavioural, ruthless.
 *
 * Enforces architecture-standards.md#cameradescriptor: ONE camera convention.
 * Because the module imports only `three`, this loads the REAL implementation
 * (via esbuild) and checks it against three.js itself and against the two legacy
 * formulas it replaces. If any of these drift, framing silently breaks — so this
 * suite pins them hard:
 *
 *   1. sphericalPosition === three.js `setFromSphericalCoords` (+ target), for a
 *      dense grid of angles. This is THE convention.
 *   2. Axis meaning: θ=0 → +Z, θ=π → −Z, θ=π/2 → +X; distance is exact.
 *   3. createCamera places + aims fixed and orbit cameras; fov is in degrees;
 *      near/far are the shared 0.1/100.
 *   4. Legacy equivalences (the migration MUST reproduce these exact poses):
 *      - the old game camera (Babylon α=0 with hand-negated Z) === azimuth π;
 *      - the old scene camera's `Spherical(r, φ, azimuth+π)` === folding +π into
 *        the stored azimuth.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Spherical, PerspectiveCamera } from 'three';
import { loadTs } from './_tsload.mjs';

const cam = await loadTs('src/utils/camera/cameraDescriptor.ts');

const V = (x, y, z) => new Vector3(x, y, z);
const close = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
const vclose = (a, b, eps = 1e-9) => close(a.x, b.x, eps) && close(a.y, b.y, eps) && close(a.z, b.z, eps);

// ── 1. THE convention: identical to three.js Spherical ────────────────────────

test('sphericalPosition matches three.js setFromSphericalCoords for a dense angle grid', () => {
  const target = V(1, 2, -3);
  for (let ti = 0; ti < 16; ti++) {
    for (let pi = 1; pi < 8; pi++) {
      const theta = (ti / 16) * 2 * Math.PI;
      const phi = (pi / 8) * Math.PI;
      const r = 7.4;
      const mine = cam.sphericalPosition(target, theta, phi, r);
      const three = new Vector3().setFromSphericalCoords(r, phi, theta).add(target);
      assert.ok(vclose(mine, three), `θ=${theta} φ=${phi}: ${JSON.stringify(mine)} vs ${JSON.stringify(three)}`);
    }
  }
});

test('azimuth axis meaning: θ=0 → +Z, θ=π → −Z, θ=π/2 → +X (from an equatorial polar)', () => {
  const t = V(0, 0, 0);
  const r = 5;
  const phi = Math.PI / 2; // equator: pure horizontal ring
  assert.ok(vclose(cam.sphericalPosition(t, 0, phi, r), V(0, 0, r)), 'θ=0 must be +Z');
  assert.ok(vclose(cam.sphericalPosition(t, Math.PI, phi, r), V(0, 0, -r)), 'θ=π must be −Z');
  assert.ok(vclose(cam.sphericalPosition(t, Math.PI / 2, phi, r), V(r, 0, 0)), 'θ=π/2 must be +X');
});

test('distance from target is exactly `distance`', () => {
  const t = V(2, -1, 4);
  for (const [theta, phi] of [
    [0.3, 1.1],
    [Math.PI, 0.6],
    [2.0, 1.4],
  ]) {
    const p = cam.sphericalPosition(t, theta, phi, 9);
    assert.ok(close(p.distanceTo(t), 9, 1e-9), `distance drifted: ${p.distanceTo(t)}`);
  }
});

// ── 2. createCamera places, aims, and stores fov in degrees ───────────────────

test('createCamera(fixed) sits at position, aims at target, fov in degrees, shared near/far', () => {
  const c = cam.createCamera({ kind: 'fixed', position: V(0, 2, 5), target: V(0, 0, 0), fov: 60 }, 16 / 9);
  assert.ok(vclose(c.position, V(0, 2, 5)), 'fixed camera must sit at its position');
  assert.equal(c.fov, 60, 'fov must be stored in degrees, verbatim');
  assert.equal(c.near, 0.1);
  assert.equal(c.far, 100);
  // Aimed at the target: forward (−Z of the camera) points from camera to target.
  const fwd = new Vector3(0, 0, -1).applyQuaternion(c.quaternion).normalize();
  const toTarget = V(0, 0, 0).sub(c.position).normalize();
  assert.ok(vclose(fwd, toTarget, 1e-6), 'fixed camera must look at the target');
});

test('createCamera(orbit) matches sphericalPosition and aims at target', () => {
  const d = { kind: 'orbit', target: V(0, 0.65, 0), azimuth: Math.PI, polar: 1.16, distance: 7.4, fov: 51.6 };
  const c = cam.createCamera(d, 1.5);
  assert.ok(vclose(c.position, cam.sphericalPosition(d.target, d.azimuth, d.polar, d.distance), 1e-9), 'orbit camera position must equal sphericalPosition');
  const fwd = new Vector3(0, 0, -1).applyQuaternion(c.quaternion).normalize();
  const toTarget = d.target.clone().sub(c.position).normalize();
  assert.ok(vclose(fwd, toTarget, 1e-6), 'orbit camera must look at the target');
});

test('fovRadiansToDegrees converts correctly', () => {
  assert.ok(close(cam.fovRadiansToDegrees(Math.PI), 180));
  assert.ok(close(cam.fovRadiansToDegrees(0.9), (0.9 * 180) / Math.PI, 1e-9));
});

// ── 3. Legacy equivalences the migration must reproduce EXACTLY ───────────────

test('the old game camera (Babylon α=0, hand-negated Z) equals azimuth π', () => {
  // Old createGameCamera: alpha=0; x=r·sinβ·sin0=0; y=r·cosβ; z=−(r·sinβ·cos0)=−r·sinβ.
  const gameCam = (target, beta, radius) =>
    V(target.x + radius * Math.sin(beta) * 0, target.y + radius * Math.cos(beta), target.z - radius * Math.sin(beta) * Math.cos(0));
  for (const [target, beta, radius] of [
    [V(0, 0.5, 0), 0.95, 8.4],
    [V(0, 1.5, 0), 1.3, 9.0],
    [V(0, 0, 0), 1.4, 10],
  ]) {
    const legacy = gameCam(target, beta, radius);
    const viaDescriptor = cam.sphericalPosition(target, Math.PI, beta, radius);
    assert.ok(vclose(legacy, viaDescriptor, 1e-9), `game camera drift: β=${beta} r=${radius}`);
  }
});

test('the old scene camera Spherical(r, φ, azimuth+π) equals folding +π into stored azimuth', () => {
  const target = V(0, 1, 0);
  for (const [azimuth, polar, r] of [
    [0, 1.1, 9],
    [0.3, 1.25, 7],
    [-0.2, 1.0, 11],
  ]) {
    // Legacy: three.Spherical with theta = azimuth + π.
    const legacy = new Vector3().setFromSpherical(new Spherical(r, polar, azimuth + Math.PI)).add(target);
    // New: the preset stores (azimuth + π) directly; no offset at use.
    const folded = cam.sphericalPosition(target, azimuth + Math.PI, polar, r);
    assert.ok(vclose(legacy, folded, 1e-9), `scene camera fold drift: az=${azimuth}`);
  }
});

test('DEFAULT_GAME_CAMERA is the fixed shell view at (0,2,5) fov 60', () => {
  assert.equal(cam.DEFAULT_GAME_CAMERA.kind, 'fixed');
  assert.ok(vclose(cam.DEFAULT_GAME_CAMERA.position, V(0, 2, 5)));
  assert.equal(cam.DEFAULT_GAME_CAMERA.fov, 60);
});
