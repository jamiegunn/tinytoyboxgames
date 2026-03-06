# Plan: Game Template System

## Goal
Build 5 reusable game templates so new games are configuration, not custom code. Target: any new game in under 30 lines.

## Templates to Build

### 1. TapGame (`templates/tapGame.js`)
- [ ] Config: sprite/draw, spawnRate, speed, hitRadius, direction, onTap callback
- [ ] Engine: spawn loop, movement, hit detection, removal, score tracking
- [ ] Auto-celebrate on hit
- [ ] Auto-respawn on hit or timer

**Games using this:** Bubble Pop, Fireflies, Hide and Seek Animals

### 2. DragGame (`templates/dragGame.js`)
- [ ] Config: targets (with accepts list), items (with id, draw)
- [ ] Engine: touch/mouse drag tracking, item follows finger
- [ ] Snap detection: item near target -> snap into place
- [ ] Match validation: item.id in target.accepts
- [ ] Celebrate on match, celebrate big on all matched
- [ ] Requires `input.js` to support drag (onDragStart, onDragMove, onDragEnd)

**Games using this:** Feed the Animal, Shape Builder Puzzle

### 3. ChoiceGame (`templates/choiceGame.js`)
- [ ] Config: prompt generator, options generator, isCorrect function
- [ ] Engine: render prompt, render option buttons (large, colorful)
- [ ] Tap detection on options
- [ ] Correct: celebrate + next round
- [ ] Wrong: gentle feedback (wobble, no punishment)
- [ ] Streak tracking with big celebration at milestones

**Games using this:** Color Match, Animal Sound Guess

### 4. SwipeGame (`templates/swipeGame.js`)
- [ ] Config: brushSize, completionThreshold, background, overlay, onComplete
- [ ] Engine: track touch/mouse movement, paint "clean" area
- [ ] Progress meter (visual, not numeric)
- [ ] Celebrate on completion threshold reached
- [ ] Requires `input.js` to support continuous drag tracking

**Games using this:** Clean the Mess, Balloon Drag Race

### 5. BuilderGame (`templates/builderGame.js`)
- [ ] Config: slots (named positions on a body), pieces (draggable options)
- [ ] Engine: render body outline with empty slots
- [ ] Drag pieces to slots, snap on proximity
- [ ] Each slot accepts specific piece categories
- [ ] Celebrate per piece placed, big celebration when complete
- [ ] Random/silly combinations encouraged

**Games using this:** Build a Funny Monster, Shape Builder

## Input System Upgrades Needed
Current `input.js` only supports tap. Templates need:
- [ ] `onDragStart(fn)` -- finger/mouse down
- [ ] `onDragMove(fn)` -- finger/mouse move while down
- [ ] `onDragEnd(fn)` -- finger/mouse up
- [ ] `offDrag()` -- cleanup

## Template API Pattern
Each template is a factory function that returns a game object:

```js
// templates/tapGame.js
export function TapGame(config) {
  return {
    start(engine) { /* setup using config */ },
    update(dt) { /* spawn, move, remove */ },
    render() { /* draw objects */ },
    destroy() { /* cleanup handlers */ }
  }
}

// games/bubblePop.js
import { TapGame } from "../templates/tapGame.js"

export default TapGame({
  sprite: "bubble",
  spawnRate: 1.2,
  speed: 60,
  hitRadius: 45,
  onTap() { playSound("pop") }
})
```

## Future: JSON Game Definitions
Once templates are stable, games can be pure data:
```json
{
  "type": "tap",
  "object": "bubble",
  "spawnRate": 1.5,
  "sound": "pop"
}
```
Engine reads JSON, picks template, creates game. Enables non-programmers to add games.

## Build Order
1. TapGame (simplest, validates the pattern)
2. ChoiceGame (already have colorMatch as reference)
3. DragGame (needs input upgrades)
4. SwipeGame (needs input upgrades)
5. BuilderGame (most complex, builds on DragGame)
