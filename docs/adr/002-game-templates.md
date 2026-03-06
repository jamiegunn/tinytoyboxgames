# ADR-002: Game Templates Over Custom Games

## Status
Accepted

## Context
Building 10+ unique games from scratch means 10+ separate systems with duplicated logic for spawning, hit detection, drag handling, scoring, and celebration. This doesn't scale.

## Decision
Build **5 reusable game templates**. Each game becomes configuration rather than custom code.

### The 5 Templates

#### 1. TapGame
Spawn objects, kid taps them, objects react.

**Used by:** Bubble Pop, Fireflies, Hide and Seek Animals

```js
export default TapGame({
  sprite: "bubble",
  spawnRate: 1.2,
  speed: 60,
  hitRadius: 40,
  onTap(obj) { playSound("pop") }
})
```

#### 2. DragGame
Drag items to target zones, check match, celebrate.

**Used by:** Feed the Animal, Shape Builder Puzzle, Build a Monster

```js
export default DragGame({
  targets: [{ id: "frog", accepts: ["fly"] }],
  items: [{ id: "fly" }]
})
```

Engine handles: drag physics, snap, match detection, celebration.

#### 3. ChoiceGame
Show a prompt, present options, tap the correct one.

**Used by:** Color Match Splash, Animal Sound Guess

```js
export default ChoiceGame({
  prompt: () => randomColor(),
  options: () => randomShapes(),
  isCorrect: (choice, prompt) => choice.color === prompt
})
```

#### 4. SwipeGame
Swipe/brush across the screen to complete an action.

**Used by:** Clean the Mess, Balloon Drag Race

```js
export default SwipeGame({
  brushSize: 80,
  completion: 0.8,
  onComplete() { playSound("yay") }
})
```

#### 5. BuilderGame
Choose pieces, drag to slots, snap, build something.

**Used by:** Build a Funny Monster, Shape Builder

```js
export default BuilderGame({
  slots: ["eyes", "mouth", "horns"],
  pieces: ["eye1", "eye2", "mouth1"]
})
```

## Consequences
- 10 games = 5 templates + configuration (not 10 custom systems)
- Adding a new game can be as simple as a JSON config
- Could scale to 50-200 games on the same platform
- Templates own shared concerns: hit detection, drag physics, celebration, scoring
