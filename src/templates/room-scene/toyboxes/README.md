# toyboxes/

Scene-local toybox declarations for __SCENE_DISPLAY_NAME__.

- `manifest.ts`: the complete list of toyboxes this room presents, as
  `ToyboxSpec` entries — id, destination scene, variant, placement, palette,
  and emblem

The manifest is declarative on purpose. The shared toybox framework builds the
chest meshes, wires the tap handling, and performs the navigation to each
`destination`. A room adds, removes, or retargets a toybox by editing data
here — never by hand-building chest meshes in `decor/`.

Rules of the folder:

- one manifest, no side files — placement tuning happens in the spec entries
- a `destination` of `null` renders a chest that is present but not yet
  navigable; use it for coming-soon content
- keep ids stable once shipped; they are used as scene-local identifiers
