# Fireflies

## Template
TapGame

## Concept
Nighttime scene. Glowing fireflies drift around. Kid taps them to catch them in a jar.

## Toy Shelf Icon
Glass jar with yellow glowing dots inside

## Mechanics
- Dark blue/purple background (night sky)
- Fireflies spawn randomly, drift in gentle curves
- Glow pulses on/off slowly (sine wave alpha)
- Tap a firefly to catch it
- Caught fireflies appear in a jar at the bottom of the screen
- Jar fills up visually as more are caught

## Visual
- Firefly: small yellow-white circle (30-40px) with radial glow
- Glow effect: outer soft circle at low alpha, pulses
- Jar: simple glass jar outline at bottom center
- Caught fireflies glow inside the jar
- Stars in background (static small dots)
- Moon in top corner

## Feedback
- Catch: firefly shrinks and flies to jar + small confetti
- Jar milestones (every 5): big celebration
- Counter: number of fireflies caught

## Difficulty
- Fireflies move slowly and predictably
- Large hitbox despite small visual (generous tap detection)
- No time limit, no escape penalty

## Sound (planned)
- Background: cricket ambience
- Catch: soft twinkle/chime
- Jar full: gentle applause
