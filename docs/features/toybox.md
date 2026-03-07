# Toybox And Launcher

## What it is

The toybox feature is the app shell around the games. It includes the landing page, the playroom-style toy shelf, the shared canvas shell, the back button, the buddy owl helper, and the music box.

## Player flow

1. The landing page presents a single large "Open the Toybox" call to action.
2. `toybox.html` opens into a decorated playroom with a four-row shelf of 12 toy buttons.
3. Tapping a toy hides the shelf, shows the back button, loads the selected game module, and starts that game's music loop.
4. Pressing the back arrow unloads the game and returns to the shelf.

## Main interactions

- The shelf uses large visual toy buttons instead of text labels.
- The buddy owl moves between shelf rows every 10 to 15 seconds and periodically suggests a toy.
- Tapping the buddy either highlights a suggestion or directly launches the currently suggested toy.
- The side-table music box toggles a lullaby built with the Web Audio API.
- If the music box was playing before a game launch, it resumes when the player returns home.

## Shared experience rules

- Persistent browser storage is disabled on both `index.html` and `toybox.html`.
- Input is unified through the shared canvas input helper, so mouse and touch both work.
- Games render on a full-screen canvas while the toybox menu remains DOM-driven.
- Confetti uses a shared overlay canvas.
- The toy shelf currently exposes 12 live game entries:
  Bubble Pop, Feed Animal, Color Match, Fireflies, Hide And Seek, Clean The Mess, Balloon Race, Shape Builder, Baby Shark, Puppy Fetch, Elephant Splash, and Monster Truck.

## Presentation details

- The landing page uses a warm, preschool-friendly hero layout with one clear CTA.
- The shelf scene includes fairy lights, floating dust, framed kid art, floor toys, curtains, a clock, and a window.
- The buddy and music box are ambient features that make the menu feel alive even before a game starts.

## Source files

- `index.html`
- `toybox.html`
- `app.js`
- `js/toybox-entry.js`
- `js/playroom.js`
- `js/buddy.js`
- `engine/gameManager.js`
- `engine/input.js`
- `engine/gameMusic.js`
- `engine/celebrate.js`
