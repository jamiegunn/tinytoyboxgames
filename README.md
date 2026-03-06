# Tiny Toybox

A collection of simple, colorful games for kids ages 3-5. Purely client-side, no build step, no dependencies to install.

## Getting Started

```bash
npm install
npm run dev
```

Opens at http://localhost:5173 with hot reload — edit any file and the browser updates instantly.

**Other commands:**
- `npm run build` — production build to `dist/`
- `npm run preview` — preview the production build

## Games

| Game | Description | Status |
|------|-------------|--------|
| Bubble Pop | Tap floating bubbles to pop them | Done |
| Feed Animal | Tap food to drop it into the animal's mouth | Done |
| Color Match | Tap the swatch that matches the color name | Done |
| Fireflies | Catch glowing fireflies in a jar | Planned |
| Hide and Seek | Find animals peeking from hiding spots | Planned |
| Animal Sounds | Match a sound to the right animal | Planned |
| Shape Builder | Drag shapes into matching outlines | Planned |
| Clean the Mess | Swipe to reveal a hidden picture | Planned |
| Balloon Race | Swipe balloons into the sky | Planned |
| Build a Monster | Drag parts onto a monster body | Planned |

## Project Structure

```
tinytoybox/
├── index.html              Entry point
├── app.js                  Boots engine, wires menu navigation
├── engine/
│   ├── gameManager.js      Lazy-loads games, manages lifecycle
│   ├── loop.js             requestAnimationFrame loop with dt
│   ├── input.js            Tap/click input with cleanup
│   └── celebrate.js        Confetti via canvas-confetti CDN
├── games/
│   ├── bubblePop.js        Tap game
│   ├── feedAnimal.js       Tap-to-drop game
│   ├── colorMatch.js       Choice game
│   └── requirements/       Game design specs (one per game)
└── docs/
    ├── adr/                Architecture Decision Records
    └── plans/              Implementation plans
```

## Architecture

Three layers:

1. **Toy Shelf UI** — launcher, navigation (currently HTML buttons, canvas shelf planned)
2. **Game Engine** — loop, input, rendering, celebration system
3. **Game Templates + Configs** — 5 reusable templates (TapGame, DragGame, ChoiceGame, SwipeGame, BuilderGame) with games defined as configuration

Games lazy-load via dynamic `import()` — only the active game is in memory.

## Design Principles

- Big tap targets (45px+ radius)
- Bright colors, no reading required
- Celebrate every success (confetti)
- No timers, no fail states, no penalties
- Recognition over reading

## Tech

- Vanilla JS, ES modules, canvas 2D
- No framework, no build step, no server
- [canvas-confetti](https://www.npmjs.com/package/canvas-confetti) loaded via CDN for celebrations
- Works on mobile (touch) and desktop (mouse)

## Docs

- `docs/adr/` — Architecture Decision Records (toy shelf, templates, UX principles, etc.)
- `docs/plans/` — Implementation plans with checklists
- `games/requirements/` — Per-game design specs
