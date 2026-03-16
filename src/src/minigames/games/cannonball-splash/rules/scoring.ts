/**
 * Hit handling, combo integration, and milestones for Cannonball Splash.
 */

import type { MiniGameContext } from '../../../framework/types';
import type { Target, GameState, TargetKind } from '../types';
import { C } from '../types';

/** Sound mapping for target kinds. */
function hitSoundForKind(kind: TargetKind): 'pop' | 'chime' | 'fanfare' | 'whoosh' | 'splash' {
  switch (kind) {
    case 'barrel':
      return 'pop';
    case 'bottle':
      return 'chime';
    case 'duck':
      return 'pop';
    case 'golden-barrel':
      return 'fanfare';
    case 'rainbow-bottle':
      return 'whoosh';
  }
}

/**
 * Handles a target hit — awards score, registers combo, triggers celebration.
 */
export function handleTargetHit(
  target: Target,
  screenX: number,
  screenY: number,
  state: GameState,
  context: MiniGameContext,
  _isChainHit: boolean = false,
): void {
  context.combo.registerHit();
  context.score.addPoints(target.scoreValue);

  context.celebration.celebrationSound(hitSoundForKind(target.kind));

  // Celebration intensity based on target kind
  let intensity: 'small' | 'medium' | 'large' = 'small';
  if (target.kind === 'golden-barrel') intensity = 'large';
  else if (target.kind === 'rainbow-bottle') intensity = 'medium';
  else if (target.kind === 'duck') intensity = 'small';

  context.celebration.confetti(screenX, screenY, intensity);

  // Combo visual feedback at thresholds
  const comboMultiplier = context.combo.multiplier;
  if (comboMultiplier >= 4) {
    context.celebration.confetti(screenX, screenY, 'large');
    context.celebration.celebrationSound('chime');
  } else if (comboMultiplier >= 3) {
    context.celebration.confetti(screenX, screenY, 'medium');
    context.celebration.celebrationSound('chime');
  } else if (comboMultiplier >= 2) {
    context.celebration.confetti(screenX, screenY, 'small');
  }

  // Check milestones
  checkMilestones(context.score.score, state.milestoneScores, context, screenX, screenY);
}

/**
 * Handles a water miss (no score penalty per spec).
 */
export function handleWaterMiss(context: MiniGameContext): void {
  context.celebration.celebrationSound('splash');
  // Combo does NOT break on miss per spec — only on time decay
}

/**
 * Checks and triggers score milestones.
 */
export function checkMilestones(score: number, milestoneScores: Set<number>, context: MiniGameContext, screenX: number, screenY: number): void {
  // First hit
  if (score >= 10 && !milestoneScores.has(10)) {
    milestoneScores.add(10);
    context.celebration.confetti(screenX, screenY, 'small');
  }

  // 50 milestone
  if (score >= 50 && !milestoneScores.has(50)) {
    milestoneScores.add(50);
    context.celebration.milestone(screenX, screenY, 'medium');
  }

  // 100 and every 100 after
  const hundredMilestone = Math.floor(score / C.SCORE_MILESTONE_INTERVAL) * C.SCORE_MILESTONE_INTERVAL;
  if (hundredMilestone >= 100 && !milestoneScores.has(hundredMilestone)) {
    milestoneScores.add(hundredMilestone);
    context.celebration.milestone(screenX, screenY, 'large');
  }
}
