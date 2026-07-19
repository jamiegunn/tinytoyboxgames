# parent-scene-stubs/

Copyable parent-scene wiring for __SCENE_DISPLAY_NAME__.

The generator owns scene creation, but it does not own spatial placement in
parent scenes — those are authored decisions. Instead of making authors
reconstruct the toybox contract from memory, each stub in this folder is an
exact, compiling example ready to copy into a parent scene manifest.

- `playroom.toybox.stub.ts`: a complete `ToyboxSpec` entry for the Playroom;
  copy it into the Playroom's `toyboxes/manifest.ts`, then tune placement,
  palette, and emblem

Rules of the folder:

- stubs are never imported by the scene itself — they are copy sources only
- after copying a stub into its parent scene, this folder can be deleted
- treat stub values as authored starting points, not generator truth
