/**
 * Visual effects for Cannonball Splash.
 *
 * Splash, fragments, muzzle flash, sparkle, rainbow ring, golden sparkle.
 */

import { BoxGeometry, CircleGeometry, Color, CylinderGeometry, Mesh, MeshStandardMaterial, Scene, SphereGeometry, TorusGeometry, Vector3 } from 'three';
import { C, type BonusCoin, type Fragment, type SplashParticle, type TargetKind } from '../types';
import { randomRange } from '../helpers';
import { getTargetColor } from './targets';

// ── Shared materials ────────────────────────────────────────────────────────

function makeMat(
  name: string,
  color: [number, number, number],
  opts: { emissive?: [number, number, number]; transparent?: boolean; opacity?: number } = {},
): MeshStandardMaterial {
  const m = new MeshStandardMaterial({
    color: new Color(...color),
    roughness: 0.5,
  });
  if (opts.emissive) m.emissive = new Color(...opts.emissive);
  if (opts.transparent) {
    m.transparent = true;
    m.opacity = opts.opacity ?? 1;
  }
  m.name = name;
  return m;
}

const splashMat = makeMat('splash_water', [0.7, 0.85, 1.0], { transparent: true, opacity: 0.5 });
const splashRingMat = makeMat('splash_ring', [1, 1, 1], { transparent: true, opacity: 0.6 });
const muzzleMat = makeMat('muzzle_flash', [1.0, 0.7, 0.2], { emissive: [1.0, 0.7, 0.2], transparent: true, opacity: 0.7 });
const sparkleMat = makeMat('sparkle', [1, 1, 1], { emissive: [1, 1, 1] });
const coinMat = new MeshStandardMaterial({
  color: new Color(0.95, 0.8, 0.2),
  metalness: 0.9,
  roughness: 0.15,
});
coinMat.name = 'coin_gold';
const goldenSparkMat = makeMat('golden_spark', [1.0, 0.85, 0.3], { emissive: [1.0, 0.85, 0.3] });

// ── Target Explosion ────────────────────────────────────────────────────────

export function spawnTargetExplosion(scene: Scene, position: Vector3, kind: TargetKind, fragments: Fragment[], splashParticles: SplashParticle[]): void {
  const color = getTargetColor(kind);
  const isGlass = kind === 'bottle' || kind === 'rainbow-bottle';

  // Fragments
  for (let i = 0; i < C.EXPLOSION_FRAGMENT_COUNT; i++) {
    const size = randomRange(0.04, 0.1);
    const geom = isGlass ? new SphereGeometry(size, 4, 3) : new BoxGeometry(size, size, size);
    const fragMat = new MeshStandardMaterial({
      color: color.clone(),
      metalness: isGlass ? 0.1 : 0,
      roughness: isGlass ? 0.15 : 0.7,
      transparent: isGlass,
      opacity: isGlass ? 0.5 : 1,
    });
    fragMat.name = `fragment_${i}`;
    const mesh = new Mesh(geom, fragMat);
    mesh.name = `cs_frag_${i}`;
    mesh.position.copy(position);
    mesh.castShadow = true;
    scene.add(mesh);

    fragments.push({
      mesh,
      vx: randomRange(-3, 3),
      vy: randomRange(2, 5),
      vz: randomRange(-3, 3),
      rotSpeedX: randomRange(-5, 5),
      rotSpeedY: randomRange(-5, 5),
      rotSpeedZ: randomRange(-5, 5),
      lifetime: randomRange(0.5, 0.8),
      elapsed: 0,
    });
  }

  // Splash ring
  spawnSplashRing(scene, position, 1.5, 0.4, splashParticles);

  // Water splash particles
  spawnWaterSplash(scene, position, splashParticles);
}

// ── Water Splash ────────────────────────────────────────────────────────────

export function spawnWaterSplash(scene: Scene, position: Vector3, splashParticles: SplashParticle[]): void {
  for (let i = 0; i < C.SPLASH_PARTICLE_COUNT; i++) {
    const mesh = new Mesh(new SphereGeometry(randomRange(0.05, 0.12), 4, 3), splashMat);
    mesh.name = `cs_splash_${i}`;
    mesh.position.copy(position);
    mesh.position.y = 0.05;
    scene.add(mesh);

    splashParticles.push({
      mesh,
      vx: randomRange(-0.8, 0.8),
      vy: randomRange(2, 4),
      vz: randomRange(-0.8, 0.8),
      lifetime: randomRange(0.4, 0.7),
      elapsed: 0,
    });
  }

  // Ripple disc
  const rippleMat = new MeshStandardMaterial({
    color: new Color(1, 1, 1),
    transparent: true,
    opacity: 0.3,
    roughness: 0.5,
  });
  rippleMat.name = 'ripple';
  const ripple = new Mesh(new CircleGeometry(0.1, 16), rippleMat);
  ripple.name = 'cs_ripple';
  ripple.rotation.x = -Math.PI / 2;
  ripple.position.set(position.x, 0.02, position.z);
  scene.add(ripple);

  // Ripple treated as a splash particle with special expansion behavior
  splashParticles.push({
    mesh: ripple,
    vx: 0,
    vy: 0,
    vz: 0,
    lifetime: 0.6,
    elapsed: 0,
  });
}

function spawnSplashRing(scene: Scene, position: Vector3, maxRadius: number, duration: number, splashParticles: SplashParticle[]): void {
  const ringMat = splashRingMat.clone();
  const ring = new Mesh(new TorusGeometry(0.1, 0.03, 6, 16), ringMat);
  ring.name = 'cs_splashRing';
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(position.x, 0.05, position.z);
  scene.add(ring);

  // Store maxRadius in userData for update logic
  ring.userData.maxRadius = maxRadius;
  ring.userData.isRing = true;

  splashParticles.push({
    mesh: ring,
    vx: 0,
    vy: 0,
    vz: 0,
    lifetime: duration,
    elapsed: 0,
  });
}

// ── Muzzle Flash ────────────────────────────────────────────────────────────

export function spawnMuzzleFlash(scene: Scene, position: Vector3, direction: Vector3, splashParticles: SplashParticle[]): void {
  for (let i = 0; i < C.MUZZLE_FLASH_COUNT; i++) {
    const mesh = new Mesh(new SphereGeometry(0.08, 4, 3), muzzleMat.clone());
    mesh.name = `cs_muzzle_${i}`;
    mesh.position.copy(position);
    scene.add(mesh);

    const speed = randomRange(2, 4);
    const spread = 0.5;
    splashParticles.push({
      mesh,
      vx: direction.x * speed + randomRange(-spread, spread),
      vy: direction.y * speed + randomRange(0.5, 2),
      vz: direction.z * speed + randomRange(-spread, spread),
      lifetime: randomRange(0.1, 0.2),
      elapsed: 0,
    });
  }
}

// ── Golden Sparkle ──────────────────────────────────────────────────────────

export function spawnGoldenSparkle(scene: Scene, position: Vector3, splashParticles: SplashParticle[]): void {
  for (let i = 0; i < C.GOLDEN_SPARKLE_COUNT; i++) {
    const mesh = new Mesh(new SphereGeometry(0.04, 4, 3), goldenSparkMat.clone());
    mesh.name = `cs_goldSpark_${i}`;
    mesh.position.copy(position);
    scene.add(mesh);

    splashParticles.push({
      mesh,
      vx: randomRange(-1, 1),
      vy: randomRange(0.5, 1.5),
      vz: randomRange(-1, 1),
      lifetime: randomRange(0.6, 1.0),
      elapsed: 0,
    });
  }
}

// ── Rainbow Ring ────────────────────────────────────────────────────────────

export function spawnRainbowRing(scene: Scene, position: Vector3, splashParticles: SplashParticle[]): void {
  const rainbowMat = new MeshStandardMaterial({
    color: new Color().setHSL(0, 0.8, 0.55),
    transparent: true,
    opacity: 0.4,
    roughness: 0.3,
  });
  rainbowMat.name = 'rainbow_ring';
  const ring = new Mesh(new TorusGeometry(0.1, 0.05, 8, 24), rainbowMat);
  ring.name = 'cs_rainbowRing';
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(position.x, 0.05, position.z);
  ring.userData.maxRadius = C.CHAIN_RADIUS;
  ring.userData.isRing = true;
  ring.userData.isRainbow = true;
  scene.add(ring);

  splashParticles.push({
    mesh: ring,
    vx: 0,
    vy: 0,
    vz: 0,
    lifetime: 0.5,
    elapsed: 0,
  });
}

// ── Trail Particle ──────────────────────────────────────────────────────────

export function spawnTrailParticle(scene: Scene, position: Vector3, splashParticles: SplashParticle[]): void {
  const trailMatInst = new MeshStandardMaterial({
    color: new Color(0.4, 0.4, 0.4),
    transparent: true,
    opacity: 0.3,
    roughness: 0.8,
  });
  trailMatInst.name = 'trail_smoke';
  const mesh = new Mesh(new SphereGeometry(0.05, 4, 3), trailMatInst);
  mesh.name = 'cs_trail';
  mesh.position.copy(position);
  scene.add(mesh);

  splashParticles.push({
    mesh,
    vx: 0,
    vy: 0,
    vz: 0,
    lifetime: 0.4,
    elapsed: 0,
  });
}

// ── Ocean Sparkle (ambient) ─────────────────────────────────────────────────

export function spawnOceanSparkle(scene: Scene, splashParticles: SplashParticle[]): void {
  const x = randomRange(C.PLAY_X_MIN, C.PLAY_X_MAX);
  const z = randomRange(C.PLAY_Z_MIN, C.PLAY_Z_MAX);
  const mesh = new Mesh(new SphereGeometry(0.03, 4, 3), sparkleMat.clone());
  mesh.name = 'cs_oceanSparkle';
  mesh.position.set(x, 0.05, z);
  mesh.scale.setScalar(0);
  scene.add(mesh);

  splashParticles.push({
    mesh,
    vx: 0,
    vy: 0,
    vz: 0,
    lifetime: 0.2,
    elapsed: 0,
  });
}

// ── Bonus Coins ─────────────────────────────────────────────────────────────

export function spawnBonusCoins(scene: Scene, position: Vector3, coins: BonusCoin[]): void {
  for (let i = 0; i < C.BONUS_COIN_COUNT; i++) {
    const mesh = new Mesh(new CylinderGeometry(0.1, 0.1, 0.02, 8), coinMat);
    mesh.name = `cs_coin_${i}`;
    mesh.position.copy(position);
    scene.add(mesh);

    coins.push({
      mesh,
      vx: randomRange(-2, 2),
      vy: randomRange(3, 5),
      vz: randomRange(-1, -3),
      elapsed: 0,
    });
  }
}

// ── Score Indicator ──────────────────────────────────────────────────────────

const scoreIndicatorMat = makeMat('score_indicator', [1.0, 0.85, 0.3], {
  emissive: [1.0, 0.85, 0.3],
  transparent: true,
  opacity: 0.9,
});

/**
 * Spawns a small gold emissive mesh at hit position to indicate points earned.
 * Drifts upward and fades over 0.8s.
 */
export function spawnScoreIndicator(scene: Scene, position: Vector3, splashParticles: SplashParticle[]): void {
  const indicatorMat = scoreIndicatorMat.clone();
  const mesh = new Mesh(new BoxGeometry(0.2, 0.12, 0.02), indicatorMat);
  mesh.name = 'cs_scoreIndicator';
  mesh.position.set(position.x, position.y + 0.5, position.z);
  scene.add(mesh);

  splashParticles.push({
    mesh,
    vx: 0,
    vy: 1.5,
    vz: 0,
    lifetime: 0.8,
    elapsed: 0,
  });
}

// ── Particle Update ─────────────────────────────────────────────────────────

/** Updates all splash/effect particles, removes expired ones. */
export function updateParticles(particles: SplashParticle[], dt: number): void {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.elapsed += dt;
    const progress = Math.min(1, p.elapsed / p.lifetime);

    if (p.mesh.userData.isRing) {
      // Expanding ring
      const maxR = p.mesh.userData.maxRadius ?? 1.5;
      const scale = 1 + progress * (maxR / 0.1);
      p.mesh.scale.setScalar(scale);
      const mat = p.mesh.material as MeshStandardMaterial;
      mat.opacity = (p.mesh.userData.isRainbow ? 0.4 : 0.6) * (1 - progress);
      if (p.mesh.userData.isRainbow) {
        mat.color.setHSL((progress * 2) % 1, 0.8, 0.55);
      }
    } else if (p.mesh.name === 'cs_ripple') {
      // Expanding ripple disc
      const scale = 0.1 + progress * 1.9;
      p.mesh.scale.setScalar(scale / 0.1);
      const mat = p.mesh.material as MeshStandardMaterial;
      mat.opacity = 0.3 * (1 - progress);
    } else if (p.mesh.name === 'cs_oceanSparkle') {
      // Scale up then down
      const t = progress < 0.5 ? progress * 2 : (1 - progress) * 2;
      p.mesh.scale.setScalar((t * 0.05) / 0.03);
    } else if (p.mesh.name === 'cs_scoreIndicator') {
      // Score indicator: drift up (handled by vy), fade out, slight scale pulse
      p.mesh.position.y += p.vy * dt;
      const mat = p.mesh.material as MeshStandardMaterial;
      mat.opacity = 0.9 * (1 - progress);
      const scalePulse = 1 + 0.3 * Math.sin(progress * Math.PI);
      p.mesh.scale.setScalar(scalePulse);
    } else if (p.mesh.name === 'cs_trail') {
      // Trail particles: expand from 0.05 → 0.12 over lifetime (scale factor 1 → 2.4)
      p.mesh.scale.setScalar(1 + progress * 1.4);
      const mat = p.mesh.material as MeshStandardMaterial;
      mat.opacity = 0.3 * (1 - progress);
    } else {
      // Standard physics particle
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      p.vy += C.GRAVITY * dt;

      // Fade
      const mat = p.mesh.material as MeshStandardMaterial;
      if (mat.transparent) {
        mat.opacity = Math.max(0, (1 - progress) * (mat.userData?.startOpacity ?? 0.5));
      }

      // Shrink muzzle flash
      if (p.mesh.name.startsWith('cs_muzzle')) {
        p.mesh.scale.setScalar(1 - progress);
      }
    }

    if (progress >= 1) {
      p.mesh.geometry.dispose();
      (p.mesh.material as MeshStandardMaterial).dispose();
      p.mesh.removeFromParent();
      const last = particles.length - 1;
      if (i !== last) particles[i] = particles[last];
      particles.pop();
    }
  }
}

/** Updates all fragment particles. */
export function updateFragments(fragments: Fragment[], dt: number): void {
  for (let i = fragments.length - 1; i >= 0; i--) {
    const f = fragments[i];
    f.elapsed += dt;
    const progress = Math.min(1, f.elapsed / f.lifetime);

    f.mesh.position.x += f.vx * dt;
    f.mesh.position.y += f.vy * dt;
    f.mesh.position.z += f.vz * dt;
    f.vy += C.GRAVITY * dt;

    f.mesh.rotation.x += f.rotSpeedX * dt;
    f.mesh.rotation.y += f.rotSpeedY * dt;
    f.mesh.rotation.z += f.rotSpeedZ * dt;

    // Fade
    const mat = f.mesh.material as MeshStandardMaterial;
    if (mat.transparent) {
      mat.opacity = Math.max(0, (1 - progress) * 0.5);
    }

    if (progress >= 1) {
      f.mesh.geometry.dispose();
      mat.dispose();
      f.mesh.removeFromParent();
      const last = fragments.length - 1;
      if (i !== last) fragments[i] = fragments[last];
      fragments.pop();
    }
  }
}

/** Updates bonus coins (gravity + spin). */
export function updateCoins(coins: BonusCoin[], dt: number, scene: Scene, splashParticles: SplashParticle[]): void {
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i];
    c.elapsed += dt;
    c.mesh.position.x += c.vx * dt;
    c.mesh.position.y += c.vy * dt;
    c.mesh.position.z += c.vz * dt;
    c.vy += C.GRAVITY * dt;
    c.mesh.rotation.y += 8 * dt;

    if (c.mesh.position.y < -0.5) {
      // Tiny splash
      const pos = c.mesh.position.clone();
      pos.y = 0;
      // Spawn a single small splash particle
      const splashMesh = new Mesh(new SphereGeometry(0.04, 4, 3), splashMat);
      splashMesh.name = 'cs_coinSplash';
      splashMesh.position.copy(pos);
      scene.add(splashMesh);
      splashParticles.push({
        mesh: splashMesh,
        vx: 0,
        vy: randomRange(0.5, 1),
        vz: 0,
        lifetime: 0.3,
        elapsed: 0,
      });

      c.mesh.geometry.dispose();
      // Note: coinMat is a shared module-level material — do NOT dispose it here
      c.mesh.removeFromParent();
      const last = coins.length - 1;
      if (i !== last) coins[i] = coins[last];
      coins.pop();
    }
  }
}
