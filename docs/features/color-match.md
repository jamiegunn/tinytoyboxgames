# Color Match

## What it is

Color Match is a multiple-choice recognition game. The player is shown a target color name and taps the matching colored button.

## How it plays

1. The top of the screen shows a prompt and a large target color name.
2. The play area displays a set of large colored buttons.
3. The player taps the button whose color matches the prompt.
4. A correct answer immediately advances to the next round after a short success animation.

## Controls

- Tap one of the color choice buttons.

## Scoring and progression

- Correct answers build a combo window of 3 seconds.
- The score reward grows with the combo:
  1 point normally, 2 points on mid-streaks, and 3 points on longer streaks.
- Wrong answers do not end the game, but they reset the combo.
- The number of answer choices grows over time from 3 up to 6.

## Feedback and presentation

- Correct answers trigger a bright rising chime, confetti, particles, and a checkmark overlay.
- Wrong answers play a low buzz, shake the selected button, and show an X overlay.
- The background includes floating color-themed shapes and strong button gradients.

## Notes

- This is the most reading-dependent game in the current set because the prompt and answer labels are written words.
- The colored swatch under the prompt softens that dependency, but the mechanic still relies on text more than the other games.

## Source

- `games/colorMatch.js`
