# ADR-004: Preschool UX Principles

## Status
Accepted

## Context
Target audience is ages 3-5. UX must account for limited motor control, no reading ability, and short attention spans.

## Decision
All games and UI must follow these principles:

### Do Use
- **Big hitboxes** (minimum 45px radius / 120px buttons)
- **Large buttons** with visual icons, not text
- **Bright colors** from a kid-friendly palette
- **Simple physics** (gravity, bounce -- no complex simulations)
- **Recognition over reading** (icons, colors, shapes)
- **Celebration on every success** (confetti, sparkles, sounds)
- **Immediate feedback** on every tap (wiggle, sound, color change)

### Do Not Use
- Tiny UI elements
- Timers or countdowns (stress-inducing for young kids)
- Reading-dependent interfaces
- Complex multi-step instructions
- Punishing failure states

### Celebration System
Every game shares a celebration system:
- Small win: confetti burst (`celebrate()`)
- Streak/milestone: big dual-sided confetti (`celebrateBig()`)
- Future: sparkles, applause sound, happy voice

### Sound Design (planned)
- Background: soft music, toy jingles
- Per-toy sounds: bubble pop, frog ribbit, paint splash, cow moo
- Success: applause, chime
- Keeps the app feeling alive

### Navigation
- Tap toy to enter game (no menus, no text)
- Big home button to return to shelf
- Play Again option on game end
- No deep navigation hierarchies

## Consequences
- Every new game/feature gets checked against these principles
- Keeps the app accessible to the youngest users
- Celebration system is shared infrastructure, not per-game
