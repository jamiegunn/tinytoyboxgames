# Bubble Pop

## What it is

Bubble Pop is a simple tap game where oversized bubbles float upward across a dark blue sky and disappear when touched.

## How it plays

1. The round starts with five bubbles already on screen.
2. New bubbles spawn regularly while older ones drift upward and wobble side to side.
3. The player taps bubbles to pop them before they float away.
4. Every successful pop immediately replaces the popped bubble with a new one.

## Controls

- Tap directly on a bubble.

## Scoring and progression

- Each popped bubble adds 1 point.
- Bubbles respawn forever, so the game behaves like an endless score-chase.
- Missing a bubble has no penalty beyond losing that specific point opportunity.

## Feedback and presentation

- Each hit triggers a synthesized bubbly pop sound.
- Every pop also triggers confetti through the shared celebration system.
- The visuals stay intentionally uncluttered: gradient sky, large glossy bubbles, centered score.

## Source

- `games/bubblePop.js`
