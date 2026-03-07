# Minor Nits

Small issues and polish items identified during comprehensive code review (March 2026). None of these are bugs or significant concerns — just cleanup opportunities.

---

## Nit 1: Inconsistent emoji use in game definitions

**Affected file:** `engine/gameManager.js`  
**Detail:** Game metadata (names, shelf labels) uses emoji inconsistently. Some games include emoji in their display names, others don't. This is cosmetic and intentional per the design, but worth noting if you want consistency.

**Action:** Review and standardize if desired. No code fix needed.

---

## Nit 2: Magic numbers throughout game files

**Affected files:** All 12 game files  
**Detail:** Physics constants, timing values, and thresholds are hardcoded inline:
- `0.018` (gravity), `300` (speed), `0.12` (sound duration), `24` (dot spacing), `80` (bounce force)
- These are scattered through `update()` and `render()` functions

**Recommendation:**
Move to named constants at the top of each game file:
```js
const GRAVITY = 0.018
const BOUNCE_FORCE = 80
const DOT_SPACING = 24
```

Not worth a separate refactoring pass — just adopt this pattern when editing a game for other reasons.

---

## Nit 3: Some games use `var`, most use `let`/`const`

**Affected files:** Occasional across game files  
**Detail:** A few stray `var` declarations mixed in with otherwise modern `let`/`const` usage.

**Action:** Replace with `let` or `const` when touching those files. Not worth a dedicated pass.

---

## Nit 4: Trailing whitespace and inconsistent blank lines

**Affected files:** Various  
**Detail:** Some files have trailing whitespace, some have double blank lines between functions, others have single. No formatter is configured.

**Recommendation:**
Add a `.editorconfig` or configure Prettier:
```ini
# .editorconfig
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

**Action:** Low priority. Add config when convenient, don't reformat existing files in bulk (noisy git diff).

---

## Nit 5: `package.json` has no description or license

**Affected file:** `package.json`  
**Detail:** The `description` field is empty and there's no `license` field. Not a problem for a private project, but good practice.

**Action:**
```json
{
  "description": "A collection of HTML5 canvas games for preschoolers",
  "license": "MIT"
}
```

Adjust license as appropriate.

---

## Nit 6: README.md is minimal

**Affected file:** `README.md`  
**Detail:** The README exists but could benefit from:
- How to run locally (`npm install && npm run dev`)
- How to build and deploy (`docker build -t tinytoyboxgames .`)
- Screenshot or demo link
- List of games
- Architecture overview (link to ADRs)

**Action:** Enhance when convenient. Not blocking anything.

---

## Nit 7: Game file naming — camelCase vs kebab-case

**Affected files:** `games/` directory  
**Detail:** All game files use camelCase (`bubblePop.js`, `feedAnimal.js`). This is consistent within the project but differs from common JS conventions where file names are often kebab-case (`bubble-pop.js`). Since `gameManager.js` dynamically imports by name, changing this would require updating the import paths.

**Action:** Leave as-is. Consistency within the project matters more than matching external conventions. The camelCase names match the game IDs used in `GameManager`.

---

## Nit 8: `confetti.min.js` vendored without version tracking

**Affected file:** `public/js/libs/confetti.min.js`  
**Detail:** The confetti library is checked into the repo as a minified file with no indication of which version it is or where it came from. If a bug or security issue is found in the library, there's no easy way to know what version to update from.

**Recommendation:**
Add a comment at the top of the file or a `public/js/libs/README.md`:
```
confetti.min.js - canvas-confetti v1.9.3
Source: https://github.com/catdad/canvas-confetti
```

Alternatively, install via npm and let Vite bundle it:
```bash
npm install canvas-confetti
```
```js
import confetti from 'canvas-confetti'
```

---

## Summary

These are all low-priority cleanup items. The recommended approach is to fix them opportunistically — when you're already editing a file for a bug fix or feature, clean up the nits in that file at the same time. No dedicated nit-fixing pass is needed.

| Nit | Category | Effort |
|-----|----------|--------|
| 1 | Cosmetic | — |
| 2 | Readability | Ongoing |
| 3 | Modernization | Trivial per file |
| 4 | Formatting | 5 min (config only) |
| 5 | Metadata | 1 min |
| 6 | Documentation | 30 min |
| 7 | Naming | No action |
| 8 | Dependency tracking | 5 min |
