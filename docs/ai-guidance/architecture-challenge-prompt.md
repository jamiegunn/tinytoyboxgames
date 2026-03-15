# Architecture Challenge Prompt

Use this prompt to aggressively challenge the recursive scene hierarchy before implementation.

```text
Act as a skeptical principal engineer and systems architect.

You are reviewing a proposed content architecture for a browser-based 3D product.

Current proposed model:

- Every camera-enterable destination above minigames is a scene.
- Hierarchy:
  - World
  - Place
  - optional Sub-place
  - literal Toybox object
  - immersive Toybox scene
  - 0-n minigames
- the owl companion appears in every navigable non-minigame scene
- Examples:
  - World -> House -> Playroom -> Toybox -> Nature -> minigames
  - World -> Park -> Jungle Gym -> Toybox -> immersive scene -> minigames
- Toyboxes are literal in-world objects and each opens exactly one immersive scene.
- Minigames are play modes, not navigable scenes.
- Minigame implementations stay in shared global folders, while immersive scenes own local wrappers/manifests.
- Target goal is a structure that is scalable, understandable, and easy for LLMs to inspect.

Your job is not to help it pass. Your job is to break it.

Required output:

1. Restate the proposed model in your own words.
2. List the 10 strongest objections, ordered by severity.
3. Identify naming failures, metaphor collisions, and places where the taxonomy will confuse engineers.
4. Identify where the filesystem hierarchy will become awkward or too deep.
5. Identify hidden migration costs in code, routing, typing, tooling, docs, and tests.
6. Identify edge cases the model handles poorly, including:
   - places with no sub-place
   - places with multiple toyboxes
   - multiple toyboxes that want to open the same immersive scene
   - immersive scenes with zero minigames
   - scenes where the owl has nowhere natural to live or risks becoming visually intrusive
   - future areas that do not fit the "house room" metaphor
7. Compare it against at least 2 alternative models and explain what those alternatives do better.
8. State which parts of the proposal are actually strong and should probably survive.
9. Give a blunt go / no-go recommendation.
10. If you recommend changes, propose the smallest change set that fixes the most serious weaknesses.

Rules:

- Be adversarial but technically precise.
- Do not accept the metaphor at face value.
- Prefer structural arguments over aesthetic ones.
- Treat "easy for an LLM" as a real requirement, but not a trump card.
- Call out any part of the proposal that looks like a rename exercise rather than a genuine architectural improvement.
- Challenge whether the owl belongs in the shared scene scaffold or whether that rule creates avoidable coupling.
```
