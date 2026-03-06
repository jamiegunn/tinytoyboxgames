# Animal Sound Guess

## Template
ChoiceGame

## Concept
An animal sound plays. Kid taps the matching animal from a set of options.

## Toy Shelf Icon
Cow face

## Mechanics
- Round starts: animal sound plays automatically
- 3-4 animal options displayed as large icons
- Tap the animal that makes that sound
- Correct: animal does a happy animation + celebrate
- Wrong: gentle "try again" feedback, sound replays
- Replay button available to hear the sound again

## Visual
- Animal icons: large circles (120px+) with simple canvas-drawn animal faces
- Animals: cow, cat, dog, duck, frog, pig, sheep, rooster
- Each animal has a distinct color and simple face
- Replay button: large speaker icon at top
- Prompt area: "Who says this?" with speaker/sound waves animation

## Feedback
- Correct: animal bounces, name appears briefly, confetti
- Wrong: option wobbles, streak resets
- Streak at 3+: displayed, big celebration at milestones

## Difficulty
- Start with 3 very different animals (cow, cat, duck)
- Gradually introduce more similar sounds
- No timer
- Sound auto-replays after 5 seconds of no tap

## Sound (required -- this game depends on audio)
- Animal sounds: moo, meow, woof, quack, ribbit, oink, baa, cockadoodledoo
- Correct: chime
- This game should be built AFTER engine/sound.js exists

## Dependencies
- Requires engine/sound.js
- Requires audio assets for each animal
