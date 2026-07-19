# decor/

Room-owned authored content for __SCENE_DISPLAY_NAME__.

Everything in this folder is furniture, props, and set dressing — content the
room composes on top of its architectural shell.

- `sampleCounter.ts`: a placeholder prop that proves the compose path works

How to add decor:

1. Create one file per prop (or per small prop family)
2. Export a `create...` builder that adds meshes to the scene and returns
   whatever handle later cleanup needs
3. Compose it from `../room.ts` so the room stays the single composition owner

Graduation note: once real decor exists, delete `sampleCounter.ts` and its
compose call. Sample props are teaching scaffolding, not shipping content.

Rules of the folder:

- decor never registers scene-level `pointerdown` listeners — interactive
  decor goes through the shared tap dispatcher owned by the room runtime
- decor never repositions the camera or lights; those live in
  `../environment.ts`
