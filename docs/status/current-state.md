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

| Scene ID | Display name | Kind | Status |
|---|---|---|---|
| `playroom` | Playroom | landing | implemented |
| `kitchen` | Kitchen | landing | implemented |
| `nature` | Nature | immersive-toybox | implemented |
| `pirate-cove` | Pirate Cove | immersive-toybox | implemented |

## Active room destinations

### Playroom toyboxes

| Toybox ID | Destination | Status |
|---|---|---|
| `adventure` | `pirate-cove` | active |
| `animals` | `nature` | active |
| `creative` | `null` | present but inactive |

### Kitchen toyboxes

| Toybox ID | Destination | Status |
|---|---|---|
| `kitchen-nature` | `nature` | active |

## Registered minigames

| Game ID | Display name | Launchable from | Status |
|---|---|---|---|
| `bubble-pop` | Bubble Pop | `nature` | registered |
| `fireflies` | Fireflies | `nature` | registered |
| `little-shark` | Little Shark | `nature` | registered |
| `star-catcher` | Star Catcher | `nature` | registered |
| `cannonball-splash` | Cannonball Splash | `pirate-cove` | registered |

## Discoverable minigames

These are the minigames currently surfaced through in-scene portals:

### Nature

- `bubble-pop`
- `little-shark`
- `fireflies`

### Pirate Cove

- `cannonball-splash`

### Important nuance

`star-catcher` is currently **registered** for `nature`, but it is **not currently surfaced** through Nature's in-scene portal list.

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

## Known current-state gaps

- The Playroom `creative` toybox is visible but inactive (destination is `null`)
- `star-catcher` is registered but not discoverable through current scene UI
- Public marketing copy must not claim four worlds or twelve mini-games
- Some internal AI docs may lag behind current route and minigame reality if this file is not kept updated

## Claims docs must not make

Do not claim any of the following unless the code is updated and this file is revised:

- four toybox worlds are currently playable
- twelve mini-games are currently playable
- all visible toyboxes are active
- all registered minigames are exposed in-scene
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
