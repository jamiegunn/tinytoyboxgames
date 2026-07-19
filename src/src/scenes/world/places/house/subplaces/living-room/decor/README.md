# decor/

Room-owned authored content for Living Room.

Everything in this folder is furniture, props, and set dressing — content the
room composes on top of its architectural shell.

- `rug.ts`: round felt rug with concentric bands (also an owl floor-tap target)
- `couch.ts`: teal couch with three tappable throw cushions
- `fireplace.ts`: brick hearth with flickering emissive flames (tappable)
- `floorLamp.ts`: warm glowing floor lamp (tappable)
- `catPlush.ts`: sleeping cat plush on the rug (tappable)
- `sideTable.ts`: side table with storybooks and a cocoa mug
- `windowFrame.ts`: dusk window with curtains
- `wallArt.ts`: framed sun and moon pictures
- `index.ts`: `createLivingRoomDecor` — the single compose entry for `../room.ts`

How to add decor:

1. Create one file per prop (or per small prop family)
2. Export a `create...` builder that adds meshes to the scene and returns
   whatever handle later cleanup needs
3. Compose it from `index.ts` so the room stays the single composition owner

Rules of the folder:

- decor never registers scene-level `pointerdown` listeners — interactive
  decor goes through the shared tap dispatcher owned by the room runtime
- decor never repositions the camera or lights; those live in
  `../environment.ts`
