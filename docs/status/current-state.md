# Current State

This document is the canonical description of what **currently exists in the repo**.
If any other document disagrees with this one, verify the code and update the document that is wrong.

## Public product name vs internal codename

- **Public product name:** Tiny Toybox Games
- **Internal codename (optional):** Whimsical Toybox World

Public-facing docs should prefer **Tiny Toybox Games**.
Internal architecture/spec documents may use **Whimsical Toybox World** only when needed.

## Current app entry behavior

- Empty hash (`#` or no hash) renders the landing page
- Valid scene hash renders the 3D app
- Invalid hash renders the not-found page

## Registered scenes

Current scene routes:

| Scene ID      | Display name | Kind             | Status      |
| ------------- | ------------ | ---------------- | ----------- |
| `playroom`    | Playroom     | landing          | implemented |
| `kitchen`     | Kitchen      | landing          | implemented |
| `living-room` | Living Room  | landing          | implemented |
| `nature`      | Nature       | immersive-toybox | implemented |
| `pirate-cove` | Pirate Cove  | immersive-toybox | implemented |

## Scene audio

Per `src/src/scenes/sceneCatalog.ts`, every registered scene now has scene-level audio.
Every minigame also declares its own `musicId` in `MiniGameManifest.ts`, auto-started
by the shell (see `docs/ai-guidance/audio-standards.md`; enforced by
`src/tests/audio/music-coverage.test.mjs`):

| Scene ID      | Music                        | Ambient                 |
| ------------- | ---------------------------- | ----------------------- |
| `playroom`    | `mus_hub_background`         | `amb_hub_room_tone`     |
| `kitchen`     | `mus_kitchen_background`     | `amb_hub_room_tone`     |
| `living-room` | `mus_living_room_background` | `amb_hub_room_tone`     |
| `nature`      | `mus_nature_background`      | `amb_nature_stream`     |
| `pirate-cove` | `mus_pirate_cove_background` | `amb_pirate_cove_shore` |

## Active room destinations

### Playroom toyboxes

| Toybox ID   | Destination   | Status               |
| ----------- | ------------- | -------------------- |
| `adventure` | `pirate-cove` | active               |
| `animals`   | `nature`      | active               |
| `creative`  | `null`        | present but inactive |

### Kitchen toyboxes

| Toybox ID        | Destination | Status |
| ---------------- | ----------- | ------ |
| `kitchen-nature` | `nature`    | active |

### Living Room toyboxes

| Toybox ID                 | Destination   | Status |
| ------------------------- | ------------- | ------ |
| `living-room-nature`      | `nature`      | active |
| `living-room-pirate-cove` | `pirate-cove` | active |

### Doorway connections

Rooms are also connected by tappable doorways (shared builder in
`src/src/scenes/world/places/house/shared/interactiveDoorway.ts`):

| From          | Doorway leads to | Notes                                                                                   |
| ------------- | ---------------- | --------------------------------------------------------------------------------------- |
| `playroom`    | `living-room`    | right-wall door                                                                         |
| `living-room` | `playroom`       | left-wall door                                                                          |
| `living-room` | `kitchen`        | right-wall door                                                                         |
| `living-room` | `nature`         | back-wall "outside" door; the forest is outside until a dedicated backyard scene exists |
| `kitchen`     | `living-room`    | left-wall door                                                                          |

The HUD back button follows each scene's catalog `backTarget` (default
`playroom`); `kitchen` declares `backTarget: 'living-room'`.

## Registered minigames

| Game ID             | Display name      | Launchable from | Status                    |
| ------------------- | ----------------- | --------------- | ------------------------- |
| `bubble-pop`        | Bubble Pop        | `nature`        | registered + discoverable |
| `fireflies`         | Fireflies         | `nature`        | registered + discoverable |
| `little-shark`      | Little Shark      | `pirate-cove`   | registered + discoverable |
| `star-catcher`      | Star Catcher      | `nature`        | registered + discoverable |
| `cannonball-splash` | Cannonball Splash | `pirate-cove`   | registered + discoverable |

## Discoverable minigames

These are the minigames currently surfaced through in-scene portals:

### Nature

- `bubble-pop`
- `fireflies`
- `star-catcher`

### Pirate Cove

- `cannonball-splash`
- `little-shark`

Little Shark moved from Nature to Pirate Cove on 2026-08-02. Nature was carrying
four portals with a closest pair 1.80 units apart — touching rims — and two of
the four were partly behind trees. Both scenes are now measured against
`tests/room/portalVisibility.test.mjs`, which requires every portal to be under
10% occluded at all nine shipping aspects and at least 3 units from its
neighbour. A shark also belongs at sea.

## Shared runtime truths

The current repo safely supports these claims:

- browser-first experience
- no install or app-store flow
- lazy-loaded scenes
- lazy-loaded minigames
- shared owl companion in navigable scenes
- no browser persistence in app runtime (storage guard bootstrap)
- procedural geometry, materials, and particles
- procedural audio architecture
- React app shell + Three.js scene lifecycle separation
- generator-based scaffolding for immersive scenes, room scenes, and minigames
- a drag turns the scene about its centre; there is no panning, and the turn is
  clamped to ±10.3° in every scene (`utils/scene/rotationRange.ts`)
- the Kitchen and Living Room are 10.8 x 15 x 6.2; the Playroom is 12 x 24 x 6.75
- no room shows any of its ceiling at the opening pose, at any stage aspect
- the canvas is a letterboxed stage with an aspect clamped to 1.0–1.4, and the
  leftover viewport is a chrome band the HUD lives in (`utils/scene/stageRect.ts`)

## Known current-state gaps

- The Playroom `creative` toybox is visible but inactive (destination is `null`); it now responds to taps with a wiggle, sparkle, and sound instead of a dead tap
- Rotation is capped at ±10.3° by the Kitchen at the wide end of the stage band (±12.1°). The Living Room used to set this and no longer does — its two toyboxes came 0.9 off the side walls, which took it from ±12.0° to ±29.3°. See architecture-standards.md#stagerect
- On a phone the chrome band takes roughly half the screen, because a landscape-shaped set cannot fill a portrait viewport. The band is usable space rather than a defect, but nothing yet puts anything in it beyond the three HUD buttons
- Public marketing copy must not claim four worlds or twelve mini-games
- Some internal AI docs may lag behind current route and minigame reality if this file is not kept updated

## Claims docs must not make

Do not claim any of the following unless the code is updated and this file is revised:

- four toybox worlds are currently playable
- twelve mini-games are currently playable
- all visible toyboxes are active
- newly registered minigames are automatically exposed in-scene without portal wiring
- roadmap content is already implemented

## How to update this file when content changes

Update this file whenever any of the following changes:

- `src/src/scenes/sceneCatalog.ts`
- any room toybox manifest
- `src/src/minigames/framework/MiniGameManifest.ts`
- any immersive scene `environment.ts` portal list
- landing-page claim counts
- README current-state counts

### Vocabulary rules

- **implemented** = code exists and is wired into runtime
- **registered** = present in a catalog or manifest
- **discoverable** = reachable by a normal player through the current UI
- **inactive** = present but not currently wired to an active destination
- **roadmap** = planned but not currently present in code
- **target architecture** = the intended structural end-state the code is moving toward
