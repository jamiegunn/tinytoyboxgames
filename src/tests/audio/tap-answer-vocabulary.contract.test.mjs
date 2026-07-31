/**
 * TAP ANSWER VOCABULARY — the two things a sound id can be wrong about.
 *
 * Round 3 of `docs/reviews/2026-07-30-rooms-five-rounds.md` found the cannon and
 * the ship's wheel in the Pirate Cove both answering a successful tap with
 * `sfx_shared_tap_fallback`. `uiSounds.ts` documents that cue as "a gentle
 * acknowledgement chirp for tap-fallback feedback" — the sound a tap makes when it
 * finds NOTHING. Measured in `.probe/render/r3-cove.mjs` against a verified miss
 * baseline, a tap on the cannon and a tap on empty sky were audibly identical,
 * while four of the cove's other six answers already had a voice of their own.
 * Both files' docblocks had promised otherwise since the day they were written —
 * the cannon's says "play a 'pop' sound", the wheel's says "plays a creaking
 * sound" — so the defect was never a design decision, only an unkept promise.
 *
 * WHY A SUITE ALREADY EXISTED AND STILL DID NOT SEE THEM. `room/prop-reaction-
 * channels.contract.test.mjs` pins exactly this rule, and has since Round 2. It
 * walks `scenes/world/places/house/subplaces` and the three room names. The Pirate
 * Cove lives under `scenes/immersive-toybox-scenes`, so it was never opened. The
 * room-scoped pin is not wrong — it grades a room contract — but a rule about what
 * a tap may SOUND like has no business being scoped to a directory, because a
 * child does not know which folder a prop was authored in. This suite is that same
 * rule, unscoped: every `.ts`/`.tsx` file the app ships is read.
 *
 * The second pin here is a different failure, found while fixing the first.
 * `triggerSound(soundId: string)` and `MiniGameContext.audio.playSound(soundId:
 * string)` both take a bare `string`. `AudioProvider` looks the id up in
 * `SFX_REGISTRY` and, on a miss, warns — but only `if (import.meta.env.DEV)`. So a
 * typo'd or renamed sound id is a silently dead tap in every shipped build, in a
 * codebase whose soul.md says "A dead tap is a broken promise". Nothing checked
 * that. This suite does, and it currently PASSES: it is a regression guard, and it
 * was mutation-verified rather than assumed (see the note on each test).
 *
 * Like the other contract suites this parses source text rather than importing the
 * TS modules, so it runs under plain `node --test`.
 */

import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const srcRoot = path.join(packageRoot, 'src');

/** The cue a tap plays when it found nothing, from `worldTapDispatcher.ts`. */
const MISS_CUE = 'sfx_shared_tap_fallback';

/**
 * Every `.ts`/`.tsx` file the app ships, as paths relative to `src`.
 *
 * Deliberately the whole tree and not a scene list. The defect this suite exists
 * for was invisible to the existing pin precisely because that pin took a list of
 * directories, and the offending scene was not on it.
 *
 * @returns Relative paths, POSIX-separated.
 */
function appFiles() {
  const out = [];
  const walk = (rel) => {
    for (const entry of readdirSync(path.join(srcRoot, rel), { withFileTypes: true })) {
      const next = rel ? `${rel}/${entry.name}` : entry.name;
      if (entry.isDirectory()) walk(next);
      else if (/\.tsx?$/.test(entry.name)) out.push(next);
    }
  };
  walk('');
  return out;
}

/**
 * Source with comments removed.
 *
 * Required, not cosmetic. The repair for this very defect left long comments in
 * `cannon/interaction.ts` and `shipWheel/interaction.ts` that NAME the cue they
 * stopped playing, and `sceneHelpers.ts`, `audioEngine.ts` and
 * `interactionController.ts` all discuss it in prose. A pin that forbade the
 * string outright would force every repair to delete its own explanation — the
 * same trap `prop-reaction-channels.contract.test.mjs` records hitting on the
 * floor-tap pin.
 *
 * @param src - Raw file text.
 * @returns The same text with block and line comments blanked.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Every sound id passed as a string literal to a playback call, with its site.
 *
 * Four call forms, because a defect that hides behind an alias is still a dead
 * tap: `triggerSound` and `triggerMusic` are the scene-side bridge, `playSound` is
 * the minigame shell's equivalent (`minigames/framework/types.ts`), and both
 * bridge and shell hand the id to the same three registries in
 * `assets/audio/index.ts`.
 *
 * @param code - Comment-stripped source text.
 * @param file - Relative path, for the site label.
 * @returns One entry per literal call site.
 */
function soundLiterals(code, file) {
  const out = [];
  for (const m of code.matchAll(/\b(triggerSound|triggerMusic|playSound)\(\s*'([^']*)'\s*\)/g)) {
    out.push({ file, call: m[1], id: m[2], line: code.slice(0, m.index).split('\n').length });
  }
  return out;
}

const FILES = appFiles();
const SITES = FILES.flatMap((f) => soundLiterals(stripComments(readFileSync(path.join(srcRoot, f), 'utf8')), f));

/**
 * The ids registered in the three registries in `assets/audio/index.ts`.
 *
 * @returns Set of every registered id across SFX, MUSIC and AMBIENT.
 */
function registeredIds() {
  const registrySource = readFileSync(path.join(srcRoot, 'assets', 'audio', 'index.ts'), 'utf8');
  const ids = new Set();
  for (const name of ['SFX_REGISTRY', 'MUSIC_REGISTRY', 'AMBIENT_REGISTRY']) {
    const block = registrySource.match(new RegExp(`${name}[^=]*=\\s*\\{([\\s\\S]*?)\\n\\};`));
    assert.ok(block, `${name} object literal not found in assets/audio/index.ts`);
    for (const m of block[1].matchAll(/^\s*(?:'([^']+)'|([A-Za-z0-9_]+)):/gm)) ids.add(m[1] ?? m[2]);
  }
  return ids;
}

/**
 * The three places the miss cue may legitimately be played, each with the reason.
 *
 * An allowlist is a liability unless it is checked, so `site` is asserted to still
 * exist further down: if one of these moves or is deleted, this suite fails and
 * the entry is re-examined rather than quietly protecting nothing.
 */
const MISS_CUE_ALLOWED = [
  {
    file: 'utils/worldTapDispatcher.ts',
    site: `playFallback: () => triggerSound('${MISS_CUE}')`,
    why: 'The original caller. This IS the miss path — the dispatcher hands it to the controller as `playFallback`, and the controller plays it for a tap no handler answered.',
  },
  // 2026-07-30, ROUND 4 — THE `gamePortal.ts` ENTRY THAT USED TO SIT HERE IS GONE,
  // AND ITS DELETION IS THE POINT RATHER THAN A TIDY-UP.
  //
  // Round 3 wrote it, and its stated reason was: "The portal is not answering with the
  // miss cue; it is answering with the toybox opening and chirping underneath it."
  // That was an argument from reading two adjacent lines, granted in the very round
  // whose subject was props answering with the miss's cue, and it was wrong on both
  // limbs. `.probe/render/r4-portal.mjs` measured the portal instead of reading it:
  // `__tapThroughCanvas` returned `[sfx_shared_tap_fallback, sfx_hub_toybox_open]`,
  // so the FIRST thing a child heard on the most important tap in this application
  // was the cue for a tap that found nothing; and `__reactionScan(1.5, 0.15)` scored
  // the portal `propHigh = 0` against a displaced `sparkleHigh` of 132, in a run where
  // the chest scored 10.53x and the wheel 6.61x. The pairing the entry leaned on was
  // itself borrowed: `sfx_hub_toybox_open` is a "creaky wooden thunk" (its own
  // docblock) whose other two callers are a wooden lid and a wooden door, fired by a
  // hingeless glowing pedestal at the instant of the tap with nothing opening.
  //
  // The entry was deleted along with the line it excused, not re-argued. The portal
  // now answers with `sfx_shared_star_chime` on the frame the finger lands and
  // `sfx_shared_sparkle_burst` at the top of a visible swell, so it needs no entry
  // here — and if the miss cue ever returns to that file, the test below fails.
  {
    file: 'minigames/games/star-catcher/rules/scoring.ts',
    site: `playSound('${MISS_CUE}')`,
    why: 'A miss playing the miss cue. The enclosing function is literally `applyMissTap`, whose docblock reads "A miss is never punished ... a dead tap is a broken promise". Using the acknowledgement chirp for an acknowledged miss is the cue working as documented.',
  },
];

test('the literal scanner finds the call sites it claims to grade', () => {
  // Without this, every assertion below passes vacuously the moment a file moves,
  // an extension changes, or the call form does. Counts are pinned by VALUE, not
  // by ">= 1", so adding an unscanned call site is also a failure here — which is
  // the whole lesson of the room-scoped pin that could not see the Pirate Cove.
  //
  // THIS ASSERTION HAS ALREADY EARNED ITS KEEP ONCE, BEFORE IT WAS EVER COMMITTED.
  // The total below was first written as 47, hand-summed from a `grep` over `.ts`
  // files. The first run reported 52. The five it had missed were in `.tsx`, and the
  // scanner was right where the grep that "confirmed" it was wrong.
  assert.ok(FILES.length > 200, `expected the whole app tree, walked only ${FILES.length} files`);
  assert.ok(
    FILES.some((f) => f.startsWith('scenes/immersive-toybox-scenes/pirate-cove/')),
    "the Pirate Cove must be inside this suite's reach — being outside the room-scoped pin's reach is why Round 3 existed",
  );
  assert.ok(
    FILES.some((f) => f.startsWith('scenes/world/places/house/subplaces/playroom/')),
    'the rooms must be in reach too, so this suite is a superset of the room-scoped pin and not a replacement for a different set',
  );
  //
  // ROUND 5 MOVED THIS FROM 52 TO 58, AND THE DELTA IS ITSELF THE EVIDENCE. Six
  // new `triggerSound` sites, every one of them in the Nature scene, because
  // before Round 5 that scene contained ZERO literal sound call sites — its
  // whole eight-prop vocabulary was the dispatcher's miss cue. The number moving
  // by exactly six is the shape of that repair. Note it is six and not eight:
  // the leaf and the stone name their cues as `tapSoundId` / `revealSoundId`
  // config fields rather than as calls, so this scanner cannot see them. The
  // Round 5 pin below reads those two files directly for exactly that reason.
  assert.equal(SITES.length, 58, `expected 58 literal sound call sites, scanned ${SITES.length}`);
  const byCall = {};
  for (const s of SITES) byCall[s.call] = (byCall[s.call] ?? 0) + 1;
  assert.deepEqual(byCall, { playSound: 27, triggerSound: 30, triggerMusic: 1 });
  // Five of those `playSound` sites are in `.tsx` — the scene-transition whooshes in
  // `SceneFrame.tsx` and the button presses in `UIOverlay.tsx`. They are scanned on
  // purpose: React UI resolves ids through the same registry with the same absent
  // type safety, and a first pass of this scanner that walked only `.ts` missed all
  // five while reporting a confident total.
  assert.equal(SITES.filter((s) => s.file.endsWith('.tsx')).length, 5, 'the .tsx call sites must stay in reach');
  // Comment stripping must be doing its job, or the pin below reads prose as code.
  const cannon = SITES.filter((s) => s.file.endsWith('pirate-cove/factory/props/interactive/cannon/interaction.ts'));
  assert.equal(cannon.length, 1, 'the cannon has exactly one sound call; its comment names the old cue five times and must not be scanned');
  assert.equal(cannon[0].id, 'sfx_shared_pop');
});

test('no successful tap anywhere answers with the cue that means "you touched nothing"', () => {
  // ROUND 3'S PIN. `interactionController.acknowledgeTap` plays this cue for a tap
  // nothing else answered. A handler that plays it ITSELF is doing the controller's
  // job badly twice over: the child hears the sound of having missed, and — because
  // `fire` decides a handler answered for itself by counting sounds across the call
  // — the prop's sound ticks that counter and the shared sparkle is withheld. The
  // handler buys the miss's cue at the price of the picture. soul.md's Promise:
  // "Nothing will confuse you."
  //
  // MUTATION-VERIFIED, 2026-07-30. Restoring `triggerSound('sfx_shared_tap_fallback')`
  // in `shipWheel/interaction.ts` — the exact line Round 3 removed — was run, and this
  // test failed with "...shipWheel/interaction.ts:38 answers a tap with the miss's
  // cue". A second mutation, spacing out the dispatcher's own call to
  // `triggerSound( 'sfx_shared_tap_fallback' )`, failed the premise assertion above,
  // so this test cannot survive its own premise quietly ceasing to be true.
  assert.match(
    readFileSync(path.join(srcRoot, 'utils', 'worldTapDispatcher.ts'), 'utf8'),
    new RegExp(`playFallback:\\s*\\(\\)\\s*=>\\s*triggerSound\\('${MISS_CUE}'\\)`),
    'the premise of this whole test — that this cue is what a MISS plays — must still hold',
  );
  const allowedFiles = new Set(MISS_CUE_ALLOWED.map((a) => a.file));
  for (const s of SITES.filter((x) => x.id === MISS_CUE)) {
    assert.ok(
      allowedFiles.has(s.file),
      `${s.file}:${s.line} answers a tap with the miss's cue. Four of the Pirate Cove's six answers already had a voice of their own; give this one its own too, or add it to MISS_CUE_ALLOWED with the reason it is a miss.`,
    );
  }
});

test('every allowlisted use of the miss cue still exists and still has its reason', () => {
  // An allowlist nobody checks is a list of rules that quietly stopped applying.
  // The gamePortal entry is the one that matters: it is allowed ONLY because the
  // chirp is paired with the toybox opening, so if the pairing is ever removed the
  // entry stops being justified and this fails rather than continuing to excuse it.
  //
  // MUTATION-VERIFIED, 2026-07-30. Deleting the `triggerSound('sfx_hub_toybox_open')`
  // line from `gamePortal.launchGame` — leaving the miss cue behind on its own,
  // which is precisely the defect the comment above that line records deleting a
  // rival helper for — was run, and this failed with "...no longer pairs it with
  // `sfx_hub_toybox_open`, which is the only reason it was allowed". Test 2 PASSED
  // during that run, because the allowlist was still excusing the file. That is the
  // point of this test: an allowlist entry has to be able to expire.
  for (const entry of MISS_CUE_ALLOWED) {
    const raw = readFileSync(path.join(srcRoot, entry.file), 'utf8');
    assert.ok(
      raw.includes(entry.site),
      `${entry.file} no longer contains the allowlisted call \`${entry.site}\` — re-examine the entry rather than keeping it`,
    );
    if (entry.alsoPlays) {
      const code = stripComments(raw);
      const at = code.indexOf(`triggerSound('${MISS_CUE}')`);
      assert.ok(at > 0, `${entry.file} allowlisted call not found in code (only in comments)`);
      assert.ok(
        code.slice(at, at + 400).includes(`triggerSound('${entry.alsoPlays}')`),
        `${entry.file} plays the miss cue and no longer pairs it with \`${entry.alsoPlays}\`, which is the only reason it was allowed`,
      );
    }
  }
});

test('every sound id a call site names is registered, because an unregistered one is silently dead forever', () => {
  // `triggerSound(soundId: string)` and `playSound(soundId: string)` both take a
  // bare string — no union, no enum, nothing the compiler can check. `AudioProvider`
  // resolves the id against `SFX_REGISTRY` and, on a miss, warns:
  //
  //     if (import.meta.env.DEV) console.warn('[audio] Unknown SFX id ...', soundId);
  //
  // In a shipped build that branch is gone and the tap makes no sound at all, with
  // nothing anywhere reporting it. A one-character typo, or a rename of the synth
  // function's registry key, and a prop is mute for good.
  //
  // This currently passes, so it is a regression guard rather than a repair — and
  // for that reason it was MUTATION-VERIFIED rather than trusted. Changing the
  // wheel's id to `sfx_pirate_cove_wheel_creek` (a plausible typo: creek/creak) was
  // run on 2026-07-30, and this test failed with "...interaction.ts:38 plays
  // 'sfx_pirate_cove_wheel_creek', which is in no registry". Note what the OTHER four
  // tests did during that run: three of them passed. A typo'd id breaks nothing a
  // grep, a compiler or any other suite here can see.
  const registered = registeredIds();
  assert.ok(registered.size > 40, `expected the three registries to be found; parsed only ${registered.size} ids`);
  assert.ok(registered.has(MISS_CUE), 'registry parsing is broken if it cannot find the most-used id in the codebase');
  for (const s of SITES) {
    assert.ok(
      registered.has(s.id),
      `${s.file}:${s.line} plays '${s.id}', which is in no registry in assets/audio/index.ts. This tap is silent in production and nothing but this test will ever say so.`,
    );
  }
});

test('the Pirate Cove props Round 3 repaired still say what their docblocks promise', () => {
  // The narrow, specific half. The pins above would be satisfied by ANY non-miss
  // cue; these two files each promised a particular one in prose long before the
  // code kept the promise, and the round's whole argument was that the prose was
  // right and the code was wrong. If the code drifts back, the prose is a lie again.
  const cove = ['scenes', 'immersive-toybox-scenes', 'pirate-cove', 'factory', 'props', 'interactive'];
  const cannon = readFileSync(path.join(srcRoot, ...cove, 'cannon', 'interaction.ts'), 'utf8');
  assert.match(cannon, /On tap: play a "pop" sound/, 'the cannon docblock is the promise this pin holds the code to');
  assert.match(stripComments(cannon), /triggerSound\('sfx_shared_pop'\)/, 'the cannon promises a pop and must play one');

  const wheel = readFileSync(path.join(srcRoot, ...cove, 'shipWheel', 'interaction.ts'), 'utf8');
  assert.match(wheel, /plays a creaking sound/, 'the ship wheel docblock is the promise this pin holds the code to');
  assert.match(stripComments(wheel), /triggerSound\('sfx_pirate_cove_wheel_creak'\)/, 'the ship wheel promises a creak and must play one');
  // The creak had to be authored — nothing in the shared catalogue creaks — so pin
  // that the synth it names is real and reachable, not just that the id resolves.
  assert.match(readFileSync(path.join(srcRoot, 'assets', 'audio', 'pirateCove', 'index.ts'), 'utf8'), /export function playSfxPirateCoveWheelCreak\(/);
});

test('every interactive Nature prop answers in a voice of its own, and four of them use the sound written for them', () => {
  // ROUND 5'S PIN. The charge was that the Nature scene's only sound was the sound
  // for failure: zero literal sound call sites in the whole tree, so all eight
  // interactive props fell through to `sfx_shared_tap_fallback` — the cue for a tap
  // that hit nothing. The runtime proof is `.probe/render/r5-nature-voice.mjs`,
  // which taps a real canvas and reads the first cue each prop emits. This is the
  // cheap source-text guard that keeps the repair from silently rotting between
  // probe runs, and it carries the same defect (xi) weakness as Round 4's pin: it
  // proves a file CONTAINS a cue name, never that a running body REACHES it.
  //
  // THE FOUR MARKED `stranded: true` ARE THE ROUND'S AGGRAVATING FACT. Each was
  // written, synthesised, named after the exact prop that exists, and registered —
  // and called zero times. The mushroom's boing is the sharpest case: a 600→200 Hz
  // sweep with a second, softer re-trigger at +0.15s, which is a sound authored for
  // a two-stage bounce, against an animation that is exactly two stages. Somebody
  // built both halves and never ran the wire. These four assertions exist so that
  // wire can never be pulled again without a test saying so.
  const nature = ['scenes', 'immersive-toybox-scenes', 'naturescene', 'factory'];
  const PROPS = [
    { what: 'mushroom', at: [...nature, 'props', 'interactive', 'mushrooms', 'interaction.ts'], cue: 'sfx_nature_mushroom_bounce', stranded: true },
    { what: 'leaf', at: [...nature, 'props', 'interactive', 'leaves', 'interaction.ts'], cue: 'sfx_nature_leaf_flip', stranded: true },
    { what: 'stream', at: [...nature, 'props', 'complex', 'stream', 'interaction.ts'], cue: 'sfx_nature_stream_splash', stranded: true },
    { what: 'butterfly', at: [...nature, 'props', 'interactive', 'butterflies', 'interaction.ts'], cue: 'sfx_nature_butterfly_flutter', stranded: true },
    { what: 'stone', at: [...nature, 'props', 'interactive', 'stones', 'interaction.ts'], cue: 'sfx_nature_stone_shift', stranded: false },
    { what: 'log', at: [...nature, 'props', 'interactive', 'log', 'interaction.ts'], cue: 'sfx_nature_log_knock', stranded: false },
    { what: 'firefly', at: [...nature, 'systems', 'fireflies', 'interaction.ts'], cue: 'sfx_nature_firefly_twinkle', stranded: false },
    { what: 'flower', at: [...nature, 'props', 'interactive', 'flowers', 'interaction.ts'], cue: 'sfx_shared_sparkle_burst', stranded: false },
  ];

  // Reuse the real registry parser rather than grepping the file. A first draft of
  // this pin matched `'${cue}'` against the raw registry source and failed on all
  // eight props — the registry writes its keys BARE (`sfx_nature_log_knock:`), not
  // quoted. That failure was the pin working: a hand-rolled second parser had
  // disagreed with the one every other test here uses.
  const registered = registeredIds();
  for (const p of PROPS) {
    const body = stripComments(readFileSync(path.join(srcRoot, ...p.at), 'utf8'));
    assert.match(body, new RegExp(`'${p.cue}'`), `the ${p.what} must name '${p.cue}' in code, not only in prose`);
    assert.doesNotMatch(body, new RegExp(MISS_CUE), `the ${p.what} must never answer a successful tap with the miss cue`);
    assert.ok(registered.has(p.cue), `'${p.cue}' must be registered, or the ${p.what} is silent in production`);
    if (p.stranded) {
      // These four were already registered and already unreferenced. Pin that the
      // reference is a real one in the prop's own file, which is the exact thing
      // that was missing for the scene's entire life before Round 5.
      assert.ok(p.cue.startsWith('sfx_nature_'), `${p.cue} was authored for Nature and must stay Nature's`);
    }
  }

  // Bar (c), pinned: the flower is the ONE prop Round 5 deliberately gave a shared
  // cue, on the argument that `sfx_shared_sparkle_burst` is already n staggered
  // tones cascading upward and the bloom is n staggered petals opening outward.
  // If a future round quietly hands the shared cue to a second prop, that argument
  // has stopped being a reasoned exception and become a default — which is the
  // failure mode bar (c) was written to catch. Wiring one shared cue to all eight
  // would clear every other assertion here and be a worse app.
  const sharedUsers = PROPS.filter((p) => p.cue.startsWith('sfx_shared_'));
  assert.equal(sharedUsers.length, 1, `exactly one Nature prop may use a shared cue; ${sharedUsers.map((p) => p.what).join(', ')} do`);

  // The two reveal props carry TWO cues on two different frames, which is Round 4's
  // lesson applied before it could be relearned: the creature is spawned in
  // `playAnimation`'s `onEnd`, so a single tap-time cue would announce a creature
  // that does not exist yet. Pin the split, and pin that both share one scurry —
  // the forest says the same thing whenever a small thing runs out from under
  // something, and a rule is worth more here than two separately clever choices.
  for (const what of ['leaves', 'stones']) {
    const body = stripComments(readFileSync(path.join(srcRoot, ...nature, 'props', 'interactive', what, 'interaction.ts'), 'utf8'));
    assert.match(body, /tapSoundId: '/, `${what} must name a cover cue`);
    assert.match(body, /revealSoundId: 'sfx_shared_critter_scurry'/, `${what} must name the shared scurry for its creature`);
  }
  //
  // PINNED BY ORDERING, NOT BY PROXIMITY. The first draft asserted the reveal cue
  // appeared within 400 characters of `onEnd:` and failed on correct code — the
  // body is longer than that. A character budget is a pin on formatting pretending
  // to be a pin on behaviour; the thing that actually matters is that the ONLY
  // `revealSoundId` call site sits after the `onEnd` that spawns the creature, and
  // after the `scene.add` that puts it on screen.
  const reveal = stripComments(readFileSync(path.join(srcRoot, 'utils', 'revealInteraction.ts'), 'utf8'));
  const revealCalls = [...reveal.matchAll(/triggerSound\(config\.revealSoundId\)/g)];
  assert.equal(revealCalls.length, 1, 'the creature cue must have exactly one call site, or this ordering pin is guessing which one it graded');
  assert.ok(
    reveal.indexOf('onEnd') < revealCalls[0].index,
    'the reveal cue must fire inside onEnd — a payoff cue before the payoff is the defect Round 4 found',
  );
  assert.ok(reveal.indexOf('scene.add(creature)') < revealCalls[0].index, 'the reveal cue must fire after the creature is actually on screen');
  // And the cover's own cue must fire at the tap, BEFORE the cover starts moving.
  const tapCalls = [...reveal.matchAll(/triggerSound\(config\.tapSoundId\)/g)];
  assert.ok(tapCalls.length >= 1, 'the cover must have a cue of its own');
  assert.ok(tapCalls.at(-1).index < reveal.indexOf('playAnimation(config.coverMesh'), 'the cover cue must fire with the finger, not after the animation');

  // AND THE PIN THAT BAR (b) BOUGHT. Gaining a voice makes `interactionController.fire`
  // withhold its shared acknowledgement sparkle, and these two covers had no particles
  // of their own until `onEnd` — so for one round the frame the finger landed on
  // answered in nothing at all, measured at 0.89 and 0.27 of the sparkle given up.
  // The invariant is not "there exists a tap particle" but the PAIRING: the frame that
  // takes the controller's sparkle away is exactly the frame that must replace it, so
  // the emit has to live inside the same `if (config.tapSoundId)` that causes the loss.
  // Pinned by ordering against the two statements that bracket that block, because a
  // brace-counting parser here would be a second, worse copy of the compiler.
  const tapEmit = reveal.indexOf('tapFn(scene,');
  assert.notEqual(tapEmit, -1, 'the cover must draw its own burst on the frame the finger lands');
  assert.ok(tapCalls.at(-1).index < tapEmit, 'the tap burst must sit after the tap cue, inside the branch the cue creates the debt in');
  assert.ok(tapEmit < reveal.indexOf('playAnimation(config.coverMesh'), 'the tap burst must be drawn with the finger, not after the cover animation');
  assert.match(
    reveal,
    /tapParticleFn \?\? \(\(s: Scene, position: Vector3\) => getParticleEngine\(s\)\.emit\(PARTICLES\.sceneSparkle, position\)\)/,
    'the default tap burst must be the miss’s own sparkle — that is what makes "no regression" a deduction rather than a hope',
  );
  // The stone overrides it, and the override must draw BOTH — which is a claim this
  // pin got wrong once already, so the history is worth stating. The first version of
  // the fix drew dust ALONE, on the honest-looking reasoning that a stone grinding
  // through soil raises dust and a leaf turning over does not; this assertion pinned
  // exactly that. Then the harness's new fourth pass measured what dust alone is
  // worth against the sparkle it displaced — 42–50 px against 417–506 px, a tenth,
  // and the preset arithmetic (additive bright yellow at opacity 0.8–1.0 and count 40,
  // versus normal-blended brown at opacity 0.25–0.4 and count 12, on a brown forest
  // floor) predicts the same factor of ten without any framebuffer. So the pin was
  // pinning a regression.
  //
  // Both halves are now load-bearing and both are pinned, in a slice of the file that
  // excludes `particleFn` — the reveal burst is also dust, and a whole-file regex here
  // would pass on the strength of the wrong emit:
  //
  //   the SPARKLE, because `interactionController.fire` withholds its shared
  //   acknowledgement from any handler that makes a sound, and that rule is a proxy
  //   that takes "answered somehow" for "answered enough". Redrawing it is what makes
  //   the no-regression claim a DEDUCTION — this emit set contains the miss's preset
  //   unmodified, so the answer contains the miss's answer.
  //
  //   the DUST, because without it the fix collapses into "make everything sparkle so
  //   the instrument can deduce a pass", which is fairy sparkle over soil: the exact
  //   pressure apparatus defect (xix) was filed against. Keep what you had, add what
  //   you earned.
  const stone = stripComments(readFileSync(path.join(srcRoot, ...nature, 'props', 'interactive', 'stones', 'interaction.ts'), 'utf8'));
  const tapFnStart = stone.indexOf('tapParticleFn:');
  assert.notEqual(tapFnStart, -1, 'the stone must override the tap burst');
  const tapFnEnd = stone.indexOf('tapSoundId:', tapFnStart);
  assert.ok(tapFnEnd > tapFnStart, 'the stone tap burst must be followed by its tap cue — the two are paired by frame');
  const stoneTapFn = stone.slice(tapFnStart, tapFnEnd);
  assert.match(
    stoneTapFn,
    /emit\(PARTICLES\.sceneSparkle, p\)/,
    'the stone must redraw the acknowledgement its voice cost it — dust alone measured a tenth of it',
  );
  assert.match(stoneTapFn, /emit\(PARTICLES\.sceneDust, p\)/, 'the stone must still raise its own dust — sparkle alone is fairy sparkle over soil');

  // And pin the three synths Round 5 had to author, because the shared catalogue's
  // nearest candidates were each rejected for a stated reason: `sfx_shared_chomp`
  // is the cue for EATING, `sfx_hub_toybox_tap` is a named prop's voice already in
  // use, and `sfx_shared_chime` is a near-twin of the GAME PORTAL's cue.
  const natureSynths = readFileSync(path.join(srcRoot, 'assets', 'audio', 'nature', 'index.ts'), 'utf8');
  for (const fn of ['playSfxNatureStoneShift', 'playSfxNatureLogKnock', 'playSfxNatureFireflyTwinkle']) {
    assert.match(natureSynths, new RegExp(`export function ${fn}\\(`), `${fn} must exist, not just be named by a registry line`);
  }
});

test('the game portal answers in its own voice, and its launch cue is earned rather than fired at the tap', () => {
  // ROUND 4'S PIN, AND ITS WEAKNESS IS STATED RATHER THAN HIDDEN. This is a
  // source-text pin, which is the apparatus defect this review filed as (xi): it can
  // prove a file CONTAINS a line, never that a running body REACHES it. The runtime
  // evidence is `.probe/render/r4-portal-after.mjs`, whose numbers are in the review
  // doc. What this test is for is the specific way the old defect could return —
  // somebody "simplifying" the tween chain back into three synchronous statements,
  // which is exactly the shape the deleted allowlist entry above used to bless.
  const raw = readFileSync(path.join(srcRoot, 'minigames', 'framework', 'gamePortal.ts'), 'utf8');
  const code = stripComments(raw);
  const body = code.slice(code.indexOf('const launchGame = ()'));
  assert.ok(body.length > 0, '`launchGame` not found — this pin has lost its subject and must be rewritten, not deleted');

  // The tap must have a voice of its own, and it must not be the miss's.
  assert.ok(
    !body.includes(`triggerSound('${MISS_CUE}')`),
    'the portal is answering the highest-stakes tap in the app with the cue for a tap that found nothing',
  );
  const tapCue = body.indexOf("triggerSound('sfx_shared_star_chime')");
  assert.ok(tapCue > 0, 'the portal must acknowledge the tap in its own voice on the frame the finger lands');

  // The launch cue must come AFTER the visible flourish, not with the tap. The
  // toybox is the control (`wireToyboxInteractions.ts:136`): its open cue lives in
  // the innermost `onComplete`, beside the navigation it announces.
  const launchCue = body.indexOf("triggerSound('sfx_shared_sparkle_burst')");
  const navCall = body.indexOf('nav.launchMiniGame(gameId)');
  assert.ok(launchCue > tapCue, 'the launch cue must follow the tap cue, not precede or replace it');
  assert.ok(navCall > launchCue, 'the navigation must be announced by the cue immediately before it');
  const beforeLaunch = body.slice(tapCue, launchCue);
  assert.match(
    beforeLaunch,
    /gsap\.to\(/,
    'nothing visible happens between the tap and the launch — a muted child would see no answer at all, which is the whole of Round 4',
  );
  assert.match(
    beforeLaunch,
    /onComplete/,
    'the launch cue is not inside a completion callback, so it fires at the instant of the tap with nothing having opened',
  );

  // The latch. Without it a double-tap fired the cue pair twice and launched twice.
  assert.match(body.slice(0, tapCue), /if \(launching\) return;/, 'a portal with no latch launches twice on a double-tap');
});

test('the portal flourish cannot outlive the scene that owns it', () => {
  // Round 4 added two tweens to a builder whose `dispose` already existed precisely
  // because `repeat: -1` tweens outlive a scene and animate detached objects forever.
  // A finite tween is a smaller version of the same bug: a tap taken in the frame
  // before a teardown leaves gsap holding a detached root and a detached material.
  const code = stripComments(readFileSync(path.join(srcRoot, 'minigames', 'framework', 'gamePortal.ts'), 'utf8'));
  const dispose = code.slice(code.indexOf('const dispose = ()'), code.indexOf('return { root, tappableMeshes, dispose }'));
  for (const target of ['icon.position', 'icon.rotation', 'root.scale', 'pedestalMat']) {
    assert.ok(dispose.includes(`gsap.killTweensOf(${target})`), `dispose does not kill the tweens on \`${target}\``);
  }
});
