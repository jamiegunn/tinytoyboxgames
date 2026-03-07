# Bug Fix Plan

Bugs identified during comprehensive code review (March 2026).

---

## Bug 1: `globalAlpha` leak in canvas rendering

**Severity:** Medium  
**Affected files:** `games/bubblePop.js`, `games/fireflies.js`, `games/hideAndSeek.js`, `games/cleanTheMess.js`  
**Symptom:** If rendering exits early or errors, `globalAlpha` stays at a non-1.0 value and bleeds into subsequent draw calls (e.g., score text appears semi-transparent).

**Status: Fixed**

**Root cause:** Games set `ctx.globalAlpha = 0.8` (or similar) without wrapping in `ctx.save()`/`ctx.restore()`.

**Fix:**
1. In each affected game's `render()` function, wrap any block that modifies `globalAlpha` with `ctx.save()` before and `ctx.restore()` after.
2. Alternatively, add a defensive `ctx.globalAlpha = 1` reset at the top of `GameManager.render()` in `engine/gameManager.js` as a safety net.

**Validation:** Play each affected game, pop/catch several items rapidly, verify score text and other overlays render at full opacity.

---

## Bug 2: Canvas resize doesn't rebuild game scene objects

**Severity:** Medium  
**Affected files:** `games/hideAndSeek.js`, `games/babyShark.js`, `games/feedAnimal.js`, `games/balloonRace.js`  
**Symptom:** Rotating a phone mid-game causes hiding spots, coral reefs, flowers, and other scene objects to be positioned for the old screen dimensions. They appear off-screen or bunched on one side.

**Status: Fixed**

**Root cause:** Scene objects (spots, corals, grass blades, flowers) are built once in `start()` using the initial `w` and `h`. While `update()` re-reads `ctx.canvas.width/height`, the positions created in `start()` are never recalculated.

**Fix:**
1. Extract scene-building logic into a separate `buildScene(w, h)` function in each game (hideAndSeek already has this pattern).
2. In each game's `update()`, detect when `w` or `h` has changed since last frame. If changed, call `buildScene(w, h)` to regenerate positions.
3. Use percentage-based positioning (e.g., `x: 0.15 * w`) rather than absolute pixel values where possible — hideAndSeek already does this with `xPct`.

**Validation:** Start each game, rotate device from portrait to landscape and back. Verify all scene objects reposition correctly and no elements are off-screen.

---

## Bug 3: First frame has max-clamped `dt`

**Severity:** Low  
**Affected file:** `engine/loop.js`  
**Symptom:** On the very first frame, `last = 0` and `t` is a large DOMHighResTimeStamp (e.g., 14000ms). The delta is clamped to 0.05s (50ms), so particles and objects jump forward by a full 50ms on frame one.

**Status: Fixed**

**Root cause:** `last` is initialized to `0` instead of the current time.

**Fix:**
```js
export function startLoop(update) {
  let last = -1

  function frame(t) {
    if (last < 0) { last = t; requestAnimationFrame(frame); return }
    const dt = Math.min((t - last) / 1000, 0.05)
    last = t
    update(dt)
    requestAnimationFrame(frame)
  }

  requestAnimationFrame(frame)
}
```

This skips the first frame so `last` is properly seeded from the first real timestamp.

**Validation:** Add a `console.log(dt)` temporarily. Verify the first logged dt is a small value (e.g., 0.016) rather than 0.05.

---

## Bug 4: Duplicate music box code

**Severity:** Low (wasteful, not broken)  
**Affected files:** `toybox.html` (inline `<script>` block, ~100 lines), `js/musicbox.js`  
**Symptom:** `window._toyboxMusic` is defined twice — first by the inline script in toybox.html, then overwritten when `js/musicbox.js` loads via the module entry point.

**Status: Fixed**

**Root cause:** The music box logic was duplicated in both locations.

**Fix:**
1. Remove the entire inline `<script>` block in `toybox.html` that defines the music box (lines ~378–450, the IIFE containing `melody`, `bassPattern`, `startMusic`, `stopMusic`, etc.).
2. Keep `js/musicbox.js` as the single source of truth — it's already imported via `js/toybox-entry.js`.
3. Verify the audio-unlock listeners (`click`/`touchstart`) in `musicbox.js` still fire early enough. If needed, add a minimal inline script that just does the AudioContext unlock:
   ```html
   <script>
   document.addEventListener('click', function u() {
     var c = window._sharedAudioCtx;
     if (c && c.state === 'suspended') c.resume();
     document.removeEventListener('click', u);
   });
   </script>
   ```

**Validation:** Open the toybox, tap the music box, confirm it plays. Start a game, confirm game music plays. Return to toybox, confirm music box resumes if it was playing.

---

## Bug 5: No error handling on dynamic game imports

**Severity:** Medium  
**Affected file:** `engine/gameManager.js`  
**Symptom:** If a game ID is invalid or a module fails to load, the `import()` promise rejects unhandled. The menu is already hidden (by `app.js` `startGame`), so the user sees a blank canvas with no way to recover except browser back.

**Status: Fixed**

**Root cause:** No `try/catch` around the dynamic import in `GameManager.load()`.

**Fix:**
```js
async load(id) {
  if (this.currentGame?.destroy)
    this.currentGame.destroy()

  try {
    const module = await import(`../games/${id}.js`)
    this.currentGame = module.default

    this.currentGame.start({
      ctx: this.ctx,
      input: this.input,
      w: this.ctx.canvas.width,
      h: this.ctx.canvas.height
    })
  } catch (err) {
    console.error(`Failed to load game: ${id}`, err)
    this.currentGame = null
    window.goHome()
  }
}
```

**Validation:** Temporarily call `startGame('nonExistentGame')` from the console. Verify it logs an error and returns to the menu instead of hanging on a blank screen.

---

## Bug 6: `textBaseline` not reset in hideAndSeek

**Severity:** Low  
**Affected file:** `games/hideAndSeek.js`  
**Symptom:** `ctx.textBaseline = "top"` is set for score rendering but never reset. If GameManager or other code assumes default baseline (`"alphabetic"`), text positioning could be off.

**Status: Fixed**

**Root cause:** Missing reset after rendering.

**Fix:**
Add `ctx.textBaseline = "alphabetic"` after the score text block, or wrap the score rendering in `ctx.save()`/`ctx.restore()`.

**Validation:** Play hideAndSeek, find a few animals, confirm score text looks correct. Switch to another game and confirm its text isn't misaligned.

---

## Bug 7: Missing `lang` attribute on toybox.html

**Severity:** Low (accessibility)  
**Affected file:** `toybox.html`  
**Symptom:** Screen readers can't determine the page language, hurting accessibility.

**Status: Fixed**

**Fix:**
Change `<html>` to `<html lang="en">`.

**Validation:** Run an accessibility audit (Lighthouse or axe). Confirm the missing-lang warning is gone.

---

## Bug 8: Buddy owl is not keyboard-accessible

**Severity:** Low (accessibility)  
**Affected file:** `toybox.html`  
**Symptom:** The buddy owl is a `<div onclick="buddyTapped()">` — can't be reached or activated via keyboard.

**Status: Fixed**

**Fix:**
Change the buddy element to use `role="button"`, `tabindex="0"`, and add a keyboard handler:
```html
<div class="buddy" id="buddy" onclick="buddyTapped()" 
     role="button" tabindex="0" aria-label="Buddy owl"
     onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();buddyTapped()}">
```

**Validation:** Tab to the buddy owl, press Enter or Space, confirm it triggers the same behavior as tapping.

---

## Priority Order

| Priority | Bug | Effort |
|----------|-----|--------|
| 1 | Bug 5 — Error handling on game imports | 10 min |
| 2 | Bug 1 — globalAlpha leak | 20 min |
| 3 | Bug 3 — First frame dt | 5 min |
| 4 | Bug 4 — Duplicate music box | 15 min |
| 5 | Bug 7 — Missing lang attribute | 1 min |
| 6 | Bug 6 — textBaseline reset | 5 min |
| 7 | Bug 8 — Buddy keyboard access | 5 min |
| 8 | Bug 2 — Resize rebuilds scenes | 1-2 hrs |

Total estimated effort: ~3 hours.
