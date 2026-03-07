# Shape Builder

## What it is

Shape Builder is a drag-and-snap puzzle game. The player drags loose shape pieces from a tray into matching silhouette slots that form a larger picture.

## How it plays

1. The puzzle card at the top shows empty shape outlines.
2. Matching pieces sit in a tray at the bottom.
3. The player drags a piece onto the outline with the same shape.
4. Correct placement snaps the piece into position; once every slot is filled, the puzzle completes and the next puzzle loads automatically.

## Controls

- Tap a tray piece to pick it up.
- Drag it toward the matching outline.
- Release near the correct slot to snap it in.

## Scoring and progression

- The score counter tracks completed puzzles, not individual piece placements.
- Snapping pieces quickly within 4 seconds builds a combo.
- When a puzzle completes, the game awards a 1 to 3 star rating based on how quickly that specific puzzle was solved.
- The puzzle list cycles through preset designs such as House, Smiley, Rocket, Crown, Flower, Butterfly, Robot, Fish, Castle, and Star Ship.

## Feedback and presentation

- Matching slots pulse softly and glow when the correct dragged piece gets close.
- Each successful snap plays a crisp click, spawns particles, and triggers confetti.
- Full puzzle completion uses a short fanfare, bigger particles, a "Complete!" banner, and the star reveal.
- Incorrect placement is gentle: the piece simply returns to its tray position.

## Source

- `games/shapeBuilder.js`
