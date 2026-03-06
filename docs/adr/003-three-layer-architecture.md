# ADR-003: Three-Layer Architecture

## Status
Accepted

## Context
The project needs a clean separation between UI, engine, and game content to scale without complexity growing out of control.

## Decision
Build Tiny Toybox in 3 layers:

```
Layer 1: Toy Shelf UI        (launcher, navigation, toy chest animation)
Layer 2: Game Engine          (loop, input, rendering, sound, assets, celebration)
Layer 3: Game Templates       (TapGame, DragGame, ChoiceGame, SwipeGame, BuilderGame)
Layer 4: Game Configs         (individual game definitions, mostly data)
```

### Directory Structure
```
tinytoybox/
  index.html
  app.js
  engine/
    gameManager.js          -- lifecycle, lazy loading
    loop.js                 -- requestAnimationFrame
    input.js                -- tap, drag, swipe detection
    celebrate.js            -- confetti, sparkles (canvas-confetti CDN)
    sound.js                -- (future) audio manager
    assets.js               -- (future) image/sprite loader
    animation.js            -- (future) tweens, easing
  templates/
    tapGame.js              -- tap interaction template
    dragGame.js             -- drag-and-drop template
    choiceGame.js           -- quiz/choice template
    swipeGame.js            -- swipe/brush template
    builderGame.js          -- assembly template
  games/
    bubblePop.js            -- config for TapGame
    feedAnimal.js           -- config for DragGame
    colorMatch.js           -- config for ChoiceGame
    ...
```

### Lazy Loading
Games load only when opened via dynamic `import()`. Better for mobile performance.

### Shared Engine Systems (current and planned)
- `engine/celebrate.js` -- canvas-confetti (exists now)
- `engine/sound.js` -- audio playback
- `engine/assets.js` -- image/sprite loading
- `engine/animation.js` -- tweens, easing helpers

## Consequences
- Clear ownership: shelf UI doesn't know about game logic, games don't know about navigation
- New games only touch `games/` and possibly `templates/`
- Engine improvements benefit all games automatically
- Purely client-side, no server needed
