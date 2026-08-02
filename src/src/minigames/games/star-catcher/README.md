# Star Catcher

Catch falling stars before they drift away. The proof game for the minigame
template — it was produced by the generator and then finished, so its shape is
what a generated game is meant to grow into.

## How To Test In The Browser

Start the dev server from `src/`:

```bash
npm run dev
```

Then open the game through its host scene hash route:

`http://localhost:5173/#/nature/star-catcher`

Expected result:

- the hilltop environment renders: authored orbit camera, lights, ground, and a
  hand-rolled vertex-gradient sky plane with a moon and starfield
- stars spawn on a difficulty-driven cadence and drift upward
- tapping a star scores a hit; tapping empty space produces a miss pulse
- leaving the game disposes every mesh, material, and registration

## Folder Structure

- `index.ts`: lifecycle orchestration boundary consumed by `MiniGameShell`
- `types.ts`: shared state and config types for this game
- `helpers.ts`: small pure utilities
- `view.ts`: screen-space helpers for placing authored backdrop elements
- `environment/`: authored scene shell — camera, lights, ground, sky, moon
- `entities/`: star construction, pooling lifecycle, and local effects
- `rules/`: gameplay glue — scoring, spawning cadence, difficulty response

## Registration

`src/minigames/framework/MiniGameManifest.ts` is the single registration
surface: id, display name, icon, input modes, camera descriptor, difficulty
ramp, and the lazy `load()` import all live there. Nature's portal array in
`src/scenes/immersive-toybox-scenes/naturescene/environment.ts` is a **second,
independent** surface — a manifest entry makes a game launchable, a portal makes
it discoverable. Changing one does not change the other.

## Camera

This game does not use createGameCamera — that helper was removed (written in plain text deliberately: backticks in these READMEs mean the identifier exists today). The manifest
supplies a `CameraDescriptor` (`kind: 'orbit'`, `azimuth: Math.PI`, fov ≈ 51.6°),
and `azimuth: Math.PI` is what reproduces the old fixed camera's −Z view under
the native three.js Spherical convention. See
`docs/ai-guidance/scene-rendering-standards.md`.

## Backdrop

Star Catcher predates the shared sky rig and still hand-rolls its sky as a
vertex-coloured PlaneGeometry in `environment/setup.ts`, rather than using
`createGradientSkydome` from `@app/utils/skyRig`. That is a known deviation,
recorded in `scene-rendering-standards.md`, not a pattern to copy — a new game
should use the shared rig.

## Music

`mus_star_catcher_background`, registered in `src/assets/audio/index.ts` and
started automatically by the shell. Its bed follows the I–vi–IV–V cadence
described in `docs/ai-guidance/audio-standards.md`.

## What Not To Do

- Do not bypass `MiniGameShell` lifecycle hooks with ad-hoc listeners
- Do not create meshes inside `rules/` or score inside `entities/`
- Do not leak pooled entities — every spawn path must have a recycle path
- Do not register the game anywhere except `MiniGameManifest.ts`
