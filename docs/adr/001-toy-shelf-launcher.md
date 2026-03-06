# ADR-001: Toy Shelf Launcher

## Status
Partially Implemented

## Context
The home screen needs to work for preschoolers who recognize physical objects faster than text labels.

## Decision
Use a toy-shelf style launcher built around visual toy affordances instead of text-heavy navigation.

- Each game is represented by a toy icon
- Tap targets should remain large and easy to hit
- Navigation should avoid reading wherever possible

## Current Implementation
The current shelf lives in `toybox.html` and is built with DOM/CSS, not canvas.

- Toys are HTML buttons styled as shelf items
- The shelf currently exposes 12 playable game entries
- A richer animated canvas shelf remains a future enhancement, not the current implementation

## Future Canvas Direction
If the shelf is later moved to canvas, it should preserve the same toy-first interaction model while keeping hit targets generous.

```js
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
- Navigation stays visual and tactile
- The current DOM shelf is a valid implementation of the decision
- Canvas rendering is an enhancement path, not a description of the current code
