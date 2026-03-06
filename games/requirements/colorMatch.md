# Color Match

## Template
ChoiceGame

## Concept
A color name is shown at the top in its matching color. Kid taps the correct color swatch from 4 options.

## Toy Shelf Icon
Paint palette with colored dots

## Mechanics
- Prompt: color name displayed in that color (e.g. "Red" in red)
- 4 large color swatches shown in a 2x2 grid
- Tap the swatch matching the prompt color
- Correct: celebrate + next round
- Wrong: "Try again!" text, streak resets, no other penalty
- Brief cooldown after answer (0.6-0.8s) to prevent accidental double-tap

## Visual
- 7-color palette: Red, Blue, Green, Yellow, Purple, Orange, Pink
- Color swatches are large rounded rectangles (200px wide, 160px tall max)
- 2-column layout, responsive to screen size
- Prompt text is bold 44px in the target color
- "Tap the color:" label above prompt

## Feedback
- Correct: "Yes!" in green + confetti
- Wrong: "Try again!" in red (fades out)
- Streak counter shown at 3+ ("3 in a row!")
- Every 5-streak: big celebration
- Score at bottom center

## Difficulty
- No timer
- No penalty beyond streak reset
- Colors are visually distinct (no similar shades)
- The color name IS displayed in the matching color, so even non-readers can match visually

## Sound (planned)
- Correct: chime
- Wrong: soft boop
- Streak milestone: fanfare
