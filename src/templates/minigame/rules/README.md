# rules/

Gameplay rules for the __GAME_DISPLAY_NAME__ minigame.

This folder sits above the entity layer and below the root lifecycle file. It
is the readable home for "gameplay glue": what spawns, when, and what a tap is
worth.

- `index.ts`: high-level helpers — spawn the next target, update active
  targets, find which target a tap hit
- `scoring.ts`: what a successful tap and a miss each do to game state
- `spawning.ts`: authored spawn bounds, cadence, and difficulty response

Rules of the folder:

- rules code decides outcomes; it never constructs meshes — entity visuals
  live in `entities/`
- difficulty response belongs here so tuning is a one-folder job
- keep authored numbers named and commented; they are the game design surface
