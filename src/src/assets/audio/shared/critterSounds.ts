/**
 * Shared small-creature sound effects.
 *
 * WHY THIS FILE EXISTS AND WHY IT IS `shared/` RATHER THAN `hub/`.
 * `playSfxSharedCritterScurry` was authored in `hub/hubSfx.ts` as
 * `playSfxHubAmbientScurry` and registered as `sfx_hub_ambient_scurry`, and in
 * that whole time it was called exactly zero times — the hub's ambient critters
 * never asked for it. Round 5 of `docs/reviews/2026-07-30-rooms-five-rounds.md`
 * needed "small creature feet" twice, for the ladybug under a Nature leaf and
 * the grub under a Nature stone, and the sound already existed and was already
 * right.
 *
 * The rename is the cheap part of that and the honest part. Prefixes in this
 * registry say which bank a cue was authored in, and readers use them to guess
 * where a cue is heard; leaving a `hub_` prefix on a cue whose only two callers
 * are in the forest would have planted exactly the kind of misleading source
 * this review keeps finding. It was safe to rename because it was provably
 * unreferenced: a grep across `.ts`, `.tsx`, `.mjs` and `.md` returned the
 * registry line and nothing else. The hub can still call it — that is what
 * `shared/` means — and `sfx_hub_ambient_hop`, its equally stranded neighbour,
 * is deliberately left alone because nothing yet needs it and moving it would
 * be churn with no caller to justify it.
 *
 * All sounds are procedurally generated via Web Audio — no audio files.
 */

import { playFilteredNoiseBurst, pick, rand } from '@app/assets/audio/utils/synthHelpers';

/** Minimum fade-in time in seconds to avoid clicks (per spec). */
const MIN_ATTACK_S = 0.005;

/**
 * Plays a whimsical tiny scurry sound (like small creature feet).
 * Duration: ~0.5-0.9s. Five to eight bursts of high-frequency filtered noise
 * with a rapid on-off envelope pattern, so no two runs have the same footfall
 * count or spacing.
 *
 * Unchanged from the implementation authored in `hub/hubSfx.ts`; only its name
 * and location moved. Deliberately not retuned in the same commit that gave it
 * its first callers — if the forest's two reveals want a different gait, that
 * is a change to argue on its own evidence rather than smuggle into a move.
 *
 * @param ctx - The Web Audio context
 * @param dest - The destination AudioNode to connect output to
 */
export function playSfxSharedCritterScurry(ctx: AudioContext, dest: AudioNode): void {
  const now = ctx.currentTime;

  // Create a rapid series of tiny noise bursts to simulate scurrying feet
  const burstCount = pick([5, 6, 7, 8]);
  const totalDuration = rand(0.5, 0.9);
  const burstSpacing = totalDuration / burstCount;

  for (let i = 0; i < burstCount; i++) {
    const burstFreq = rand(3000, 5000);
    const burstTime = now + i * burstSpacing;
    const burstAttack = MIN_ATTACK_S;
    const burstRelease = burstSpacing * 0.5;
    const burstGain = rand(0.06, 0.12);

    playFilteredNoiseBurst(ctx, dest, burstFreq, 3, burstAttack, burstRelease, burstGain, burstTime);
  }
}
