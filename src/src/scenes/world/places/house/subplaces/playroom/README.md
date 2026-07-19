# Playroom

The Playroom is the house's landing room and the reference implementation of
the shared room pattern that the room-scene template generates.

## The Shared Room Pattern

`index.ts` is a thin orchestration boundary. It does not build cameras,
lights, the owl, or interaction loops itself — it delegates all shared
lifecycle ownership to `createRoomScene` (from `@app/utils/roomSceneFactory`)
and passes in only what is authored per-room:

- `sceneId` and the environment config from `environment.ts` (clear color,
  lighting rig, owl spawn and flight bounds for floor taps)
- `buildContents` from `room.ts`, the room-authored composition that builds
  the shell, decor, and toyboxes
- `enableLegacyClickScan: true`, explained below

`createRoomScene` owns the camera, the owl, the floor-tap system, and one
shared tap dispatcher for the whole scene. Room content never adds its own
scene-level `pointerdown` listeners.

## Tap Handling And `userData.onClick`

The Playroom predates the shared dispatcher, so many of its toys expose their
tap behavior by assigning a `userData.onClick` function on their mesh (see the
toy car, desk lamp, and music player). Because `enableLegacyClickScan` is set,
the room runtime scans the scene after `buildContents` runs and auto-registers
every object whose `userData.onClick` is a function with the shared tap
dispatcher. Existing toys keep working; new interactive content should
register with the dispatcher directly rather than adding more
`userData.onClick` handlers.

## Toyboxes

`toyboxes/manifest.ts` declares the room's toyboxes as data-only `ToyboxSpec`
entries — currently the adventure chest (to `pirate-cove`), the animals box
(to `nature`), and a creative dresser with a `null` destination (present but
not yet navigable). The shared toybox framework builds the chest meshes,
wires the taps, and performs the navigation; the room only edits the manifest.

## Folder Structure

- `index.ts`: orchestration boundary delegating to `createRoomScene`
- `environment.ts`: `PLAYROOM_ENVIRONMENT` — clear color, lighting, floor-tap
- `layout.ts`: authored spatial constants (wall faces, ceiling height)
- `room.ts`: room-authored composition entry (`buildPlayroomContents`)
- `room/`: architectural shell — walls (with per-wall panels, trim, decals),
  floor, ceiling, door, wainscoting, wallpaper, wall art. The door is an
  interactive doorway (shared builder in
  `@app/scenes/world/places/house/shared/interactiveDoorway`) on the right
  wall: tapping it creaks it open and navigates to the Living Room
- `decor/`: furniture and set dressing (beanbag, easel, banner, drum, ...)
- `floorToys/`: toys scattered on the floor (blocks, train, stacking rings, ...)
- `bookshelf.ts` / `bookshelf-items/`: the shelf and the items on it
- `critters.ts` / `critters/`: animal visitors and wind-up toys
- `window.ts`: the window feature
- `toyboxes/`: scene-local toybox manifest

## Extension Guidance

1. Keep `index.ts` thin; push authored content into `room.ts` and its folders
2. Add or retarget toyboxes only in `toyboxes/manifest.ts`
3. Wire new interactions through the shared dispatcher, not new listeners
4. Keep camera and lighting ownership in `environment.ts` + the room runtime
