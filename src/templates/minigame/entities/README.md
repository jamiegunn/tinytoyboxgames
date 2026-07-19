# entities/

Entity construction and lifecycle for the __GAME_DISPLAY_NAME__ minigame.

This folder owns what targets look like and how they move through the shared
entity pool. It deliberately knows nothing about scoring or spawn cadence.

- `index.ts`: creates, resets, animates, and disposes a single target
- `lifecycle.ts`: pool-aware spawn and recycle helpers for the active set
- `effects.ts`: short-lived local effects (for example the miss pulse)

Rules of the folder:

- every target comes from the pool and must go back to the pool — pair each
  spawn path with a recycle path so restarts stay clean
- keep geometry and material details here so `index.ts` at the game root
  never becomes a geometry file
- when real game entities replace the sample target family, delete the sample
  code rather than leaving dead branches behind
