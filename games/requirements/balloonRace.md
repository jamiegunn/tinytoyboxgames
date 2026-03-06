# Balloon Drag Race

## Template
SwipeGame

## Concept
Balloons sit at the bottom. Kid swipes upward on them to make them fly into the sky.

## Toy Shelf Icon
Red balloon with string

## Mechanics
- 3-5 colorful balloons at bottom of screen
- Swipe upward on a balloon to launch it
- Swipe speed/length determines how high it flies
- Balloons float up with wobble, then drift off screen
- New balloons appear after launch
- Goal: launch as many as possible (pure fun, no fail state)

## Visual
- Balloons: oval shapes with small triangle knot at bottom, string hanging down
- Colors: red, blue, yellow, green, purple (random per balloon)
- Sky: gradient blue with white clouds drifting
- Launched balloons shrink as they rise (perspective)
- Trail: small dots or sparkles behind rising balloon

## Feedback
- Launch: balloon flies up with wobble + small confetti
- Big swipe: balloon goes really high + big confetti
- Counter: balloons launched
- Milestone every 10: big celebration

## Difficulty
- Any upward swipe works (very forgiving gesture detection)
- Balloons are large tap/swipe targets
- No precision needed
- No timer

## Sound (planned)
- Launch: whoosh + boing
- Float away: gentle whistle
- Background: breezy outdoor ambience

## Dependencies
- Requires swipe/drag direction detection in input.js
