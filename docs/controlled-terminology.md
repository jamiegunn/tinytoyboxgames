# Controlled Terminology

Use these terms consistently across specs, prompts, ADRs, reviews, and implementation planning. If a document uses a conflicting term, this file wins.

## Canonical Terms

| Canonical term                     | Definition                                                                                                                             | Replace / avoid                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Whimsical Toybox World**         | The overall product and documentation program.                                                                                         | shelf product, shipped shelf baseline                      |
| **World scene**                    | The top-level navigable scene that links to major places such as House, Backyard, and Park.                                            | app root scene, top menu scene                             |
| **Place scene**                    | A major navigable destination under the World scene, such as House, Backyard, or Park.                                                 | world when a place is meant                                |
| **Sub-place scene**                | An optional navigable scene nested inside a place, such as Playroom, Kitchen, or Jungle Gym.                                           | local hub, room hub                                        |
| **Playroom**                       | The current room destination inside House. Use `hub` only when explicitly referring to the historical implementation path or scene id. | Playroom Hub as a current architecture term, launcher room |
| **Toybox**                         | A literal in-scene object that opens exactly one immersive scene.                                                                      | portal chest, launcher                                     |
| **Toybox immersive scene**         | The immersive scene opened from a toybox, such as Nature.                                                                              | toybox interior world, standalone level                    |
| **Minigame**                       | A play-mode experience launched from an immersive scene. It is not a navigable scene.                                                  | toybox mini-game, standalone app                           |
| **Shared owl companion**           | The recurring owl character that appears in every navigable non-minigame scene.                                                        | hub-only owl, optional owl                                 |
| **Procedural asset module**        | A TypeScript mesh/material factory module that creates art at runtime.                                                                 | GLB asset, external art file, binary asset pipeline        |
| **Procedural audio module**        | A TypeScript audio module that synthesizes or orchestrates sound at runtime.                                                           | shipped MP3/OGG library                                    |
| **Runtime synthesis**              | The preferred current audio behavior: generate sound at runtime from code.                                                             | pre-rendered audio pipeline as default                     |
| **Storage guard bootstrap module** | The root bootstrap module imported before React loads that blocks browser persistence APIs.                                            | `StorageGuard` React component as the canonical mechanism  |
| **First-tap fallback**             | The required immediate response when the first tap in a scene hits a non-interactive area.                                             | dead tap                                                   |
| **Tap and drag**                   | The supported single-pointer interaction family. Tap remains primary; drag is supported where a scene or minigame requires it.         | tap only                                                   |
| **Online-only**                    | The product requires network delivery and does not promise offline operation.                                                          | offline-capable baseline                                   |

## Historical Mapping

Use these mappings whenever older docs or code paths must be referenced:

| Historical term           | Canonical term now                                                                              |
| ------------------------- | ----------------------------------------------------------------------------------------------- |
| `hub`, **Playroom Hub**   | **Playroom** as the product term, or the historical `hub` scene id when discussing current code |
| `naturescene`             | **Nature** toybox immersive scene                                                               |
| **Toybox Interior World** | **Toybox immersive scene**                                                                      |
| **Toybox mini-game**      | **Minigame**                                                                                    |

## Controlled Naming Rules

1. Use **World scene**, **Place scene**, **Sub-place scene**, **Toybox**, **Toybox immersive scene**, and **Minigame** when describing architecture.
2. Use **Playroom** for the current room destination. Use **hub** only when explicitly referring to the existing implementation, file path, or scene id during migration.
3. Use **Nature** for the immersive toybox scene. Use **naturescene** only when explicitly referring to the existing implementation path during migration.
4. Use **shared owl companion** when describing owl behavior across scenes.
5. Use **procedural asset module** and **procedural audio module** when describing asset delivery.
6. Use **storage guard bootstrap module** when describing persistence enforcement.
7. Use **Phase 1** and **Phase 3** for canonical spec layers. Treat **Phase 0** and **Phase 2** as prompt scaffolding unless explicitly discussing history.

## Enforcement Rule

Every prompt, spec, ADR, README, and feature doc that introduces product structure, architecture, or scope must either:

- use the canonical terms from this file directly, or
- explicitly state that an older term is historical and map it to the canonical term.
