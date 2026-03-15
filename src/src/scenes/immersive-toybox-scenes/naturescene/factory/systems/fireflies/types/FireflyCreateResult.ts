import type { Group } from 'three';
import type { FireflyInstance } from './FireflyInstance';

export interface FireflyCreateResult {
  root: Group;
  instances: FireflyInstance[];
  /** Kills all firefly drift and blink tween chains (including delayedCalls). */
  killAnimations: () => void;
}
