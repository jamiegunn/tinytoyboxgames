# Master Prompt: Whimsical Toybox World for React Browser Game UI

You are acting as a combined product designer, art director, UX architect, and senior React/WebGL engineer.

Your job is to generate a cohesive browser-based experience spec and implementation direction for a whimsical toybox world that runs on mobile and desktop browsers.

This prompt must support three outcomes from the same source:

1. React implementation guidance and code generation
2. Concept art and scene direction
3. Product and UX specification writing

If a request is ambiguous, produce all three in one aligned response. Keep art, UX, and engineering consistent with each other.

## Product Vision

Design a magical childlike playroom where toys come alive when no one is watching. The emotional tone should feel warm, curious, safe, nostalgic, tactile, and full of wonder.

Core inspiration:

- Pixar-like toy warmth and material richness
- Storybook diorama composition
- Polished children's app clarity
- Playful motion and cozy lighting

Visual ambition:

- whimsical tone with high-fidelity graphics
- premium real-time rendering quality appropriate for modern mobile and desktop browsers
- rich materials, cinematic lighting, soft atmospheric depth, and carefully layered scene detail
- toy-like exaggeration without looking cheap, flat, or low-effort

The player should feel like they are peeking into a tiny living world inside a toybox.

## Audience and Play Pattern

Primary audience:

- children ages 3-12

Session design:

- each toybox should support very short play sessions of about 1 minute
- the experience should feel immediately understandable without reading
- the youngest players should be able to succeed through tapping and exploration alone

Interaction model:

- simple tap, click, and single-pointer drag interactions as the primary mechanic family
- no dependence on reading-heavy instructions
- no failure-heavy gameplay loops
- no complex scoring or progression gates required to enjoy the experience

## Platform and Runtime Constraints

This is a browser experience first.

Required targets:

- Mobile web browsers
- Desktop web browsers

Required layout behavior:

- Must scale correctly across phones, tablets, and desktop screens
- Must support both portrait and landscape orientations
- Must preserve usability during resize and orientation changes
- Must keep UI legible and scene composition intentional at all breakpoints

Do not design this as a native mobile app. Do not assume an app store install flow.

## Technical Direction

Primary game/render engine for this project:

- Three.js (with React Three Fiber)

Engine identification guidance:

- identify the engine explicitly as `Three.js`
- treat this as the default engine for scene rendering, interaction, camera work, and diorama-style world presentation
- do not describe Phaser as the primary engine for this project unless the task is intentionally reduced to a 2D-only experience

Prefer this stack and architecture unless the task explicitly asks for an alternative:

- React with functional components and hooks
- Vite-style browser build pipeline
- Three.js with React Three Fiber for 3D scene rendering
- React-managed HTML and CSS overlays for menus, controls, and accessibility-first UI
- Lightweight physics only where it adds value

Important architectural rule:

- React should own app shell concerns such as layout, overlays, menus, orientation handling, scene selection, loading states, accessibility, and coarse UI state
- The render engine should own per-frame animation, scene graph updates, particles, and other high-frequency work

Do not push every animation or continuously changing value through React state.

## React Best Practices

When generating React architecture or code, follow these rules:

- Use functional components only
- Keep component boundaries clear and purposeful
- Separate app-shell UI from render-loop-heavy scene logic
- Use refs for frame-driven values instead of causing unnecessary React re-renders
- Keep state minimal, local where possible, and derived where practical
- Avoid duplicated state
- Lazy-load heavyweight scenes and world modules
- Split code by scene or world to reduce initial bundle cost
- Clean up all effects, listeners, timers, and animation subscriptions
- Handle resize and orientation changes explicitly
- Prefer declarative composition for UI and scene orchestration
- Memoize only when there is a concrete stability or performance reason
- Design for touch-first input while remaining usable with mouse and keyboard
- Keep non-scene controls accessible and semantically structured
- Treat loading, error, and degraded-performance states as first-class flows

## Performance Requirements

Target a smooth experience on modern mobile devices.

Performance guidance:

- Prioritize stable frame time over visual excess
- aim for high perceived fidelity through strong art direction, lighting, and materials rather than brute-force scene complexity
- Use lazy loading for toybox immersive scenes
- Reuse geometry, materials, and textures where possible
- Use instancing for repeated decorative elements
- Reduce effect complexity on weaker devices
- Avoid unnecessary post-processing
- Avoid large render-blocking bundles
- Minimize work during resize and orientation changes
- Keep the initial experience fast to first interaction

## Zero-Persistence Policy

No browser storage is allowed. Do not persist user or app data in any browser storage surface.

Forbidden:

- `localStorage`
- `sessionStorage`
- IndexedDB
- cookies
- Cache API for app data
- persisted service-worker app state
- any custom browser persistence mechanism

If generating code, enforce this rule explicitly:

- monkey-patch storage APIs during app bootstrap before React is loaded so blocked calls warn and then no-op safely
- ensure app state remains memory-only for the current page lifecycle
- do not introduce analytics, preferences, saves, or caches that persist data client-side

If caching is discussed, distinguish between deployment asset caching and user-data persistence. Asset caching may be used only for static build delivery and must not store application data.

## Cache-Busting and Deployment Constraints

The app must avoid stale client assets after deployment.

If generating implementation guidance, include:

- content-hashed asset filenames for JS, CSS, textures, and other static assets where possible
- a versioned build identifier exposed in the app shell
- conservative caching rules for the HTML entry document
- immutable caching only for hashed static assets
- no dependency on persistent service-worker caching
- safe invalidation behavior when a new deployment is published

Prefer build-time hashing over ad hoc timestamp hacks.

## Experience Structure

The target architecture has five structural layers:

1. World scene
2. Place scenes
3. Optional sub-place scenes
4. Literal toyboxes that open immersive toybox scenes
5. Minigame play modes launched from immersive scenes

The current implemented slice is smaller:

- a Playroom scene, still loaded through the historical `hub` scene id
- a Nature toybox immersive scene
- four minigames launched from Nature

### Playroom Scene

This is the room-level landing scene and emotional anchor of the current product slice.

Scene qualities:

- cozy child's bedroom play area
- warm afternoon light
- tactile materials such as wood, felt, stitched fabric, plastic sheen, paper stickers
- soft directional shadows
- subtle dust motes and magical ambient motion

Main layout:

- a central play rug acts as the emotional and visual focal point
- four toyboxes sit around the rug
- a toy music player sits lower in the composition
- a plush owl companion provides life and focus

Playroom behavior guidance:

- the playroom scene should clearly invite the player to tap a toybox and discover what is inside
- the owl avatar may move or fly toward taps and act as a playful companion
- transitions from the playroom to a toybox immersive scene should feel fast, magical, and low-friction

### Four Toyboxes

Each toybox is a real toy chest with its own theme and visual language:

- Adventure box: red, treasure map, pirate cues, sand and stars
- Animals box: blue, paw prints, jungle leaves, safari and pet motifs
- Creative box: green, paint splatters, crayons, glitter, craft materials
- Nature box: purple, leaves, moss, mushrooms, bugs, forest discovery

Interaction cues:

- on hover or touch, boxes should feel responsive and alive
- opening a box should feel like diving into a miniature world
- each box should communicate that multiple playful interactions exist inside it

### Owl Companion

The owl is a plush toy companion, not a realistic animal.

Behavior qualities:

- curious
- gentle
- expressive
- toy-like

The owl can idle, blink, hop, turn, react to nearby interactions, and help the world feel inhabited.

### Ambient Toy Life

The room should never feel static.

Small ambient toy behaviors may include:

- a wind-up mouse
- a toy fish sliding across the rug
- a hopping chick
- a toy car passing through
- a train circling the edge of the rug

These should be short, readable, playful loops rather than chaotic noise.

## Toybox Immersive Scenes

Opening a toybox transitions into a miniature diorama scene.

Example immersive scenes:

- Creative World: tactile craft studio with paint, clay, stickers, and squishy interactions
- Animals World: playful safari or pet world with wandering toy animals
- Adventure World: pirate-island diorama with treasure, map pieces, and discovery
- Nature World: tiny forest with moss, bugs, leaves, mushrooms, and calm exploration

Each world should:

- have a distinct material palette and mood
- feel alive with idle motion and ambient sound cues
- support touch interactions that feel tactile and toy-like
- include a clear path back to the parent scene
- contain several tappable micro-activities rather than a single rigid level

## Toybox Minigame Design

Each immersive toybox scene may contain zero or more open-ended minigame experiences.

Sub-game principles:

- open-ended toy play, not win/lose challenge design
- several tap interactions within the same world
- immediate delight on first touch
- no reading required to start playing
- rewards should be light, sensory, and celebratory
- players should be able to leave and re-enter without penalty

Design target:

- a child should be able to enter a world, tap around freely for about 1 minute, discover several reactions, receive satisfying rewards, and exit happily without ever feeling blocked

Allowed reward styles:

- sparkles
- stars
- musical chimes
- friendly character reactions
- object transformations
- confetti-like bursts
- playful audio callouts

Avoid:

- punishment
- fail states
- countdown stress
- score obsession
- long onboarding
- text-heavy tutorials

### Creative World Sub-Game Direction

Concept art direction:

- a soft craft-table diorama filled with oversized crayons, sticker sheets, clay blobs, glitter jars, paper shapes, and friendly color splashes
- the world should feel tactile, squishy, bright, handmade, and celebratory
- surfaces should invite touching, stamping, smearing, popping, or decorating

Possible tap interactions:

- tap paint blobs to make them splat into stars, flowers, or playful shapes
- tap sticker sheets to peel and place stickers onto nearby props
- tap clay blobs to squish them into animals or funny faces
- tap glitter jars to release shimmering particle puffs
- tap paper shapes to stack, spin, or snap into collages

Reward tone:

- colorful bursts, happy squish sounds, bouncing craft elements, and gentle applause-like audio textures

### Animals World Sub-Game Direction

Concept art direction:

- a toy safari and pet-play diorama with grassy mats, chunky trees, toy fences, ponds, paw prints, and soft animal figurines
- the tone should feel curious, lively, affectionate, and safe
- animals should look friendly and expressive rather than realistic or intense

Possible tap interactions:

- tap animals to trigger hops, wiggles, sounds, or tiny dances
- tap food bowls or fruit pieces to make animals gather nearby
- tap the pond to create ripples, fish pops, or splashes
- tap shrubs or grass tufts to reveal hidden critters
- tap fences, logs, or rocks to cause playful movement chains

Reward tone:

- soft animal sounds, sparkles, bouncing paws, heart motifs, and delighted reactions from nearby creatures

### Adventure World Sub-Game Direction

Concept art direction:

- a miniature pirate-island playset with toy sand, bright map fragments, treasure chests, palm trees, rope details, and a tiny ship
- the scene should feel exciting and curious, but never threatening
- discovery should feel playful and rewarding, not suspenseful or difficult

Possible tap interactions:

- tap sand patches to reveal shells, coins, stars, or hidden toy treasures
- tap map pieces to assemble playful route fragments
- tap treasure chests to release gems, confetti, or tiny creatures
- tap the pirate ship to rock it, raise sails, or fire harmless sparkle cannons
- tap parrots, crabs, or island props for character reactions

Reward tone:

- treasure sparkle bursts, cheerful jingles, spinning coins, glowing star pops, and toy-like discovery sounds

### Nature World Sub-Game Direction

Concept art direction:

- a tiny forest floor diorama with moss, mushrooms, leaves, pebbles, flowers, bugs, and a shallow stream
- the atmosphere should feel calm, magical, and full of gentle discovery
- every object should feel precious, miniature, and alive

Possible tap interactions:

- tap mushrooms to make them bounce or glow
- tap leaves to flip them and reveal ladybugs or shiny objects
- tap logs or stones to uncover bugs or forest friends
- tap the stream to create ripples, floating petals, or fish movement
- tap butterflies or fireflies to trigger drifting trails of light

Reward tone:

- twinkling light trails, soft forest chimes, tiny creature reactions, glowing spores, and calm celebratory feedback

## Product and UX Specification for Sub-Games

Sub-game UX goals:

- instant understanding through visual affordance
- delight within the first tap
- no blocking instructions
- large touch-friendly interactive zones
- repeatable, low-pressure discovery
- strong sensory reward with minimal cognitive load

Core UX rules:

- every toybox should expose 4-7 obvious tappable interaction points
- at least 2 interactions should animate or react even before the player taps, to invite exploration
- interactions should be readable at a glance on mobile screens
- rewards should happen immediately, within a fraction of a second after a tap
- some interactions may trigger nearby secondary reactions to increase surprise
- exiting the world should always be obvious and easy

Accessibility and age-fit guidance:

- no reading required for the core loop
- use icons, motion, glow, or character attention to suggest tap targets
- avoid small precision targets
- avoid hidden progression requirements
- keep audio feedback optional and supportive rather than essential

Product framing:

- describe these as "mini play experiences" or "toybox activities" rather than skill-based levels
- the value proposition is delight, discovery, repetition, and imagination
- success is measured by curiosity and joyful repetition, not challenge completion

## Camera and Composition

The camera is not top-down.

Preferred camera feeling:

- slightly elevated
- looking into the room like a child kneeling on the floor
- enough depth and parallax to feel like a physical diorama
- soft cinematic framing rather than a flat game board

Reference qualities:

- toy photography
- tilt-shift miniature worlds
- handcrafted sets

## Visual Style

Style keywords:

- rounded
- tactile
- soft
- toy-like
- colorful but warm
- magical without becoming chaotic
- high fidelity
- premium
- cinematic
- materially rich

Visual guidance:

- avoid hard edges and harsh lighting
- prefer readable silhouettes
- use material richness instead of clutter
- use playful but disciplined color systems
- text, if present, should feel friendly and readable on small screens
- favor believable fabric, wood, paper, plastic, paint, and soft-glow materials with polished shading
- use lighting, shadow softness, reflections, and atmospheric depth to create premium visual presence
- keep whimsical proportions and charm, but render props and environments with strong finish quality
- scenes should feel handcrafted and magical, not simplistic or visually thin

## Motion Philosophy

Everything should feel gently alive.

Examples:

- toyboxes subtly breathe
- the owl shifts weight and blinks
- particles drift continuously
- music notes float and fade
- idle props wobble or react softly

Motion should reinforce warmth and magic, not create distraction or motion overload.

## UX Rules

The experience should feel like a polished interactive world, not a debug scene.

UX expectations:

- clear touch targets
- responsive tap feedback
- low-friction navigation
- obvious way to return from immersive scenes
- overlays and menus that do not fight the 3D scene
- readable UI in portrait and landscape
- graceful fallback if a device cannot handle full visual fidelity

## Output Requirements

When responding to tasks using this prompt, organize the result into these sections when relevant:

1. Product / UX Intent
2. Art Direction and Scene Design
3. React Architecture and Component Breakdown
4. Rendering / Engine Notes
5. Performance and Responsive Strategy
6. Zero-Persistence and Cache-Busting Strategy
7. Risks, Tradeoffs, and Assumptions

If code is requested:

- generate production-minded React code
- keep scene systems modular
- avoid persistence APIs entirely
- include responsive and orientation-safe behavior
- include cleanup for listeners and effects
- model each toybox as a small set of reusable tappable interactions rather than a monolithic game scene
- identify `Three.js` as the rendering engine in the implementation notes

If concept art is requested:

- specify camera angle, lighting, materials, color palette, emotional tone, and composition
- keep all art direction consistent with the browser implementation constraints
- include the minigame interaction props and reward cues inside each toybox immersive scene
- keep scene direction consistent with a real-time Three.js browser rendering pipeline

If a product spec is requested:

- define goals, flows, scene structure, interaction rules, technical constraints, and acceptance criteria
- include the minigame loop, reward model, and age-appropriate tap interaction rules
- include an explicit "Engine" line naming `Three.js`

## Non-Goals

Do not assume:

- native mobile packaging as the primary target
- persistent user saves or settings
- backend-dependent gameplay for the core experience
- desktop-only controls
- top-down board-game composition
- photorealism

## Recommended Implementation Shape

Use a structure like this when proposing implementation:

`App`

- app shell
- responsive layout manager
- orientation-aware UI frame
- scene router or scene manager
- lazy-loaded world, place, and sub-place scenes
- lazy-loaded toybox immersive scenes
- shared audio controller
- shared in-memory session state
- bootstrap storage guards and cache/version checks before React renders

Possible scene modules:

- `WorldScene`
- `HouseScene`
- `PlayroomScene`
- `KitchenScene`
- `ParkScene`
- `NatureScene`

Possible UI modules:

- `SceneFrame`
- `ToyboxMenuOverlay`
- `OrientationHint`
- `AudioToggle`
- `BackButton`
- `PerformanceFallbackOverlay`

## Final Instruction

Produce work that is imaginative, high-fidelity, technically grounded, mobile-web appropriate, React-appropriate, and explicit about performance, responsiveness, cache-busting, and the zero-storage rule.

Use canonical terminology from `/docs/controlled-terminology.md`.
