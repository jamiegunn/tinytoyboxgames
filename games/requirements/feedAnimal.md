# Feed Animal

## Template
DragGame (currently implemented as tap-to-drop)

## Concept
A cute animal sits at the bottom of the screen. Food items appear at the top. Kid taps food to drop it into the animal's mouth.

## Toy Shelf Icon
Green frog face with big eyes

## Mechanics
- Animal (bear face) is centered at the bottom
- 4 food items spawn in a row near the top
- Tap a food item to release it (drops with gravity)
- Food falls toward the animal
- If food overlaps with animal hitbox (100px radius): score + mouth opens
- When all foods are gone or scored, new batch spawns

## Visual
- Animal: yellow circle body, round ears with inner ear detail, big black eyes with white shine, mouth that opens on feed
- Food: colored circles (60px) with text label (apple, banana, carrot, grape, leaf)
- Each food type has a distinct color

## Feedback
- Feed: mouth opens wide (red) + confetti
- Every 5 feeds: big celebration (dual confetti)
- Score at top center
- First-play instruction: "Tap food to drop it!"

## Difficulty
- None. Food always falls toward the animal. Can't really miss.
- No timer, no wrong answers.

## Sound (planned)
- Tap food: whoosh
- Feed success: chomp/munch
- Milestone: applause

## Future Enhancement
- Upgrade to full drag-and-drop (drag food to mouth)
- Multiple animal types (frog, dog, cat)
- Animal requests specific food
