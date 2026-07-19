# Tiny Toybox Games — App Package

This is the application package for Tiny Toybox Games (React + Three.js, built with Vite).
For product overview and documentation, see the [root README](../README.md) and [`../docs/`](../docs/).

## Getting started

Bun is the primary workflow:

```bash
bun install
bun run dev
```

Then open `http://localhost:5173`. npm equivalents (`npm install`, `npm run dev`) also work.

## Scripts

| Script | What it does |
|---|---|
| `dev` | Start the Vite dev server with HMR |
| `build` | Type-check (`tsc -b`) then produce a production build |
| `preview` | Serve the production build locally |
| `lint` | Run ESLint over the package |
| `format` | Prettier-write `src/**/*.{ts,tsx}` |
| `format:check` | Prettier check without writing |
| `test` | Run the full contract test suite (see below) |
| `precommit:check` | Run the pre-commit quality checks |
| `create:immersive-scene` | Scaffold a new immersive toybox scene |
| `create:room-scene` | Scaffold a new room scene |
| `create:minigame` | Scaffold a new minigame |

Generator examples:

```bash
npm run create:immersive-scene -- --scene-id coral-reef --display-name "Coral Reef"
npm run create:room-scene -- --scene-id bedroom --display-name "Bedroom"
npm run create:minigame -- --game-id star-catcher --display-name "Star Catcher"
```

Each generator copies a governed template from `templates/`, replaces placeholder
tokens, registers the result in the appropriate manifest or catalog, and prints
next steps.

## Tests

`npm test` runs `node --test` contract tests (no extra test framework) over the
templates and generators:

- `tests/template/` — immersive-scene template contract
- `tests/room/` — Playroom room-scene runtime contract
- `tests/room-template/` — room-scene template contract
- `tests/minigame-template/` — minigame template contract

The template suites generate scaffolding into a temp fixture and assert
structure, naming, registration, docs, and compile-safety; the room suite
checks the real Playroom implementation. They protect the generator and scene
contracts rather than runtime gameplay.

## Type checking

`npm run build` runs `tsc -b` before `vite build`, so every production build is
fully type-checked. To type-check without bundling, run `npx tsc -b`.
