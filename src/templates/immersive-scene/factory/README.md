# factory/

Everything that builds meshes and wires behavior for __SCENE_DISPLAY_NAME__.

The factory tree keeps three concerns in three places:

- `scaffold/`: the stage itself — scene shell and sky backdrop that make the
  space feel like the inside of a toybox before any prop exists
- `props/`: authored content placed on that stage, tiered by complexity
  (`simple/`, `interactive/`, `complex/`)
- `systems/`: scene-wide behaviors that are not owned by any single prop
- `composeHelpers.ts`: the shared composer contract — `composeCollection`
  for simple props, `composeInteractiveCollection` for interactive ones

The composer contract is the load-bearing idea: every composer takes a typed
`ComposeContext` (or scene) plus staging data and returns a dispose function,
even when that function is a no-op. `index.ts` at the scene root only ever
sees composers, which is why it stays stable as the scene grows.

Prop pattern (see the sample props for working examples):

- `constants.ts`: authored colors and dimensions
- `create.ts`: builds one instance from a staging record
- `interaction.ts`: tap wiring through the shared dispatcher (interactive only)
- `compose.ts`: maps staging data through create/interaction via the helpers
- `index.ts`: exports the composer

Rules of the folder:

- placement data never lives here — it belongs in `staging/`
- tap handling only goes through the shared dispatcher, never raw listeners
- every resource a composer creates must be released by the dispose function
  it returns
