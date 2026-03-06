# ADR-002: Game Templates Over Custom Games

## Status
Planned

## Context
Building many unique games from scratch duplicates spawning, hit detection, drag handling, scoring, and celebration logic.

## Decision
Refactor toward 5 reusable game templates. This is the target architecture, not the current implementation.

## Current Implementation
Games are still bespoke modules under `games/`. Shared behavior is limited to engine utilities such as lifecycle, input, and celebration.

## Target Templates

### 1. TapGame
Spawn objects, kid taps them, objects react.

Used by: Bubble Pop, Fireflies, Hide and Seek Animals

### 2. DragGame
Drag items to target zones, check match, celebrate.

Used by: Feed the Animal, Shape Builder Puzzle, Build a Monster

### 3. ChoiceGame
Show a prompt, present options, tap the correct one.

Used by: Color Match, Animal Sound Guess

### 4. SwipeGame
Swipe or brush across the screen to complete an action.

Used by: Clean the Mess, Balloon Race

### 5. BuilderGame
Choose pieces, drag to slots, snap, build something.

Used by: Build a Funny Monster, Shape Builder

## Consequences
- A future template layer would reduce duplicated code
- Adding new games could become config-driven
- Until a `templates/` directory exists, this ADR should be treated as roadmap material
