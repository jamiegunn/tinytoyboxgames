# Shape Builder Puzzle

## Template
DragGame

## Concept
A shape outline is shown. Matching shape pieces are scattered around. Kid drags pieces into the matching outlines.

## Toy Shelf Icon
Colored triangle + square + circle grouped together

## Mechanics
- Target area: a picture or pattern made of shape outlines
- Shape pieces scattered at the bottom of the screen
- Drag a piece toward its matching outline
- Snap into place when close enough
- Wrong shape near wrong outline: gentle bounce back
- Complete the picture: big celebration, then new puzzle

## Visual
- Shapes: circle, square, triangle, star, heart, diamond
- Each shape has a distinct bright color
- Outlines: dashed borders matching shape + color but dimmed
- Pieces: solid filled shapes with slight shadow
- Puzzles: simple pictures built from shapes

## Feedback
- Snap: shape locks in with a satisfying settle and small confetti
- All placed: big celebration and a slight picture animation
- Counter: puzzles completed

## Difficulty
- Start with 3 shapes per puzzle
- Shapes are very distinct
- Generous snap distance
- No rotation needed
- No timer

## Sound (planned)
- Drag: soft slide sound
- Snap: click/lock sound
- Complete: fanfare

## Dependencies
- Requires reliable drag support in `input.js`
- A true `onDragStart` hook would simplify a template-based implementation
- Drag release needs to remain robust when the pointer leaves the canvas
