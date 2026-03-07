# Performance Improvement Plan

Performance concerns identified during comprehensive code review (March 2026).

---

## Perf 1: ColorMatch renders a dot grid every frame

**Severity:** Medium  
**Affected file:** `games/colorMatch.js`  
**Symptom:** Sluggish frame rate on large screens or low-end devices.

**Status: Fixed**

**Root cause:** The `render()` function draws a dot at every 24px interval across the entire canvas using individual `arc()` + `fill()` calls. On a 1920×1080 screen, that's ~3,600 draw calls per frame, purely for a subtle background texture.

**Fix:**
1. Pre-render the dot pattern to an offscreen `OffscreenCanvas` (or regular canvas) once during `start()`, or when the canvas size changes.
2. In `render()`, draw the cached pattern with a single `ctx.drawImage()` call.

```js
let dotPattern = null

function buildDotPattern(w, h) {
  const c = document.createElement('canvas')
  c.width = w; c.height = h
  const ctx = c.getContext('2d')
  ctx.fillStyle = "rgba(0,0,0,0.018)"
  for (let dx = 0; dx < w; dx += 24) {
    for (let dy = 0; dy < h; dy += 24) {
      ctx.beginPath()
      ctx.arc(dx, dy, 1.2, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  dotPattern = c
}
```

Then in `render()`: `ctx.drawImage(dotPattern, 0, 0)`

**Impact:** Eliminates thousands of draw calls per frame. Significant improvement on mobile.

---

## Perf 2: Unbounded particle/array growth under heavy interaction

**Severity:** Medium  
**Affected files:** `games/elephantSplash.js`, `games/balloonRace.js`, `games/babyShark.js`, `games/feedAnimal.js`, `games/monsterTruck.js`, `games/cleanTheMess.js`  
**Symptom:** Frame drops during sustained heavy tapping/dragging as particle arrays grow large.

**Status: Fixed**

**Root cause:** Particles, sparkles, score popups, hearts, crumbs, spray particles, etc., are pushed into arrays every frame based on `Math.random() < dt * N` checks. While they're filtered by lifetime each frame, under sustained interaction the arrays can grow to hundreds of entries. Each frame creates new objects and filters the arrays (generating GC pressure).

**Fix:**
1. Add a hard cap to each particle array. Before pushing:
   ```js
   if (particles.length < MAX_PARTICLES) particles.push(...)
   ```
   Suggested caps: `particles: 200`, `sparkles: 100`, `scorePopups: 20`, `sprayParticles: 150`.

2. Consider object pooling for the most frequently created particles (spray in elephantSplash, dust in monsterTruck). Pre-allocate a fixed array of particle objects and recycle them instead of creating/GC'ing.

**Impact:** Prevents frame drops during sustained play. Reduces GC pauses.

---

## Perf 3: Web Audio oscillator node accumulation

**Severity:** Low-Medium  
**Affected files:** All game files with sound effects (`bubblePop.js`, `feedAnimal.js`, `colorMatch.js`, `hideAndSeek.js`, `cleanTheMess.js`, `shapeBuilder.js`, `puppyFetch.js`, `babyShark.js`, `elephantSplash.js`, `monsterTruck.js`)  
**Symptom:** In long play sessions, memory slowly grows as disconnected oscillator/gain nodes accumulate before garbage collection.

**Status: Fixed**

**Root cause:** Every sound effect creates `OscillatorNode` + `GainNode` pairs connected to `audioCtx.destination`. After `osc.stop()`, the nodes are no longer active but aren't explicitly disconnected. They rely on GC, which may be delayed.

**Fix:**
1. Explicitly disconnect nodes after they stop:
   ```js
   osc.onended = () => { gain.disconnect(); osc.disconnect() }
   ```
2. Better yet, create a shared sound utility (see Code Quality plan) that handles this automatically.

**Impact:** Cleaner memory profile in long sessions. Prevents theoretical AudioContext resource exhaustion.

---

## Perf 4: Game loop runs continuously when no game is loaded

**Severity:** Low  
**Affected files:** `app.js`, `engine/gameManager.js`  
**Symptom:** Continuous `requestAnimationFrame` calls and `clearRect()` on the game canvas even when the user is on the menu screen and the canvas is hidden behind the playroom UI.

**Status: Fixed**

**Root cause:** `startLoop()` in `app.js` runs unconditionally. `GameManager.render()` always calls `clearRect` regardless of whether a game is loaded.

**Fix:**
Option A — Guard the loop:
```js
startLoop((dt) => {
  if (!gameManager.currentGame) return
  gameManager.update(dt)
  gameManager.render()
})
```

Option B — Start/stop the loop with game load/unload. This is more complex and not needed unless battery life is a major concern.

**Impact:** Eliminates wasted frame work on the menu screen. Minor battery savings on mobile.

---

## Priority Order

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 1 | Perf 1 — Dot grid pre-rendering | 15 min | High on mobile |
| 2 | Perf 2 — Particle array caps | 30 min | Medium, prevents frame drops |
| 3 | Perf 4 — Idle loop guard | 2 min | Low, battery savings |
| 4 | Perf 3 — Oscillator cleanup | 20 min | Low, long-session memory |

Total estimated effort: ~1.5 hours.
