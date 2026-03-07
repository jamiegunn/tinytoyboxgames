// Reduced motion preference detection
export const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')

export function shouldAnimate() {
  return !prefersReducedMotion.matches
}
