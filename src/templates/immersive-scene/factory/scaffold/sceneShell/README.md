# factory/scaffold/sceneShell/

Enclosing shell for __SCENE_DISPLAY_NAME__.

- `create.ts`: builds the wall meshes around the play space from a width,
  depth, wall height, and the shared scene materials
- `index.ts`: exports `createSceneShell`

The shell is sized from `IMMERSIVE_SCENE_ENVIRONMENT.ground` in
`environment.ts` so the walls always agree with the ground plane the shared
runtime raycasts against. Change the shell's footprint by changing the
environment config, not by editing numbers here.

Rules of the folder:

- structural meshes only — decoration attached to walls is a prop
- use shared materials from `materials.ts`; do not create one-off materials
