# ADR-008: Game Sound Effects

## Status
Accepted

## Context
Games feel flat without audio feedback. Preschoolers (ages 3-5) rely heavily on sensory feedback to understand cause and effect. Sound effects reinforce successful actions and make games more engaging.

Two games (Bubble Pop, Feed the Animal) already had sound effects using the Web Audio API oscillator approach. The remaining 10 games had no audio feedback beyond the optional music box on the home screen.

## Decision
Add **oscillator-based sound effects** to all 12 games using the Web Audio API. Each game gets sounds tailored to its core mechanic.

### Sound Design Approach
- **Oscillators only** — no audio file dependencies, instant playback, tiny footprint
- **Shared AudioContext** — all games use `window._sharedAudioCtx` to avoid iOS Safari's limit on AudioContext instances
- **iOS compatibility** — each sound function checks for suspended state and calls `resume()` (iOS requires user-gesture-triggered resume)
- **Short durations** — all sound effects are under 300ms to feel snappy and not overlap
- **Frequency-based character** — each game's sounds use distinct frequency ranges and waveforms to feel unique

### Sound Mapping

| Game | Event | Sound Character |
|------|-------|----------------|
| Bubble Pop | Bubble popped | Descending sine, bubbly |
| Feed Animal | Food eaten | Two quick square wave chomps |
| Color Match | Correct match | Bright ascending chime |
| Color Match | Wrong match | Low buzz |
| Fireflies | Firefly caught | Soft twinkling bells |
| Balloon Race | Balloon launched | Rising whoosh |
| Baby Shark | Fish eaten | Quick bite snap |
| Puppy Fetch | Ball thrown | Ascending whistle |
| Puppy Fetch | Ball caught | Happy bark-like chirp |
| Shape Builder | Piece snapped | Satisfying click/snap |
| Shape Builder | Puzzle complete | Ascending fanfare |
| Clean the Mess | Scrub reveal | Squeaky wipe |
| Hide and Seek | Animal found | Surprised chirp |
| Monster Truck | Jump | Engine rev burst |
| Monster Truck | Crush/land | Low impact thud |
| Elephant Splash | Water hit | Splashy noise burst |

### Implementation Pattern
Every game follows the same pattern established by Bubble Pop:

```javascript
let audioCtx

function playSound() {
  if (!audioCtx) audioCtx = window._sharedAudioCtx ||
    (window._sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)())
  if (audioCtx.state === 'suspended') audioCtx.resume()
  const now = audioCtx.currentTime
  // ... oscillator setup and scheduling
}
```

## Consequences

### Positive
- Zero additional network requests (no audio files to load/cache)
- Works offline
- Consistent behavior across browsers (oscillators are universally supported)
- Each game has a distinct audio personality
- Reinforces cause-and-effect for preschoolers

### Negative
- Oscillator sounds are synthetic — they won't sound as rich as recorded samples
- Adding more complex sounds (e.g. voice clips, realistic effects) would require a different approach
- Each game file grows by ~20-40 lines for sound functions

### iOS Notes
- AudioContext must be created/resumed during a user gesture
- The shared context pattern (`window._sharedAudioCtx`) is critical — iOS limits concurrent AudioContext instances
- Oscillator-based sounds work more reliably on iOS than buffer-based noise generation
