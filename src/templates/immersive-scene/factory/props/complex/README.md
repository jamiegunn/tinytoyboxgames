# factory/props/complex/

Complex props for __SCENE_DISPLAY_NAME__.

This tier is intentionally empty in a freshly generated scene. It exists for
props that outgrow the interactive tier: multi-part builds, props with their
own internal animation state machines, or props composed of several
coordinated sub-meshes.

A complex prop still follows the standard prop pattern — `constants.ts`,
`create.ts`, `interaction.ts`, `compose.ts`, `index.ts` — but may add internal
modules of its own. Whatever it adds, its public surface stays a single
composer that takes `ComposeContext` and returns one dispose function, so
`index.ts` at the scene root treats it exactly like every other prop.

Start props in `simple/` or `interactive/` and promote them here only when
their internals genuinely need more structure.
