# UX & Accessibility Improvement Plan

UX and accessibility concerns identified during comprehensive code review (March 2026).

---

## UX 1: Missing `lang` attribute on toybox.html

**Severity:** High (accessibility)  
**Affected file:** `toybox.html`  
**Symptom:** Screen readers cannot determine the page language, leading to incorrect pronunciation of all text content.

**Status: Fixed**

**Root cause:** The `<html>` tag in `toybox.html` has no `lang` attribute. `index.html` already has `lang="en"`.

**Fix:**
```html
<html lang="en">
```

**Impact:** WCAG 2.1 Level A requirement (Success Criterion 3.1.1). Single-character fix.

---

## UX 2: Buddy owl is not keyboard-accessible

**Severity:** Medium (accessibility)  
**Affected file:** `js/buddy.js`  
**Symptom:** The buddy owl helper character (bottom-right floating element) cannot be activated via keyboard. Users relying on keyboard navigation cannot interact with it.

**Status: Fixed**

**Root cause:** The buddy is a `<div>` with only click/touch event listeners. It has no `tabindex`, `role`, or `keydown` handler.

**Fix:**
```js
buddy.setAttribute('tabindex', '0')
buddy.setAttribute('role', 'button')
buddy.setAttribute('aria-label', 'Buddy owl helper')

buddy.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    // trigger same action as click
    buddy.click()
  }
})
```

Also add a visible focus style in CSS:
```css
#buddy:focus-visible {
  outline: 3px solid #FFD700;
  outline-offset: 2px;
  border-radius: 50%;
}
```

**Impact:** Makes the buddy usable for keyboard-only users. WCAG 2.1 Level A (2.1.1 Keyboard).

---

## UX 3: Canvas games are completely inaccessible to screen readers

**Severity:** Medium (accessibility — long-term)  
**Affected files:** All 12 game files, `toybox.html`  
**Symptom:** Once a game starts, the entire experience is a `<canvas>` element with no text alternatives. Screen readers see nothing.

**Status: Fixed**

**Root cause:** Canvas-based games are inherently visual. No ARIA live regions, no alternative text, no audio descriptions.

**Recommendation:**
This is a fundamental limitation of canvas games and a full fix is out of scope. However, there are incremental improvements:

1. **Add `role="img"` and dynamic `aria-label` to the canvas:**
   ```js
   canvas.setAttribute('role', 'img')
   canvas.setAttribute('aria-label', 'Bubble Pop game — tap bubbles to pop them')
   ```

2. **Use ARIA live regions for score announcements:**
   ```html
   <div id="game-status" role="status" aria-live="polite" class="sr-only"></div>
   ```
   Update when game state changes (score, level complete, etc.).

3. **Add screen-reader-only CSS class:**
   ```css
   .sr-only {
     position: absolute;
     width: 1px; height: 1px;
     padding: 0; margin: -1px;
     overflow: hidden;
     clip: rect(0,0,0,0);
     border: 0;
   }
   ```

**Impact:** Won't make games fully playable via screen reader, but provides basic context. Reasonable accommodation for a visual game platform targeting preschoolers.

---

## UX 4: No reduced-motion support

**Severity:** Medium (accessibility)  
**Affected files:** All 12 game files, `engine/celebrate.js`, `js/buddy.js`  
**Symptom:** Users with vestibular disorders who set `prefers-reduced-motion: reduce` in their OS still see all animations, particles, confetti, and screen shaking.

**Status: Fixed**

**Root cause:** No code checks the `prefers-reduced-motion` media query.

**Fix:**
Create a shared utility:
```js
// engine/motion.js
export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export function shouldAnimate() {
  return !prefersReducedMotion.matches
}
```

Then guard animations:
```js
import { shouldAnimate } from '../engine/motion.js'

// In celebrate.js
if (shouldAnimate()) {
  confetti({ particleCount: 100 })
} else {
  // show a static "Well done!" message instead
}

// In games — skip particle effects
if (shouldAnimate()) {
  particles.push({ ... })
}
```

**Impact:** WCAG 2.1 Level AAA (2.3.3 Animation from Interactions). Good practice even if not targeting AAA compliance.

---

## UX 5: Touch targets may be too small on some games

**Severity:** Low-Medium  
**Affected files:** `games/colorMatch.js`, `games/hideAndSeek.js`, `games/shapeBuilder.js`  
**Symptom:** Some interactive elements (color swatches, hidden animals, shape pieces) may be difficult for preschoolers to tap accurately on small screens.

**Status: Fixed**

**Root cause:** Target sizes are calculated relative to canvas dimensions but don't enforce a minimum pixel size. On a 320px-wide phone screen, some targets can fall below the recommended 44×44px minimum (WCAG 2.5.5).

**Fix:**
Add minimum size enforcement when generating interactive elements:
```js
const targetSize = Math.max(44, calculatedSize)
```

For games with many small targets, consider reducing the number of targets on small screens rather than shrinking them:
```js
const itemCount = canvas.width < 500 ? 3 : 5
```

**Impact:** Better usability for the target audience (2-5 year olds with developing motor skills). Aligns with ADR-004 preschool UX principles.

---

## UX 6: No visual feedback for game loading

**Severity:** Low  
**Affected file:** `engine/gameManager.js`, `app.js`  
**Symptom:** When a game is tapped on the toy shelf, there's no loading indicator. The dynamic import may take a moment on slow connections, leaving the user with a blank canvas.

**Status: Fixed**

**Root cause:** `startGame()` uses `await import(...)` but shows nothing during the load.

**Fix:**
Show a simple loading state on the canvas while the game module loads:
```js
async startGame(id) {
  // Show loading state immediately
  const ctx = this.canvas.getContext('2d')
  ctx.fillStyle = '#2c1654'
  ctx.fillRect(0, 0, this.canvas.width, this.canvas.height)
  ctx.fillStyle = '#fff'
  ctx.font = '24px sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('Loading...', this.canvas.width / 2, this.canvas.height / 2)

  // Then load the game module
  const mod = await import(`../games/${id}.js`)
  // ... continue with start
}
```

**Impact:** Better perceived performance. Eliminates "is it broken?" moment on slower connections.

---

## UX 7: Home/back button is small and hard to discover

**Severity:** Low  
**Affected file:** `toybox.html`, `css/playroom.css`  
**Symptom:** The home button during gameplay may be hard for preschoolers to find and tap.

**Status: Fixed**

**Root cause:** Per ADR-004, the UI should prioritize large, obvious controls. The home button implementation exists but its discoverability for very young users could be improved.

**Recommendation:**
1. Ensure the home button is at least 48×48px
2. Use a recognizable icon (house) with bright contrasting colors
3. Consider adding a subtle pulse animation on first appearance to draw attention
4. Position consistently in the top-left corner across all games

**Impact:** Aligns with ADR-004 preschool UX principles. Prevents "stuck in game" scenarios.

---

## Priority Order

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 1 | UX 1 — Add lang attribute | 1 min | High — WCAG Level A |
| 2 | UX 2 — Buddy keyboard access | 15 min | Medium — WCAG Level A |
| 3 | UX 6 — Loading indicator | 10 min | Medium — perceived perf |
| 4 | UX 4 — Reduced motion support | 30 min | Medium — accessibility |
| 5 | UX 5 — Touch target minimums | 20 min | Low-Medium — usability |
| 6 | UX 3 — Canvas ARIA basics | 30 min | Medium — partial a11y |
| 7 | UX 7 — Home button visibility | 15 min | Low — discoverability |

Total estimated effort: ~2 hours.
