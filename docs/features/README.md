# Tiny Toybox Feature Guide

This folder documents the current shipped feature set based on the source code in `toybox.html`, `app.js`, `engine/`, `js/`, and `games/`.

The live app currently contains:

- 1 toybox shell and launcher
- 12 playable games

Older planning notes in the repo reference an earlier 10-game scope plus backlog ideas. These docs describe what is actually implemented now.

## Shared product traits

- Everything runs client-side in the browser.
- Persistent storage is intentionally disabled, so nothing is saved between sessions.
- The toy shelf is visual-first and works with both touch and mouse input.
- Games are loaded on demand through dynamic imports.
- Every game uses the shared canvas shell, common input helpers, and confetti celebrations.
- Each game has its own lightweight synthesized music loop.
- There are no accounts, ads, timers, or hard fail states.

## Feature docs

- [Toybox And Launcher](./toybox.md)
- [Bubble Pop](./bubble-pop.md)
- [Feed Animal](./feed-animal.md)
- [Color Match](./color-match.md)
- [Fireflies](./fireflies.md)
- [Hide And Seek](./hide-and-seek.md)
- [Clean The Mess](./clean-the-mess.md)
- [Balloon Race](./balloon-race.md)
- [Shape Builder](./shape-builder.md)
- [Baby Shark](./baby-shark.md)
- [Puppy Fetch](./puppy-fetch.md)
- [Elephant Splash](./elephant-splash.md)
- [Monster Truck](./monster-truck.md)
