# ADR-006: Per-Game Themed Backgrounds

## Status
Accepted

## Context
The engine clears the canvas to a flat dark color each frame. All games shared the same stark background, which felt lifeless and made transitions between the toybox and games jarring.

## Decision
Each game renders its own soft gradient background as the first step of its `render()` method. Backgrounds are themed to match the game's mood.

### Current Backgrounds

| Game | Background | Reasoning |
|------|-----------|-----------|
| Bubble Pop | Dark navy to blue gradient | Calm underwater/night sky feel for floating bubbles |
| Feed Animal | Light blue sky + soft green grass | Outdoor meadow scene, natural setting for an animal |
| Color Match | Deep plum to purple gradient | Dark backdrop makes bright color swatches pop |

### Rules for New Games
- Every game must draw its own background in `render()`
- Use soft gradients, not flat solid colors
- Background should complement the game's visual content, not compete with it
- Keep backgrounds subtle -- the game elements are the focus
- Use `createLinearGradient` for consistency and performance

### Example Pattern
```js
render() {
  const bg = ctx.createLinearGradient(0, 0, 0, h)
  bg.addColorStop(0, "#1b2a4a")
  bg.addColorStop(1, "#2d4a7a")
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, w, h)

  // ... game content drawn on top
}
```

## Consequences
- Each game feels distinct and immersive
- Transitions from the toybox into a game feel intentional
- No shared background configuration needed in the engine
- Games have full control over their visual atmosphere
- Slightly more draw calls per frame (one fillRect), negligible performance impact
