import type { BubbleState } from '../types';
import { CHAIN_POP_RADIUS, WOBBLE_RADIUS, SIZE_VARIANTS, CHAIN_POP_INITIAL_DELAY, CHAIN_POP_STAGGER, WOBBLE_AUTO_POP_DELAY } from '../types';
import { randomRange } from '../helpers';

/**
 * Game rules that operate on bubbles — chain reactions, wobble propagation,
 * and tap interaction responses. Stateless: all mutable state is passed in
 * by the caller. Does not create or dispose entities (see lifecycle.ts) or
 * drive visual effects (see effects.ts).
 */

/**
 * Applies a wobble jitter to a bubble as chain reaction feedback.
 * Increases wobble speed and adds slight position perturbation.
 * @param bubble - The bubble to jitter.
 */
export function applyWobbleJitter(bubble: BubbleState): void {
  bubble.wobbleSpeed = randomRange(4.0, 6.0);
  bubble.wobblePhase = Math.random() * Math.PI * 2;
  bubble.mesh.position.x += randomRange(-0.1, 0.1);
  bubble.mesh.position.y += randomRange(-0.05, 0.05);
}

/**
 * Handles a giant bubble being tapped — wobble feedback + visual shrink.
 * The caller is responsible for checking tapsRemaining before calling
 * and for popping the bubble when taps are exhausted.
 * @param bubble - The giant bubble tapped.
 */
export function tapGiantBubble(bubble: BubbleState): void {
  bubble.tapsRemaining--;
  // Wobble feedback — jolt
  bubble.wobblePhase = Math.random() * Math.PI * 2;
  bubble.wobbleSpeed *= 1.5;
  // Shrink slightly to show progress
  if (bubble.sizeVariant < SIZE_VARIANTS.length - 1) {
    bubble.sizeVariant++;
  }
}

/**
 * Queues chain-pops for all normal bubbles within range of a rainbow pop.
 * Skips special bubble kinds (golden, rainbow, giant) to prevent infinite
 * chain loops. Pops by proximity, not by color match.
 * @param source - The rainbow bubble that was popped.
 * @param activeBubbles - The current active bubbles.
 * @param chainPopQueue - The mutable chain pop queue (entries are pushed).
 */
export function triggerChainPop(source: BubbleState, activeBubbles: readonly BubbleState[], chainPopQueue: { bubble: BubbleState; delay: number }[]): void {
  const sourcePos = source.mesh.position;
  let delay = CHAIN_POP_INITIAL_DELAY;
  for (const other of activeBubbles) {
    if (other === source || !other.active || other.spawning) continue;
    if (other.kind !== 'normal') continue;

    const dx = other.mesh.position.x - sourcePos.x;
    const dy = other.mesh.position.y - sourcePos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < CHAIN_POP_RADIUS) {
      chainPopQueue.push({ bubble: other, delay });
      delay += CHAIN_POP_STAGGER;
    }
  }
}

/**
 * Wobbles nearby bubbles when one pops. If 3+ are wobbled, queues one
 * random victim for auto-pop after a short delay.
 * @param source - The bubble that was popped.
 * @param activeBubbles - The current active bubbles.
 * @param wobbleQueue - The mutable wobble auto-pop queue (entries may be pushed).
 */
export function triggerWobbleChain(source: BubbleState, activeBubbles: readonly BubbleState[], wobbleQueue: { bubble: BubbleState; timer: number }[]): void {
  const sourcePos = source.mesh.position;
  let wobbledCount = 0;

  for (const other of activeBubbles) {
    if (other === source || !other.active || other.spawning) continue;

    const dx = other.mesh.position.x - sourcePos.x;
    const dy = other.mesh.position.y - sourcePos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < WOBBLE_RADIUS) {
      applyWobbleJitter(other);
      wobbledCount++;
    }
  }

  if (wobbledCount >= 3) {
    const candidates = activeBubbles.filter((b) => b !== source && b.active && !b.spawning);
    if (candidates.length > 0) {
      const victim = candidates[Math.floor(Math.random() * candidates.length)];
      wobbleQueue.push({ bubble: victim, timer: WOBBLE_AUTO_POP_DELAY });
    }
  }
}
