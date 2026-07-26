/**
 * Score and combo responses for the generated minigame template.
 *
 * Keeping this logic in a dedicated module makes it obvious where to change
 * the meaning of a successful or missed tap without re-reading the full game
 * lifecycle file.
 */

import type { MiniGameContext } from '../../../framework/types';
import type { TemplateTargetState } from '../types';

/** Number of catches between milestone celebrations. */
const MILESTONE_INTERVAL = 10;

/**
 * Applies the shared-system response for a successful tap.
 *
 * Defect 9: every tenth catch used to fire the whole cabinet in one frame —
 * `confetti()` (which plays `sfx_shared_sparkle_burst`), then an explicit
 * `chime`/`fanfare`, then `milestone()` (which plays its own `fanfare`). Three
 * to four overlapping voices in a single frame is a wall of noise, not a
 * reward, and the loudest moment in the game became the least legible. It is
 * thinned to at most two: a milestone speaks with its own fanfare alone, a
 * routine catch with the burst alone, and only the rarer bonus star adds a
 * second, distinguishing chime on top.
 *
 * @param context - Shell-provided minigame context.
 * @param target - The tapped target.
 * @param canvasX - Tap X relative to the canvas, for milestone placement.
 * @param canvasY - Tap Y relative to the canvas, for milestone placement.
 * @param completedHits - Number of successful hits already completed this run.
 */
export function applySuccessfulTap(context: MiniGameContext, target: TemplateTargetState, canvasX: number, canvasY: number, completedHits: number): void {
  context.combo.registerHit();
  context.score.addPoints(target.points);

  if ((completedHits + 1) % MILESTONE_INTERVAL === 0) {
    // `milestone` already emits the focal burst, a shower across the top of the
    // view, and one fanfare. Nothing else is layered on it.
    context.celebration.milestone(canvasX, canvasY, 'large');
    return;
  }

  // `burstAt` instead of `confetti`: we already know exactly where the star is,
  // so the burst lands on it rather than on an unprojected guess at the finger.
  context.celebration.burstAt(target.mesh.position, target.kind === 'bonus' ? 'medium' : 'small');

  if (target.kind === 'bonus') {
    context.celebration.celebrationSound('chime');
  }
}

/**
 * Applies the shared-system response for a missed tap.
 *
 * A miss is never punished — combos decay naturally via their time window.
 * Every tap still answers with a gentle sound so young players always get
 * feedback (a dead tap is a broken promise).
 *
 * @param context - Shell-provided minigame context.
 */
export function applyMissTap(context: MiniGameContext): void {
  context.audio.playSound('sfx_shared_tap_fallback');
}
