# Scene Rendering Standards

This document defines shared conventions for how scenes and minigames describe
and render their space, so each screen is not a bespoke snowflake. It exists
because the opposite — every screen inventing its own camera math and
hand-placing backdrop elements in world coordinates — produced real bugs
(Bubble Pop's moon and starfield were authored behind the camera and were
invisible for the entire life of the game; Star Catcher's moon needed
trial-and-error because the camera is mirrored and inverted).

## The core rule: place backdrops in screen space, not world space

Every camera in the app has a different convention:

| Surface                 | Camera                                                                    | Looks toward        | fov  |
| ----------------------- | ------------------------------------------------------------------------- | ------------------- | ---- |
| Minigame (shell)        | Fixed: pos `(0,2,5)`, `lookAt(0,0,0)`                                     | −Z                  | 60°  |
| Immersive/room scene    | Orbit (spherical, Babylon-derived), pos ≈ `target + (0, r·cosφ, −r·sinφ)` | +Z                  | 50°  |
| Star Catcher (authored) | Manifest `CameraDescriptor` orbit camera                                  | +Z via `azimuth: π` | ~52° |

A moon at world `(4, 7, 8)` is upper-right in one scene, behind the camera in
another, and off-screen in a third. So **do not hand-place sky/backdrop
elements in world coordinates.** Instead use the shared sky rig
(`src/src/utils/skyRig.ts`), which places elements in _screen space_ against
whatever camera is active, using the camera's own unprojection:

```ts
import { projectToView, createGradientSkydome, createCelestialBody, createCloudPuff } from '@app/utils/skyRig';

// "Put the moon 26% across, 28% down, 15 units from the camera" — correct for ANY camera.
moon.root.position.copy(projectToView(camera, 0.26, 0.28, 15));
```

`projectToView(camera, screenX, screenY, distance)` returns a world position on
the given screen ray (`screenX`/`screenY` are 0..1 with the origin at the
top-left) at the given distance from the camera. It reads the camera's real
matrices, so it needs no per-scene knowledge of look direction or handedness.

## The sky rig primitives

- **`createGradientSkydome({ radius, center, topColor, horizonColor, bottomColor, horizonSharpness })`** —
  an inverted vertex-gradient sphere that always fills the background. Centre it
  on the camera for a fixed camera, or on the scene origin for an orbit camera
  (radius must comfortably exceed the camera's distance from centre). No
  coverage math, no flat-plane seams. It is `fog: false`, `depthWrite: false`,
  `renderOrder: -1`, raycast-disabled.
- **`createCelestialBody({ radius, color, emissive, emissiveIntensity, haloScale, haloColor, haloOpacity })`** —
  a sun or moon: an emissive core sphere plus an optional additive halo.
  Returns `{ root, core, coreMaterial }` (the material handle lets a game pulse
  the glow). Position `root` with `projectToView`.
- **`createCloudPuff({ color, opacity, scale })`** — a soft cluster of squashed
  spheres. Position it with `projectToView`.

All primitives are unlit or emissive, `fog: false` (so scene fog cannot erase
them), texture-free (so they dispose cleanly with the scene), and
raycast-disabled (so they never intercept gameplay taps).

## Conventions

1. **Backdrop = screen space.** Sky, sun, moon, stars, clouds, distant hills —
   place with `projectToView`, never raw world coordinates.
2. **Sky = skydome.** Prefer `createGradientSkydome` over a flat plane. A flat
   plane must be sized/oriented per camera and tends to read as a wall with a
   hard seam; the dome is camera-agnostic.
3. **Backdrops ignore fog** (`fog: false`) so a scene's depth fog softens only
   its _geometry_, never the sky.
4. **Sizing.** On-screen diameter ≈ `worldRadius / distance / tan(fov/2) ·
viewportHeight`. To target ~`P` px tall at distance `d`:
   `worldRadius ≈ P/viewportHeight · tan(fov/2) · d`. (Example: a 110 px moon at
   d = 15, fov 60° → radius ≈ 0.143 · 0.577 · 15 ≈ 1.24.)
5. **Disposal.** Add rig meshes to the active lifecycle path: current scenes
   receive a `DisposalScope` from `SceneFrame`, current minigames receive one
   through `MiniGameContext`, and older environment helpers still sweep local
   mesh arrays during teardown. No textures means there is usually nothing
   else to free.

## Reference implementations

- **Bubble Pop** (`minigames/games/bubble-pop/environment/setup.ts`) — night
  skydome centred on the shell camera, moon + starfield placed with
  `projectToView`.
- **Pirate Cove** (`scenes/immersive-toybox-scenes/pirate-cove/index.ts`) — day
  skydome (blue → hazy horizon → sea) centred on origin, sun + clouds placed
  with `projectToView`.

## Follow-ups (not yet done)

- **Star Catcher** no longer uses the removed `createGameCamera`; its manifest
  supplies a `CameraDescriptor`. It still uses a hand-rolled vertex-gradient
  sky plane plus moon/starfield in `environment/setup.ts`. It works and looks
  good, but should migrate to `skyRig` for consistency the next time it is
  touched.
- The two camera families now share `CameraDescriptor` for fixed/orbit camera
  creation. Backdrop code should still use `projectToView` so it does not need
  to know which camera family it was handed.
