# Plan: Game Template System

## Goal
Build 5 reusable game templates so new games are configuration, not custom code. Target: any new game in under 30 lines.

## Current State
This document is a refactor plan. The current repo does not have a `templates/` directory yet; games are still hand-authored modules in `games/`.

## Templates to Build

### 1. TapGame (`templates/tapGame.js`)
- [ ] Config: sprite/draw, spawnRate, speed, hitRadius, direction, onTap callback
- [ ] Engine: spawn loop, movement, hit detection, removal, score tracking
- [ ] Auto-celebrate on hit
- [ ] Auto-respawn on hit or timer

Games using this: Bubble Pop, Fireflies, Hide and Seek Animals

### 2. DragGame (`templates/dragGame.js`)
- [ ] Config: targets, accepted items, draw functions
- [ ] Engine: drag tracking, item follows pointer
- [ ] Snap detection
- [ ] Match validation
- [ ] Celebrate on match, celebrate big on completion

Games using this: Feed the Animal, Shape Builder Puzzle

### 3. ChoiceGame (`templates/choiceGame.js`)
- [ ] Config: prompt generator, options generator, `isCorrect`
- [ ] Engine: render prompt and options
- [ ] Correct answer flow
- [ ] Gentle wrong-answer feedback
- [ ] Streak milestones

Games using this: Color Match, Animal Sound Guess

### 4. SwipeGame (`templates/swipeGame.js`)
- [ ] Config: brush size, completion threshold, background, overlay, onComplete
- [ ] Engine: continuous drag tracking
- [ ] Progress feedback
- [ ] Completion celebration

Games using this: Clean the Mess, Balloon Race

### 5. BuilderGame (`templates/builderGame.js`)
- [ ] Config: slots, piece categories, draw functions
- [ ] Engine: drag pieces to slots and snap on proximity
- [ ] Per-piece celebration and final completion celebration

Games using this: Build a Funny Monster, Shape Builder

## Input System Upgrades Still Needed
Current `input.js` supports tap, drag move, and drag end. Template work still needs:
- [ ] `onDragStart(fn)`
- [ ] pointer-capture / cancellation handling for robust drag release
- [ ] consolidated cleanup helpers

## Build Order
1. TapGame
2. ChoiceGame
3. DragGame
4. SwipeGame
5. BuilderGame
