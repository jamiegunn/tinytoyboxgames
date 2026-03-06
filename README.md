# Tiny Toybox

A collection of simple, colorful browser games for kids ages 3-5. The current implementation is browser-first and uses Vite for local development and production builds.

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:5173` for the landing page and `http://localhost:5173/toybox.html` for the toy shelf directly.

Other commands:
- `npm run build` - production build to `dist/`
- `npm run preview` - preview the production build
- `npm start` - serve `dist/` with the included Node static server

Docker also serves the production build only. The container image runs `vite build` and copies `dist/` into nginx.

## Games

| Game | Description | Status |
|------|-------------|--------|
| Bubble Pop | Tap floating bubbles to pop them | Done |
| Feed Animal | Tap food to feed the animal | Done |
| Color Match | Tap the swatch that matches the color name | Done |
| Fireflies | Catch glowing fireflies in a jar | Done |
| Hide and Seek | Find animals peeking from hiding spots | Done |
| Clean the Mess | Wipe away the mess to reveal the scene | Done |
| Balloon Race | Swipe balloons upward to launch them | Done |
| Shape Builder | Drag shapes into matching slots | Done |
| Baby Shark | Guide a shark through an underwater play scene | Done |
| Puppy Fetch | Play fetch with a puppy | Done |
| Elephant Splash | Spray water at playful targets | Done |
| Monster Truck | Tap to jump and crush obstacles | Done |
| Animal Sounds | Match a sound to the right animal | Planned |
| Build a Monster | Drag parts onto a monster body | Planned |

## Project Structure

```text
tinytoybox/
|- index.html              Landing page
|- toybox.html             Toy shelf and game shell
|- app.js                  Boots the engine and handles navigation
|- engine/
|  |- gameManager.js       Lazy-loads games and manages lifecycle
|  |- loop.js              requestAnimationFrame loop with dt
|  |- input.js             Tap and drag input helpers
|  |- celebrate.js         Confetti bridge
|- games/
|  |- *.js                 Individual game modules
|  |- requirements/        Game design specs
|- js/                     Toy shelf presentation scripts
|- css/                    Toy shelf styles
|- docs/
|  |- adr/                 Architecture Decision Records
|  |- plans/               Roadmaps and refactor plans
|- server.js               Optional static server for built output
```

## Architecture

Current runtime layers:

1. Landing and toy shelf UI: `index.html`, `toybox.html`, `css/`, and `js/`
2. Game engine utilities: loop, input, lifecycle, celebration
3. Game modules: each game currently owns its own rendering and gameplay logic

Games lazy-load via dynamic `import()`, so only the active game module is loaded at runtime.

The repo also contains planning docs for a future template-based architecture. Those plans are not implemented yet.

## Design Principles

- Big tap targets
- Bright colors, no reading required
- Celebrate every success
- No fail states or penalties
- Recognition over reading

## Tech

- Vanilla JS, ES modules, canvas 2D
- Vite for dev/build
- Optional Node static server for built output
- `canvas-confetti` served as a static asset for celebrations
- Works on mobile (touch) and desktop (mouse)

## Docs

- `docs/adr/` - Architecture Decision Records and implementation notes
- `docs/plans/` - Roadmaps and refactor plans
- `games/requirements/` - Per-game design specs
