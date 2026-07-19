/**
 * Score and combo responses for the generated minigame template.
 *
 * Keeping this logic in a dedicated module makes it obvious where to change
 * the meaning of a successful or missed tap without re-reading the full game
 * lifecycle file.
 */

import type { MiniGameContext } from '../../../framework/types';
import type { TemplateTargetState } from '../types';

/**
 * Applies the shared-system response for a successful tap.
 *
 * @param context - Shell-provided minigame context.
 * @param target - The tapped target.
 * @param screenX - Tap X position for celebration placement.
 * @param screenY - Tap Y position for celebration placement.
 * @param completedHits - Number of successful hits already completed this run.
 */
export function applySuccessfulTap(context: MiniGameContext, target: TemplateTargetState, screenX: number, screenY: number, completedHits: number): void {
  context.combo.registerHit();
  context.score.addPoints(target.points);
  context.celebration.confetti(screenX, screenY, target.kind === 'bonus' ? 'medium' : 'small');
  context.celebration.celebrationSound(target.kind === 'bonus' ? 'fanfare' : 'chime');

  if ((completedHits + 1) % 10 === 0) {
    context.celebration.milestone(screenX, screenY, 'medium');
  }
}

/**
 * Applies the shared-system response for a missed tap.
 *
 * A miss is never punished — the design philosophy forbids punitive
 * mechanics, so combos decay naturally via their time window instead of
 * being broken by a miss. Every tap still answers with a gentle sound so
 * young players always get feedback (a dead tap is a broken promise).
 *
 * @param context - Shell-provided minigame context.
 */
export function applyMissTap(context: MiniGameContext): void {
  context.audio.playSound('sfx_shared_tap_fallback');
}
