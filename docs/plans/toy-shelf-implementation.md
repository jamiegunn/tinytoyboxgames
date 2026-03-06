# Plan: Toy Shelf Launcher Implementation

## Goal
Replace the current HTML button menu with a canvas-rendered toy shelf that preschoolers can navigate visually.

## Phases

### Phase 1: Toy Shelf Rendering
- [ ] Create `engine/shelf.js` module
- [ ] Define toy data array with game ID, draw function, and hitbox
- [ ] Render 2-column grid on canvas (120x120 tap targets)
- [ ] Draw toys using simple canvas shapes (no image assets needed initially)
  - Bubble wand: circle + stick
  - Frog: green circle + eyes
  - Paint palette: colored circles on oval
- [ ] Title "Tiny Toybox" rendered on canvas above shelf
- [ ] Remove HTML menu from index.html

### Phase 2: Toy Animations
- [ ] Idle wiggle: toys slowly rotate +/- 3 degrees
- [ ] Tap feedback: toy scales up briefly (bounce effect)
- [ ] Sparkle particles on tap (small dots radiating outward)
- [ ] Zoom transition: tapped toy scales to fill screen, then game loads

### Phase 3: Toy Chest Opening (app start)
- [ ] Draw closed toy chest
- [ ] Animate chest lid opening
- [ ] Sparkles burst out
- [ ] Toys fly to shelf positions
- [ ] Plays once per session

### Phase 4: Sound Integration
- [ ] Each toy has a tap sound (pop, ribbit, splash, moo, etc.)
- [ ] Background ambient sound (soft music/jingle)
- [ ] Requires `engine/sound.js` implementation

### Phase 5: Toy Unlocking
- [ ] Start with 3 toys visible
- [ ] Track games played in localStorage
- [ ] Unlock new toys at milestones
- [ ] New toy appearance: sparkle + bounce animation
- [ ] Locked toy slots show as wrapped presents or shadows

## Toy Data Structure
```js
const toys = [
  {
    game: "bubblePop",
    draw(ctx, x, y, size) { /* bubble wand */ },
    sound: "pop"
  },
  {
    game: "feedAnimal",
    draw(ctx, x, y, size) { /* frog face */ },
    sound: "ribbit"
  },
  {
    game: "colorMatch",
    draw(ctx, x, y, size) { /* paint palette */ },
    sound: "splash"
  }
]
```

## Navigation Flow
```
App Start -> Toy Chest Animation -> Toy Shelf
Tap Toy -> Wiggle + Sound + Zoom -> Game Loads
Game End -> "Home" / "Play Again" buttons (big, visual)
Home -> Back to Toy Shelf
```
