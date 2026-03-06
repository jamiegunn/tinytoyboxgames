# Clean the Mess

## Template
SwipeGame

## Concept
A window or mirror is covered in mess (fog, paint, mud). Kid swipes to clean it, revealing a fun picture underneath.

## Toy Shelf Icon
Sponge with bubbles

## Mechanics
- Screen covered with an opaque "dirty" layer
- Hidden picture underneath (animal, scene, pattern)
- Swipe/drag finger across screen to erase the dirty layer
- Brush size is large (80px radius) for easy swiping
- Progress meter shows how much has been cleaned
- At 80% cleaned: picture is "revealed" -- celebrate

## Visual
- Dirty layer: semi-random splotchy texture (browns, greys, or foggy white)
- Revealed picture: bright, colorful, simple illustration
- Brush trail: clean circle following finger with slight sparkle
- Progress: simple bar at top or percentage shown as stars filling up
- Pictures rotate each round (5-10 different reveals)

## Feedback
- Swiping: sparkle trail follows finger
- 50% cleaned: small encouragement confetti
- 80% complete: big celebration, full picture revealed clearly
- New picture loads for next round

## Difficulty
- Brush is very large -- fast progress
- No time limit
- 80% threshold means corners don't need to be perfect
- Pictures are simple and rewarding to reveal

## Sound (planned)
- Swipe: squeaky clean sound
- Reveal: ta-da fanfare
- Background: light bubbly music

## Dependencies
- Requires continuous drag tracking in input.js
- Uses canvas compositing (globalCompositeOperation: "destination-out") for erasing
