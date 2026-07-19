# factory/systems/

Scene-wide behaviors for __SCENE_DISPLAY_NAME__.

This folder is intentionally empty in a freshly generated scene. It exists for
behaviors that no single prop owns: ambient particle drift, scene-wide
animation clocks, weather, or coordinated effects that touch many props at
once.

A system follows the same contract as a prop composer: it takes the typed
`ComposeContext` (or the narrower slice it needs), performs its setup, and
returns one dispose function that undoes everything it registered. That keeps
`index.ts` free to treat systems and props uniformly.

Rules of the folder:

- systems may read prop handles but must not reach into prop internals —
  widen a prop's public surface instead
- per-frame work belongs on the shared update path, not on private
  `requestAnimationFrame` loops
- if a behavior only affects one prop family, it is not a system; keep it in
  that prop's folder
