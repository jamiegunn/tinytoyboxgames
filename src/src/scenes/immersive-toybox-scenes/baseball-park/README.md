# Baseball Park

A sunny toy ballpark inside the toybox: a dirt infield diamond with bases and
a pitcher's mound, bleacher banks flying pennants, a no-reading scoreboard,
and two things to tap — a batting tee whose ball pops up and comes home, and
loose baseballs that hop. Opened from the white-and-red chest in the Kitchen
(`kitchen-baseball-park` in the Kitchen's `toyboxes/manifest.ts`).

This scene follows the canonical immersive scene ceremony (ADR-0012): a thin
`index.ts` orchestration boundary, environment and materials modules,
data-only staging, and a `factory/` tree that separates scaffold, props, and
systems. The shared world-scene runtime supplies the owl (ADR-0011), and the
template, generator, and contract tests stay aligned (ADR-0013).

## Scene Anatomy

Scenery (simple props): `factory/props/simple/infield` (the diamond, three
base cushions, home plate, mound and rubber — all derived from one
`HALF_DIAGONAL` constant), `factory/props/simple/bleachers` (two stepped
banks with alternating red and blue seats), and
`factory/props/simple/scoreboard` (coloured tokens instead of numbers — the
age floor bars reading from the core experience).

Interactive props: `factory/props/interactive/battingTee` (tap the ball for a
pop-fly with its own `sfx_baseball_tee_pop` cue) and
`factory/props/interactive/looseBalls` (a rubbery double-hop answering with
`sfx_baseball_ball_bounce`). Both emit the shared sparkle burst and register
taps only through the shared dispatcher.

Audio lives in `assets/audio/baseballPark/`: a bouncy ballpark-organ bed in C
major pentatonic (`mus_baseball_park_background`) and a breeze-and-murmur
open-air ambient (`amb_baseball_park_crowd`), both registered in
`assets/audio/index.ts`.

## How To Test In The Browser

Start the frontend dev server from `src/`:

```bash
npm run dev
```

Then open:

`http://localhost:5173/#/baseball-park`

Expected result:

- the scene shell and sky backdrop render around the grass field
- the owl is present and responds to floor taps
- the infield, bleachers, and scoreboard are visible; the tee ball pops up on
  tap and the loose baseballs hop
- the Bubble Pop portal is present and enters the minigame

## Authoring New Props Here

Follow the compose / create / interaction split the existing props model:
static props imitate `factory/props/simple/infield`, tappable props imitate
`factory/props/interactive/battingTee`. Keep staging data in `staging/`,
return a dispose function from every composer, and register taps only through
the shared dispatcher. Anything that ignores those constraints will fail the
scene contract tests. Placement note: +X is screen LEFT — read the axes
header in `environment.ts` before writing a `Vector3`.

## Folder Structure

- `index.ts`: orchestration boundary and lifecycle owner
- `environment.ts`: clear color, lighting, portals, ground, and floor-tap config
- `materials.ts`: scene-wide shared materials
- `types.ts`: `ComposeContext` and shared scene types
- `staging/`: data-only placement records for prop families
- `factory/`: everything that builds meshes and wires behavior

## What Not To Do

- Do not move camera, portal, or owl ownership out of the shared runtime
- Do not add scene-level `pointerdown` listeners from prop folders
- Do not inline placement numbers in create code — staging owns placement
- Do not let `index.ts` grow mesh details; it composes, it does not build
