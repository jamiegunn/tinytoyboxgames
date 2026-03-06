# ADR-003: Three-Layer Architecture

## Status
Partially Implemented

## Context
The project benefits from clear separation between UI, shared engine code, and game-specific logic.

## Decision
Organize Tiny Toybox so that shelf UI, shared engine behavior, and game logic are distinct concerns.

## Current Layers

```text
Layer 1: Landing + Toy Shelf UI  (landing page, toy shelf, companion UI)
Layer 2: Game Engine             (loop, input, lifecycle, celebration)
Layer 3: Game Modules            (individual games and their rendering)
```

## Current Directory Structure

```text
tinytoybox/
  index.html
  toybox.html
  app.js
  engine/
    gameManager.js
    loop.js
    input.js
    celebrate.js
  games/
    bubblePop.js
    feedAnimal.js
    colorMatch.js
    ...
  js/
    buddy.js
    musicbox.js
    playroom.js
```

## Planned Extension
A template/config layer may be added later, but it does not exist in the current repo.

## Consequences
- Shelf UI remains separate from game logic
- Shared engine improvements can benefit every game
- New games currently touch `games/` directly
- Documentation must distinguish between current architecture and future refactor plans
