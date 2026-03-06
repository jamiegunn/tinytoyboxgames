# Shape Builder Puzzle

## Template
DragGame

## Concept
A shape outline is shown. Matching shape pieces are scattered around. Kid drags pieces into the matching outlines.

## Toy Shelf Icon
Colored triangle + square + circle grouped together

## Mechanics
- Target area: a picture or pattern made of shape outlines (dashed borders)
- Shape pieces scattered at bottom of screen
- Drag a piece toward its matching outline
- Snap into place when close enough (generous proximity: 60px+)
- Wrong shape near wrong outline: gentle bounce back
- Complete the picture: big celebration, then new puzzle

## Visual
- Shapes: circle, square, triangle, star, heart, diamond
- Each shape has a distinct bright color
- Outlines: dashed borders matching shape + color but dimmed
- Pieces: solid filled shapes with slight shadow
- Puzzles: simple pictures (house = square + triangle roof, train = rectangles + circles)

## Feedback
- Snap: shape locks in with a satisfying settle + small confetti
- All placed: big celebration + picture "comes alive" (slight animation)
- Counter: puzzles completed

## Difficulty
- Start with 3 shapes per puzzle
- Shapes are very distinct (no similar shapes)
- Generous snap distance
- No rotation needed (pieces are pre-rotated)
- No timer

## Sound (planned)
- Drag: soft slide sound
- Snap: click/lock sound
- Complete: fanfare

## Dependencies
- Requires drag support in input.js (onDragStart, onDragMove, onDragEnd)
