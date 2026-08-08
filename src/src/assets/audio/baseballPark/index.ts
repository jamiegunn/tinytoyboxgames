/**
 * Baseball Park procedural audio modules.
 * All sounds are generated via Web Audio synthesis — no audio files.
 * Themed around a sunny toy ballpark: a bouncy organ, a soft open-air crowd,
 * and the two sounds the field's props answer with.
 */

import { playTone, playFilteredNoiseBurst, playFreqSweep, createPinkNoiseBuffer, midiToFreq, pentatonicScale } from '@app/assets/audio/utils/synthHelpers';
import { startAudioLoop } from '@app/assets/audio/utils/loopScheduler';

// C major pentatonic starting at C4 (MIDI 60), the same root every reward
// sound is quantized to (`shared/rewardSounds.ts` uses pentatonicScale(84) =
// C6). Nature's bed learned this the hard way — it shipped in D and its F#
// clashed with every chime in the app; audio-standards.md rule 6 exists to
// prevent exactly that, so this bed starts life in C rather than being moved
// there later.
const C_PENTA = pentatonicScale(60);

/**
 * Plays a bright, bouncy ballpark-organ background for the Baseball Park.
 *
 * The reference is the stadium organ between innings, shrunk to toy size: an
 * oom-pah bass alternating root and fifth, and a short rising organ figure —
 * stated, then answered — in C major pentatonic. Square waves at low gain give
 * the reedy organ colour without any of the brashness of the real thing.
 * ~96bpm, loops with an exact seam derived from the scheduled content.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 * @returns A stop function that halts playback and cleans up resources
 */
export function playMusBaseballParkBackground(ctx: AudioContext, dest: AudioNode): () => void {
  const bpm = 96;
  const beatDur = 60 / bpm;

  // Two four-beat phrases: the rising "call" every ballpark knows the shape
  // of, then a falling "answer" that lands back on the root. Degrees index
  // into C_PENTA; rhythm is in beats.
  const call = { degrees: [0, 1, 2, 4], rhythm: [1, 1, 1, 1] };
  const answer = { degrees: [4, 3, 2, 0], rhythm: [1, 1, 1, 1] };
  const phrases = [call, answer, call, { degrees: [2, 1, 0], rhythm: [1, 1, 2] }];

  const cycleSeconds = phrases.reduce((sum, p) => sum + p.rhythm.reduce((s, r) => s + r * beatDur, 0), 0);

  const scheduleCycle = (startTime: number) => {
    // Oom-pah bass: root on the beat, fifth on the off-beat, triangle for a
    // soft tuba-like foundation.
    const beats = Math.round(cycleSeconds / beatDur);
    for (let beat = 0; beat < beats; beat += 1) {
      const midi = beat % 2 === 0 ? C_PENTA[0] - 24 : C_PENTA[0] - 17;
      playTone(ctx, dest, 'triangle', midiToFreq(midi), 0.01, beatDur * 0.55, 0.09, startTime + beat * beatDur);
    }

    // Organ melody: square fundamental for the reed colour, sine an octave up
    // for the shine, both under gentle gains.
    let offset = 0;
    for (const phrase of phrases) {
      for (let i = 0; i < phrase.degrees.length; i += 1) {
        const noteTime = startTime + offset;
        const freq = midiToFreq(C_PENTA[phrase.degrees[i] % C_PENTA.length]);
        const noteDur = beatDur * phrase.rhythm[i];
        playTone(ctx, dest, 'square', freq, 0.015, noteDur * 0.6, 0.045, noteTime);
        playTone(ctx, dest, 'sine', freq * 2, 0.02, noteDur * 0.5, 0.05, noteTime);
        offset += noteDur;
      }
    }
  };

  return startAudioLoop(ctx, cycleSeconds, scheduleCycle);
}

/**
 * Plays a soft open-air ambient bed for the Baseball Park.
 *
 * Two layers: a low-passed pink-noise breeze with a slow LFO so the air moves,
 * and a band-passed murmur around 900 Hz that swells and recedes like a small,
 * far-away crowd. Both sit well under the music — this is the sound of being
 * outdoors, not of being at a stadium.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 * @returns A stop function that halts playback and cleans up resources
 */
export function playAmbBaseballParkCrowd(ctx: AudioContext, dest: AudioNode): () => void {
  const bufferDuration = 4;

  // Layer 1: breeze — pink noise through a gentle lowpass.
  const breezeSource = ctx.createBufferSource();
  breezeSource.buffer = createPinkNoiseBuffer(ctx, bufferDuration);
  breezeSource.loop = true;

  const breezeLp = ctx.createBiquadFilter();
  breezeLp.type = 'lowpass';
  breezeLp.frequency.value = 420;
  breezeLp.Q.value = 0.4;

  const breezeGain = ctx.createGain();
  breezeGain.gain.value = 0.07;

  breezeSource.connect(breezeLp).connect(breezeGain).connect(dest);

  // Slow LFO so the breeze breathes instead of hissing at one level.
  const breezeLfo = ctx.createOscillator();
  breezeLfo.type = 'sine';
  breezeLfo.frequency.value = 0.11;
  const breezeLfoGain = ctx.createGain();
  breezeLfoGain.gain.value = 0.025;
  breezeLfo.connect(breezeLfoGain).connect(breezeGain.gain);

  // Layer 2: distant crowd murmur — band-passed pink noise with its own,
  // slightly faster swell so the two layers never move in lockstep.
  const murmurSource = ctx.createBufferSource();
  murmurSource.buffer = createPinkNoiseBuffer(ctx, bufferDuration);
  murmurSource.loop = true;

  const murmurBp = ctx.createBiquadFilter();
  murmurBp.type = 'bandpass';
  murmurBp.frequency.value = 900;
  murmurBp.Q.value = 1.2;

  const murmurGain = ctx.createGain();
  murmurGain.gain.value = 0.03;

  const murmurLfo = ctx.createOscillator();
  murmurLfo.type = 'sine';
  murmurLfo.frequency.value = 0.07;
  const murmurLfoGain = ctx.createGain();
  murmurLfoGain.gain.value = 0.018;
  murmurLfo.connect(murmurLfoGain).connect(murmurGain.gain);

  murmurSource.connect(murmurBp).connect(murmurGain).connect(dest);

  breezeSource.start();
  breezeLfo.start();
  murmurSource.start();
  murmurLfo.start();

  return () => {
    breezeSource.stop();
    breezeLfo.stop();
    murmurSource.stop();
    murmurLfo.stop();
    breezeSource.disconnect();
    breezeLfo.disconnect();
    murmurSource.disconnect();
    murmurLfo.disconnect();
    breezeLp.disconnect();
    breezeGain.disconnect();
    breezeLfoGain.disconnect();
    murmurBp.disconnect();
    murmurGain.disconnect();
    murmurLfoGain.disconnect();
  };
}

/**
 * Plays the batting tee's pop-fly: a quick upward whistle with a soft pop at
 * the start, the sound of a ball leaving the tee and sailing up.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxBaseballTeePop(ctx: AudioContext, dest: AudioNode): void {
  const t = ctx.currentTime;
  // The contact: a short, round pop.
  playFilteredNoiseBurst(ctx, dest, 700, 2.5, 0.005, 0.07, 0.22, t);
  // The flight: a rising whistle that thins out as it climbs.
  playFreqSweep(ctx, dest, 'sine', 320, 980, 0.01, 0.32, 0.16, t + 0.03);
}

/**
 * Plays a loose ball's rubbery bounce: a falling sine boing with a softer
 * second bounce, distinct from Nature's mushroom (which rises on re-trigger).
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxBaseballBallBounce(ctx: AudioContext, dest: AudioNode): void {
  const t = ctx.currentTime;
  playFreqSweep(ctx, dest, 'sine', 520, 190, 0.005, 0.16, 0.2, t);
  playFreqSweep(ctx, dest, 'sine', 430, 210, 0.005, 0.1, 0.11, t + 0.18);
}
