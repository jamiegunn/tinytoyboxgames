# environment/

Authored scene shell for the __GAME_DISPLAY_NAME__ minigame.

This folder owns everything that exists before gameplay starts: camera pose,
lighting rig, floor, backdrop, and gentle non-gameplay ambience.

- `index.ts`: public surface — setup, per-frame update, and teardown
- `setup.ts`: builds the environment rig and copies the authored camera pose
  onto the shell-owned camera so rendering and raycasting agree

Rules of the folder:

- environment code may animate ambience, but it must not score, spawn, or
  otherwise decide gameplay outcomes — those belong in `rules/`
- every mesh and material created here must be released in teardown
- keep authored constants (colors, sizes, poses) local to this folder
