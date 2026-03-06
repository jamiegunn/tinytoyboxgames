# Build a Funny Monster

## Template
BuilderGame

## Concept
An empty monster body sits in the center. Parts (eyes, mouths, horns, arms) are available to drag onto it. Every combination works -- there are no wrong answers.

## Toy Shelf Icon
Silly monster face (one big eye, jagged mouth, small horn)

## Mechanics
- Monster body: large colored blob shape in center of screen
- Part categories: eyes, mouths, noses, horns/ears, accessories
- Parts displayed in a scrollable tray at bottom
- Drag a part onto the body to place it
- Parts snap to logical slots (eye zone, mouth zone, top zone)
- Tap a placed part to remove it (returns to tray)
- "New Monster" button to start fresh with different body color/shape
- No wrong combinations -- every monster is valid and celebrated

## Visual
- Body: large rounded blob, random bright color per round
- Parts: simple canvas-drawn features
  - Eyes: big circle, small circle, three-eyed, cyclops, sleepy
  - Mouths: smile, zigzag teeth, tongue out, tiny mouth, huge grin
  - Horns: small nubs, devil horns, antenna, crown
  - Accessories: bow tie, hat, spots, stripes
- Placed parts slightly bounce into position
- Monster wiggles idle animation

## Feedback
- Place part: small confetti + part bounces into place
- Monster "complete" (3+ parts): big celebration
- Monster does a dance animation when done
- No "done" button needed -- celebrate automatically at thresholds

## Difficulty
- No wrong answers
- Large drag targets
- Generous snap zones
- Parts are visually clear and distinct
- No required order

## Sound (planned)
- Place part: pop/snap
- Monster complete: silly monster voice + applause
- Remove part: boing
- Background: playful music

## Dependencies
- Requires drag support in input.js
- Most complex template -- build last
