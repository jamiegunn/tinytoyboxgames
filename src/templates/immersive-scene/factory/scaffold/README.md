# factory/scaffold/

Stage-setting structure for __SCENE_DISPLAY_NAME__.

Scaffold pieces establish the "inside a toybox" feeling before any authored
prop is placed. They are structural, non-interactive, and built once during
scene creation.

- `sceneShell/`: the enclosing walls around the play space
- `skyBackdrop/`: the flat painted sky plane behind the scene

Scaffold versus props: if the player would call it part of the room or the
horizon, it is scaffold; if the player would call it a thing in the scene, it
is a prop and belongs in `../props/`.

Rules of the folder:

- scaffold reads its dimensions from `environment.ts` config and shared
  materials from `materials.ts` — no local palette forks
- scaffold never registers interactions and never owns gameplay state
