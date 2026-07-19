# staging/

Data-only placement records for __SCENE_DISPLAY_NAME__ prop families.

Staging answers "where and how many" for every prop family; the matching
`factory/props/` folder answers "what it looks like and what it does". Keeping
those apart means placement can be retuned without touching mesh code, and
prop code can be rewritten without losing authored placement.

- `sampleSimple.ts`: placements for the sample static prop family
- `sampleInteractive.ts`: placements for the sample tappable prop family

Rules of the folder:

- staging files export immutable, typed arrays of plain records — no Three.js
  objects, no side effects, no imports from `factory/`
- one staging file per prop family, named to match its prop folder
- when the sample props graduate out of the scene, delete their staging files
  in the same change
