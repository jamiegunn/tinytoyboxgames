# ADR-001: Toy Shelf Launcher

## Status
Accepted

## Context
The home screen needs to work for ages 3-5. Preschoolers cannot read. They recognize physical objects (a bubble, a frog, a paint splat) much faster than text labels or button lists.

## Decision
Replace the text-button menu with a **Toy Shelf** launcher rendered on canvas.

- Each game is represented by a toy icon (visual only, no text required)
- Layout is a 2-column grid of large tap targets (120x120 minimum)
- No reading required to navigate

### Toy-to-Game Mapping

| Game           | Toy Visual     |
|----------------|----------------|
| Bubble Pop     | Bubble wand    |
| Feed Animal    | Frog           |
| Color Match    | Paint palette  |
| Shape Builder  | Shape blocks   |
| Animal Sounds  | Cow            |
| Fireflies      | Jar            |

### Interaction Flow
1. App opens with toy chest animation (chest opens, sparkles, toys appear)
2. Toys sit on shelf with idle wiggle animation
3. Kid taps a toy
4. Toy wiggles, makes a sound, screen zooms in
5. Game loads
6. On game end: show "Toy Shelf" (home) and "Play Again" options

### Rendering
```
function drawShelf() {
  toys.forEach((toy, i) => {
    const x = 120 + (i % 2) * 200
    const y = 200 + Math.floor(i / 2) * 180
    ctx.drawImage(toy.icon, x, y, 120, 120)
    toy.hitbox = { x, y, w: 120, h: 120 }
  })
}
```

## Consequences
- All navigation is visual/tactile, no literacy required
- Tap targets are large enough for small hands
- Adding a new game = adding a new toy to the shelf
- Toy unlocking becomes a natural progression mechanic (start with 6, unlock more)
