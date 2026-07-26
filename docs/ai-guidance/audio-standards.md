# Audio Standards

This document defines the music and sound rules for Tiny Toybox Games. It is
normative: the music-coverage contract test (`src/tests/audio/music-coverage.test.mjs`)
enforces the coverage rules, and reviewers should hold new audio to the
quality bar below.

## The coverage rule

**Every scene and every minigame ships its own music bed. No exceptions.**

- Every entry in `sceneCatalog.ts` declares `audio: { musicId, ambientId }`
  with non-empty ids registered in the audio registries. `audio: null` is not
  allowed.
- Every entry in `MiniGameManifest.ts` declares a `musicId` registered in
  `MUSIC_REGISTRY`. The MiniGameShell starts it automatically when the game
  starts — games do not (and should not) call `playMusic` themselves.
- The scene's beds fade out when a game opens and resume when it exits
  (handled by SceneFrame). Each game owns its own soundstage.
- The minigame generator emits `musicId: 'mus_shared_music_box'` so a freshly
  generated game is compliant from its first run. Composing a bespoke track is
  part of finishing a game, the same way replacing sample props is.

## The quality bar

The reference track is the hub music box (`hub/hubMusic.ts`). Every bed must
meet the same bar — "a few notes in a row" is not a music bed. Concretely:

1. **Three layers.** A melody voice, a harmony layer (pad chords or chord
   dabs with real voicings), and a bass foundation. A layer may *rest* for
   whole cycles (that's arrangement), but it must exist.
2. **Phrase structure with a cadence.** Real tunes have shape — statement,
   answer, and an ending that resolves (leading tone to home, V to I). A loop
   that never cadences never feels finished.
3. **Humanized, characterful timbre.** Use the shared instruments in
   `utils/instruments.ts` (music box, pad, bass, concertina, marimba) or
   build a new instrument with the same care: layered partials, per-note
   velocity variation, no bare sine "test tones".
4. **Sample-accurate looping.** All beds schedule through
   `utils/loopScheduler.ts` against the audio clock. Never `setInterval`
   against the wall clock — it drifts and stutters in background tabs.
5. **Variation over time.** Loops must breathe: drop or add a layer on
   alternate cycles, alternate an answering phrase, vary velocity. A bed that
   repeats identically every cycle fatigues small ears fast.
6. **One musical family.** Everything lives in the C-major/pentatonic family
   so the shared reward sounds (sparkles, chimes, celebration SFX — all
   quantized to C) always land in key, in every scene and game.
7. **Mix discipline.** Beds route through the music bus (which carries the
   shared reverb send and sits under the master compressor). Melody peak
   gains ~0.07-0.13, pads ~0.03-0.05 per voice, bass ~0.04-0.06. Music
   supports play; it never competes with interaction feedback.

## Current beds

| Track id | Where | Character |
|---|---|---|
| `mus_hub_background` | Playroom | Music-box lullaby, AABA, I-vi-IV-V |
| `mus_kitchen_background` | Kitchen | "Teatime Waltz", 3/4 oom-pah-pah |
| `mus_living_room_background` | Living Room | "Hearthside", slow 4/4 by the fire |
| `mus_nature_background` | Nature | Pentatonic flute over root-fifth drone |
| `mus_pirate_cove_background` | Pirate Cove | 6/8 concertina shore tune |
| `mus_bubble_pop_background` | Bubble Pop | Night lullaby, seventh-chord pads |
| `mus_fireflies_background` | Fireflies | "Firefly Nocturne", sparse and dark |
| `mus_little_shark_background` | Little Shark | Underwater pad + marimba motif |
| `mus_star_catcher_background` | Star Catcher | "Starlight Ostinato" |
| `mus_cannonball_splash_background` | Cannonball Splash | "Deck Dance", 6/8 jig |
| `mus_shared_music_box` | Generated-game default | Alias of the hub lullaby |

## Sound effects

- Every player action gets an audible acknowledgment — a dead tap is a broken
  promise, and a silent tap is half of one.
- Reward sounds are quantized to the C-pentatonic family (see
  `shared/rewardSounds.ts`), never random frequencies.
- Attack times respect a 5 ms minimum (no startle transients); effective
  peaks stay gentle — the master compressor is a safety net, not a mixer.
- New sound ids must be registered in `assets/audio/index.ts`; the
  AudioProvider warns on unknown ids in dev builds. If you hear silence where
  a sound should be, check the console first.
