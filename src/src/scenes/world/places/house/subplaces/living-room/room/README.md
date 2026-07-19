# room/

Architectural shell for the Living Room room.

This folder owns the structure of the room and nothing else: the surfaces the
player is "inside".

- `walls.ts`: back, left, and right wall panels
- `ceiling.ts`: ceiling plane
- `floor.ts`: floor plane the shared floor-tap system raycasts against

Rules of the folder:

- only structural pieces belong here — if it could be picked up or replaced
  without remodeling the room, it is decor and belongs in `decor/`
- shell dimensions come from the authored constants in `../layout.ts`; do not
  invent local sizes that drift from the layout
- keep shell code free of interaction wiring — tap behavior is owned by the
  shared room runtime and `toyboxes/manifest.ts`
