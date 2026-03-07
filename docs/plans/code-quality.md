# Code Quality Improvement Plan

Code quality and maintainability concerns identified during comprehensive code review (March 2026).

---

## CQ 1: Extract shared sound effect utility

**Severity:** Medium (maintenance burden)  
**Affected files:** All 12 game files  
**Symptom:** Every game has 8–20 lines of near-identical sound effect boilerplate.

**Root cause:** Each game independently initializes `audioCtx`, creates oscillators, sets up gain envelopes, connects nodes, and schedules stop times. The pattern is copy-pasted across all games with minor variations (frequency, waveform type, duration).

**Fix:**
Create `engine/sound.js`:

```js
let audioCtx = null

function getCtx() {
  if (!audioCtx) {
    audioCtx = window._sharedAudioCtx ||
      (window._sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)())
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

export function playTone({ type = 'sine', freq, freqEnd, duration = 0.12, gain = 0.3, delay = 0 }) {
  const ctx = getCtx()
  const now = ctx.currentTime + delay
  const osc = ctx.createOscillator()
  const g = ctx.createGain()

  osc.type = type
  osc.frequency.setValueAtTime(freq, now)
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, now + duration)

  g.gain.setValueAtTime(gain, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + duration)

  osc.connect(g)
  g.connect(ctx.destination)
  osc.start(now)
  osc.stop(now + duration + 0.01)
  osc.onended = () => { g.disconnect(); osc.disconnect() }
}

export function playChord(tones) {
  tones.forEach(t => playTone(t))
}
```

Then game sound effects become one-liners:

```js
// bubblePop
playTone({ freq: 1200 + Math.random() * 400, freqEnd: 300, duration: 0.12, gain: 0.4 })

// feedAnimal (two chomps)
playTone({ type: 'square', freq: 300, freqEnd: 80, duration: 0.07, gain: 0.25 })
playTone({ type: 'square', freq: 280, freqEnd: 80, duration: 0.07, gain: 0.25, delay: 0.1 })
```

**Impact:** Eliminates ~200 lines of duplicated code. Centralizes AudioContext management. Makes adding new sound effects trivial.

---

## CQ 2: Extract shared particle system

**Severity:** Medium  
**Affected files:** `feedAnimal.js`, `colorMatch.js`, `fireflies.js`, `cleanTheMess.js`, `balloonRace.js`, `shapeBuilder.js`, `babyShark.js`, `puppyFetch.js`, `elephantSplash.js`, `monsterTruck.js`  
**Symptom:** Every game has its own particle update/render loop with the same physics (position += velocity * dt, velocity.y += gravity * dt, life -= dt, filter dead).

**Root cause:** Particle system logic was written inline in each game independently.

**Fix:**
Create `engine/particles.js`:

```js
export class ParticleSystem {
  constructor(maxCount = 200) {
    this.particles = []
    this.maxCount = maxCount
  }

  emit(props) {
    if (this.particles.length >= this.maxCount) return
    this.particles.push({
      x: props.x, y: props.y,
      vx: props.vx || 0, vy: props.vy || 0,
      gravity: props.gravity ?? 80,
      size: props.size || 4,
      color: props.color || '#fff',
      life: props.life || 1,
      decay: props.decay || 1,
      rot: props.rot || 0,
      rotSpeed: props.rotSpeed || 0,
      type: props.type || 'circle'
    })
  }

  update(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]
      p.x += p.vx * dt
      p.y += p.vy * dt
      p.vy += p.gravity * dt
      p.rot += p.rotSpeed * dt
      p.life -= dt * p.decay
      if (p.life <= 0) this.particles.splice(i, 1)
    }
  }

  render(ctx) {
    this.particles.forEach(p => {
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.globalAlpha = Math.min(1, p.life * 2)
      ctx.fillStyle = p.color
      if (p.type === 'circle') {
        ctx.beginPath()
        ctx.arc(0, 0, p.size, 0, Math.PI * 2)
        ctx.fill()
      } else {
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size)
      }
      ctx.restore()
    })
  }

  clear() { this.particles.length = 0 }
}
```

Games would then use `const particles = new ParticleSystem(200)` and call `particles.emit(...)`, `particles.update(dt)`, `particles.render(ctx)`.

**Impact:** Removes ~30 lines of duplicated update/filter/render code per game. Built-in max count prevents runaway growth (see Performance plan). Consistent rendering with proper save/restore.

---

## CQ 3: Shared AudioContext initialization is fragile

**Severity:** Low-Medium  
**Affected files:** `engine/gameMusic.js`, `js/musicbox.js`, `toybox.html` (inline), all game files  
**Symptom:** Multiple locations independently check/create `window._sharedAudioCtx`. If initialization order changes or the global is renamed, things break silently.

**Root cause:** No single module owns AudioContext creation. It's done ad-hoc in ~15 places via `window._sharedAudioCtx || (window._sharedAudioCtx = new ...)`.

**Fix:**
Centralize in the proposed `engine/sound.js` (from CQ 1). Export a `getAudioContext()` function. All other code imports it:

```js
import { getAudioContext } from '../engine/sound.js'
```

The music box inline script and `gameMusic.js` would import or call this instead of touching `window._sharedAudioCtx` directly.

**Impact:** Single source of truth for AudioContext. Eliminates the risk of multiple contexts.

---

## CQ 4: Vite config uses CommonJS instead of ESM

**Severity:** Low  
**Affected file:** `vite.config.js`  
**Symptom:** Inconsistency with the rest of the codebase which uses ES modules.

**Root cause:** Config was written with `require()` and `module.exports`.

**Fix:**
```js
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        toybox: resolve(import.meta.dirname, 'toybox.html'),
      },
    },
  },
})
```

Note: `import.meta.dirname` is available in Node 22+ (which the project requires). Alternatively use `fileURLToPath(new URL('.', import.meta.url))`.

**Validation:** Run `npm run build` and confirm it still produces the correct output.

---

## CQ 5: Biased shuffle algorithm in colorMatch

**Severity:** Low  
**Affected file:** `games/colorMatch.js`  
**Symptom:** Color choices are not uniformly distributed.

**Root cause:** `[...arr].sort(() => Math.random() - 0.5)` produces a biased shuffle. Different sort algorithms handle the comparator differently, leading to uneven distributions.

**Fix:**
Use Fisher-Yates shuffle:

```js
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
```

Place in a shared `engine/utils.js` since shuffling could be useful in other games.

**Impact:** Correct uniform distribution. Trivial change.

---

## CQ 6: Buddy owl wraps startGame/goHome via polling

**Severity:** Low  
**Affected file:** `js/buddy.js`  
**Symptom:** A `setInterval(..., 100)` polls until `window.startGame` exists, then wraps it. This is a race condition with module loading.

**Root cause:** `buddy.js` needs to intercept `startGame` and `goHome` but they're defined in `app.js`, which loads as a module. The polling is a workaround for not having explicit import/export coordination.

**Fix:**
Use a custom event pattern instead:

In `app.js`:
```js
window.startGame = (id) => {
  window.dispatchEvent(new CustomEvent('game:start', { detail: { id } }))
  // ... existing logic
}

window.goHome = () => {
  window.dispatchEvent(new CustomEvent('game:home'))
  // ... existing logic
}
```

In `buddy.js`:
```js
window.addEventListener('game:start', () => {
  buddy.style.display = 'none'
  // ... hide buddy logic
})

window.addEventListener('game:home', () => {
  buddy.style.display = ''
  // ... show buddy logic
})
```

This eliminates the polling entirely and decouples buddy from the function reference timing.

**Impact:** Cleaner architecture. No polling. No race conditions.

---

## CQ 7: Monolithic game files

**Severity:** Low (long-term maintainability)  
**Affected files:** `elephantSplash.js` (1916 lines), `puppyFetch.js` (1276 lines), `babyShark.js` (1255 lines), `feedAnimal.js` (1205 lines), `monsterTruck.js` (1123 lines), `cleanTheMess.js` (1109 lines)  
**Symptom:** Difficult to navigate, review, and modify individual game files.

**Root cause:** Each game contains drawing code, physics, input handling, sound effects, scene generation, and game logic in a single file.

**Recommendation:**
After extracting shared utilities (CQ 1, CQ 2, CQ 5), each game would naturally shrink by ~100-200 lines. Beyond that, consider splitting only the largest games into:
- `games/elephantSplash/index.js` — game logic
- `games/elephantSplash/draw.js` — drawing functions
- `games/elephantSplash/scene.js` — scene generation

This is lower priority since the games are self-contained and don't change often.

**Impact:** Better readability. Easier to add new games by copying a simpler template.

---

## Priority Order

| Priority | Issue | Effort | Impact |
|----------|-------|--------|--------|
| 1 | CQ 1 — Shared sound utility | 1 hr | High — eliminates ~200 lines across 12 files |
| 2 | CQ 2 — Shared particle system | 1.5 hr | High — eliminates ~300 lines, built-in caps |
| 3 | CQ 3 — Centralize AudioContext | 30 min | Medium — done as part of CQ 1 |
| 4 | CQ 5 — Fisher-Yates shuffle | 10 min | Low — correctness |
| 5 | CQ 4 — Vite config ESM | 5 min | Low — consistency |
| 6 | CQ 6 — Buddy event pattern | 20 min | Low — cleaner architecture |
| 7 | CQ 7 — Split large game files | 2-3 hrs | Low — only if games are actively edited |

Total estimated effort: ~6 hours (excluding CQ 7).
