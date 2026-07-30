/**
 * PROP REACTION CHANNELS — what a room tap has to answer with, and why.
 *
 * Round 2 of `docs/reviews/2026-07-30-rooms-five-rounds.md` set out to prove that a
 * room prop's tap reaction is indistinguishable from a missed tap, on the grounds
 * that both emit the same `PARTICLES.sceneSparkle` burst and that a prop's own
 * gsap tween would be a few pixels against it. The render probe refuted that: the
 * nine emitting props move 1.24x-2.34x as many pixels as their own burst. The
 * prediction was wrong because it compared a DISPLACEMENT against an AREA.
 *
 * That refutation is what this suite protects, and it has an exposed flank. The
 * whole distinction between "you found something" and "you touched a wall" now
 * rests on ONE channel:
 *
 *   - the sound cannot carry it. soul.md's Sound World clause — "A muted
 *     experience must be fully playable and emotionally complete" — bars it, and
 *     `interactionController.fire` actively collapses it: a handler that makes no
 *     sound of its own has the shared acknowledgement played for it, cue and all.
 *     (Round 2 first wrote that cue up as "the miss's own cue". Its own docstring
 *     in `uiSounds.ts` refutes that — "a gentle acknowledgement chirp for
 *     tap-fallback feedback" — so it is the GENERIC acknowledgement, which the
 *     miss merely also uses. That correction weakens nothing here: a cue both
 *     outcomes share still cannot distinguish them.)
 *   - the burst cannot carry it. Every authored room reaction emits the same
 *     preset the miss handler emits, so the burst is shared by construction.
 *   - `createTapInteraction` adds nothing. It is a pass-through to
 *     `dispatcher.register`, so there is no shared highlight, flash or squash that
 *     a prop gets for free.
 *
 * So the prop's own transform tween is the entire per-prop visual channel. Delete
 * one tween and that reaction silently becomes burst-only — which is exactly the
 * charge the round could not otherwise prove. Nothing in the repository asserted
 * that the tweens exist. Now something does.
 *
 * Round 2 then found, by parsing what it had assumed, a defect the render probe's
 * own exclusion rule had been about to hide: three Playroom handlers emit NO burst
 * at all and fall through to the fallback sound, so since Round 1 gave the miss a
 * sparkle those three hits are answered less richly than a miss. The last two
 * tests here pin the repair; both were confirmed to FAIL against the source as it
 * stood when they were written, which is the only way to know they can.
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
const read = (...parts) => readFileSync(path.join(packageRoot, 'src', ...parts), 'utf8');
const ROOMS_DIR = ['scenes', 'world', 'places', 'house', 'subplaces'];
const ROOMS = ['playroom', 'kitchen', 'living-room'];

/** The miss's audible cue, from `worldTapDispatcher.ts`. A hit must not use it. */
const FALLBACK_SOUND = 'sfx_shared_tap_fallback';

/**
 * Every `.ts` file under a room's directory, recursively.
 *
 * @param room - Room directory name.
 * @returns Paths relative to the package's `src`, so `read` can take them.
 */
function roomFiles(room) {
  const out = [];
  const walk = (parts) => {
    const dir = path.join(packageRoot, 'src', ...parts);
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk([...parts, entry.name]);
      else if (entry.name.endsWith('.ts')) out.push([...parts, entry.name]);
    }
  };
  walk([...ROOMS_DIR, room]);
  return out;
}

/**
 * Brace-matches a block starting at the first `{` at or after `from`.
 *
 * Scoping every assertion to the enclosing handler is the point: a file-wide
 * `gsap.to(x.rotation)` search would be satisfied by the prop's idle sway, which
 * runs whether the child taps or not and therefore cannot answer a tap.
 *
 * @param src - Source text.
 * @param from - Index to start looking for the opening brace.
 * @returns The block including both braces, or null if unbalanced.
 */
function blockFrom(src, from) {
  const open = src.indexOf('{', from);
  if (open < 0) return null;
  let depth = 0;
  for (let i = open; i < src.length; i += 1) {
    if (src[i] === '{') depth += 1;
    else if (src[i] === '}') {
      depth -= 1;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

/**
 * Paren-matches one call's argument list and returns its arguments split at the
 * top level, so a nested object or call cannot be mistaken for an argument break.
 *
 * @param src - Source text.
 * @param openParen - Index of the call's `(`.
 * @returns Top-level argument strings, or null if unbalanced.
 */
function callArgs(src, openParen) {
  let depth = 0;
  let start = openParen + 1;
  const args = [];
  for (let i = openParen; i < src.length; i += 1) {
    const c = src[i];
    if (c === '(' || c === '[' || c === '{') depth += 1;
    else if (c === ')' || c === ']' || c === '}') {
      depth -= 1;
      if (depth === 0) {
        args.push(src.slice(start, i));
        return args;
      }
    } else if (depth === 1 && c === ',') {
      args.push(src.slice(start, i));
      start = i + 1;
    }
  }
  return null;
}

/**
 * Every tap handler body in a room file, with the two registration mechanisms the
 * rooms actually use.
 *
 * Kitchen and Living Room register through `createTapInteraction`. Playroom still
 * assigns `userData.onClick`, which `roomSceneFactory.registerUserDataClickTargets`
 * bridges into the same dispatcher — a migration bridge, not a second system, and
 * a separate test below pins that the bridge is still wired. Both forms are
 * collected here because a child cannot tell which API a prop was authored with.
 *
 * @param src - Source text of one room file.
 * @returns One entry per handler, with its brace-matched body.
 */
function handlersIn(src) {
  const found = [];
  const add = (kind, target, at) => {
    const body = blockFrom(src, at);
    found.push({ kind, target, body, line: src.slice(0, at).split('\n').length });
  };
  for (const m of src.matchAll(/createTapInteraction\(\s*[^,]+,\s*([A-Za-z0-9_.[\]]+)\s*,\s*\(\s*\)\s*=>/g)) {
    add('createTapInteraction', m[1], m.index + m[0].length);
  }
  for (const m of src.matchAll(/([A-Za-z0-9_.[\]]+)\.userData\.onClick\s*=\s*\(\s*\)\s*=>/g)) {
    add('userData.onClick', m[1], m.index + m[0].length);
  }
  // `mesh.userData.onClick = driveHandler;` — the handler is a named const
  // elsewhere in the file. Resolving the name matters: both Playroom toy cars are
  // authored this way, and an inline-only parser would report them as absent
  // rather than as unpinned, which is the failure mode that flatters a suite.
  for (const m of src.matchAll(/\.userData\.onClick\s*=\s*([A-Za-z_$][\w$]*)\s*;/g)) {
    const name = m[1];
    if (name === 'onClick') continue;
    const def = new RegExp(`const\\s+${name}\\s*=\\s*\\([^)]*\\)\\s*=>`).exec(src);
    if (def) add(`userData.onClick -> ${name}`, name, def.index + def[0].length);
  }
  return found;
}

const TRANSFORM = /\.(position|rotation|scale|quaternion)$/;

/**
 * The transform tweens inside one handler body.
 *
 * A tween is counted only if its FIRST argument is a transform channel of some
 * object. `gsap.to(spotLight, { intensity })` and `gsap.to(bulbMat.emissive, ...)`
 * are real animation and are deliberately not counted: a light brightening is not
 * the prop moving, and the round's measurement was of moved pixels on the prop.
 * Chained `.to()` off a `gsap.timeline()` counts, because three of the twelve
 * handlers are authored that way.
 *
 * @param body - Brace-matched handler body.
 * @returns The first argument of each transform tween found.
 */
function transformTweens(body) {
  const out = [];
  for (const m of body.matchAll(/\.(to|from|fromTo)\s*\(/g)) {
    const args = callArgs(body, m.index + m[0].length - 1);
    if (!args || args.length === 0) continue;
    const first = args[0].trim();
    if (TRANSFORM.test(first)) out.push(first);
  }
  return out;
}

const HANDLERS = ROOMS.flatMap((room) =>
  roomFiles(room).flatMap((parts) => handlersIn(read(...parts)).map((h) => ({ ...h, room, file: parts.slice(ROOMS_DIR.length + 1).join('/') }))),
);

test('the handler parser finds the room reactions it claims to grade', () => {
  // Without this, every assertion below passes vacuously the moment the source
  // moves to a registration form the parser does not know. The counts are pinned
  // by value, not by ">= 1", so ADDING an unparsed prop is also a failure here.
  assert.equal(HANDLERS.length, 12, `expected 12 room tap handlers, parsed ${HANDLERS.length}`);
  for (const h of HANDLERS) assert.ok(h.body, `${h.room}/${h.file}:${h.line} handler body did not brace-match`);
  const perRoom = Object.fromEntries(ROOMS.map((r) => [r, HANDLERS.filter((h) => h.room === r).length]));
  assert.deepEqual(perRoom, { playroom: 5, kitchen: 3, 'living-room': 4 });
  // Both mechanisms must still be represented, or the parser has gone half-blind.
  assert.equal(HANDLERS.filter((h) => h.kind === 'createTapInteraction').length, 7);
  assert.equal(HANDLERS.filter((h) => h.kind.startsWith('userData.onClick')).length, 5);
  assert.equal(HANDLERS.filter((h) => h.kind.includes('->')).length, 2, 'both named-const handlers must resolve');
});

test('every room tap reaction moves the thing that was tapped', () => {
  // The entire per-prop visual channel. See this file's header for why the sound
  // and the burst cannot carry the distinction instead.
  for (const h of HANDLERS) {
    const tweens = transformTweens(h.body);
    assert.ok(
      tweens.length >= 1,
      `${h.room}/${h.file}:${h.line} (${h.kind} on ${h.target}) has no transform tween, so its reaction is burst-only and reads as a miss`,
    );
    assert.ok(/\bgsap\b/.test(h.body), `${h.room}/${h.file}:${h.line} tweens a transform without gsap, which is not how this codebase animates`);
  }
});

test('every room tap reaction emits a burst of its own', () => {
  // Round 1 gave a MISSED room tap a `sceneSparkle` at the touched surface. Any
  // prop that emits nothing is therefore answered more poorly than empty space,
  // which inverts soul.md#1 — "Wonder is the reward" — at exactly the moment the
  // child has found something.
  for (const h of HANDLERS) {
    assert.match(
      h.body,
      /PARTICLES\.\w+/,
      `${h.room}/${h.file}:${h.line} (${h.kind} on ${h.target}) emits no particle burst, so a miss at the same spot is answered more richly than this hit`,
    );
  }
});

test('no room tap reaction answers a hit with the miss sound', () => {
  // `worldTapDispatcher.ts` maps `playFallback` to this cue and
  // `interactionController.acknowledgeTap` plays it for any tap nothing else
  // answered. A handler that plays it ITSELF is doing the controller's job badly:
  // it ticks the sound counter, so the controller concludes the prop answered and
  // withholds the sparkle — the handler buys the cue at the price of the picture,
  // which on a muted device is the whole answer. soul.md's Promise: "Nothing will
  // confuse you."
  assert.match(read('utils', 'worldTapDispatcher.ts'), new RegExp(`playFallback:\\s*\\(\\)\\s*=>\\s*triggerSound\\('${FALLBACK_SOUND}'\\)`));
  for (const h of HANDLERS) {
    assert.doesNotMatch(
      h.body,
      new RegExp(`triggerSound\\(\\s*'${FALLBACK_SOUND}'`),
      `${h.room}/${h.file}:${h.line} (${h.kind} on ${h.target}) plays the miss's own cue on a successful tap`,
    );
  }
});

test('no room routes a REPEAT floor tap to the acknowledgement cue', () => {
  // The test above grades authored prop handlers. It could not see this one, because
  // the floor has no authored handler: `sceneHelpers.createFloorTap` builds it, and
  // each room configured it by data.
  //
  // All three rooms set `repeatTapSoundId: 'sfx_shared_tap_fallback'`, AND SO DID
  // `templates/room-scene/environment.ts`, so the generator would have minted the
  // defect into every room built after it. Measured in all three
  // (`.probe/render/r2-floor.mjs`): first tap `sfx_shared_sparkle_burst` + a burst,
  // every tap after it the generic acknowledgement chirp and NO PARTICLES.
  //
  // Two things make the floor the worst possible place for it. It is registered
  // `background: true` and is one plane the size of the whole room, so it is the
  // likeliest thing a child hits; and it defeated `fire`'s safety net BY USING IT —
  // a handler that plays the acknowledgement chirp itself ticks the sound counter,
  // so the controller concluded the prop had answered and withheld the sparkle. On a
  // muted device the room's largest target did nothing at all, permanently, after one
  // tap. The repair deleted the OPTION rather than un-setting it three times, so the
  // template cannot mint it again.
  //
  // Nature is the control that shows this was a deviation and not a house style: it
  // sets neither sound id, has always fallen through to the shared acknowledgement,
  // and is the only floor that was already right.
  const helpers = read('utils', 'sceneHelpers.ts');
  const configs = [
    ['sceneHelpers.ts', helpers],
    ...ROOMS.map((room) => [`${room}/environment.ts`, read(...ROOMS_DIR, room, 'environment.ts')]),
    ['templates/room-scene/environment.ts', readFileSync(path.join(packageRoot, 'templates', 'room-scene', 'environment.ts'), 'utf8')],
  ];
  for (const [label, src] of configs) {
    // Comments are stripped first, deliberately: `sceneHelpers.ts` now carries a long
    // note NAMING the removed option, and a pin that forbids the name outright would
    // force the repair to delete its own explanation. What must not come back is the
    // option, not the memory of it.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
    assert.doesNotMatch(code, /repeatTapSoundId/, `${label} reintroduces the option whose removal was the Round 2 repair`);
    assert.doesNotMatch(
      code,
      new RegExp(FALLBACK_SOUND),
      `${label} routes a floor tap to the shared acknowledgement cue, which defeats the controller's own safety net`,
    );
  }
  // And the handler itself must have no repeat-tap sound branch at all — the option
  // could return under any name. `firstTapSoundId` is checked to still be REACHED, so
  // this cannot pass by the whole first-tap block having been deleted instead.
  const onFloorTap = blockFrom(helpers, helpers.indexOf('const onFloorTap ='));
  assert.ok(onFloorTap, 'the floor tap handler must be locatable for this pin to mean anything');
  assert.match(onFloorTap, /config\.firstTapSoundId/, 'the first tap must still get its own cue');
  assert.equal(
    (onFloorTap.match(/triggerSound\(/g) ?? []).length,
    1,
    'the floor may cue its first tap and nothing else; every later tap must fall through to the controller',
  );
  assert.doesNotMatch(onFloorTap, /\}\s*else\b/, 'a repeat-tap branch has come back under another name');
});

test('a handler that makes no sound still cannot be silent, and that is why sound cannot carry the distinction', () => {
  // Quoted so the reasoning in the header is checkable rather than remembered: the
  // controller answers for a silent handler with the SAME acknowledgement a miss
  // gets, by design. That is a good rule for soul.md#6 and a fatal one for using
  // sound to distinguish a hit from a miss.
  //
  // WHAT CHANGED, AND WHY THIS ASSERTION MOVED. When it was written, `fire` called
  // `audio.playFallback()` inline and stopped there, and this test pinned that
  // call. That inline call WAS the defect: it gave the audible half of the
  // acknowledgement and not the visible one, so an unanswered HIT came out
  // strictly poorer than a miss. `fire` now delegates to `acknowledgeTap`, which
  // supplies both halves — so pinning the old inline call would have pinned the
  // defect in place. The delegation is pinned in
  // `miss-acknowledgement.contract.test.mjs`, which owns that contract; all this
  // suite needs is the premise it argues from, namely that the controller still
  // supplies a sound the prop never asked for.
  const controller = read('utils', 'interaction', 'interactionController.ts');
  const fire = blockFrom(controller, controller.indexOf('function fire('));
  assert.ok(fire, 'interactionController.fire must be locatable for this pin to mean anything');
  assert.match(fire, /audio\.soundCount\(\)\s*===\s*before/);
  assert.match(fire, /acknowledgeTap\(/);
  const ack = blockFrom(controller, controller.indexOf('function acknowledgeTap('));
  assert.ok(ack, 'interactionController.acknowledgeTap must be locatable');
  assert.match(ack, /audio\?\.playFallback\(\)/);
});

test('createTapInteraction is still a pass-through, so no prop gets a shared visual answer for free', () => {
  // If this ever grows a highlight, flash or squash, the argument above stops
  // being true and Round 2's reasoning has to be redone. Failing here is the
  // notification that it does.
  const src = read('utils', 'tapInteraction.ts');
  // `lastIndexOf`, not `indexOf`: `createTapInteraction` is an overloaded
  // declaration, so the first two matches end in `;` and brace-matching from
  // either one walks into the NEXT docblock and matches `{@link TapOptions}`. That
  // is what this test did on its first run, and it is a reminder that a locator
  // which finds the wrong block fails loudly only by luck.
  const fn = blockFrom(src, src.lastIndexOf('export function createTapInteraction'));
  assert.ok(fn, 'createTapInteraction must be locatable');
  assert.ok(!fn.startsWith('{@link'), 'the located block must be the implementation, not a docblock');
  assert.match(fn, /dispatcher\.register\(/);
  assert.doesNotMatch(fn, /gsap|PARTICLES|emit\(/);
});

test('a prop registers several pick meshes behind one latched handler, which is why the probe must group by handler', () => {
  // Apparatus defect (vi) of Round 2. `__propTargets` enumerates the dispatcher
  // registry, which holds one entry per MESH; the desk lamp puts four meshes and
  // each toy car three behind a single function object, and every one of those
  // handlers opens with a latch. Firing per mesh means rows 2..n hit the latch and
  // measure zero moved pixels and zero emits — indistinguishable from the defect
  // this round is about, reported against the props whose repair it confirms.
  //
  // Two halves, both needed. The rooms half establishes that the hazard is real:
  // if the fan-out or the latches ever go, this test should be reconsidered rather
  // than silently kept. The probe half is the actual pin.
  const fanOut = [
    ['playroom', 'bookshelf-items/deskLamp.ts', /\[base, arm, shade, bulb\]\.forEach\(/, /if \(shining\) return;/],
    ['playroom', 'bookshelf-items/toyCar.ts', /\.forEach\(\(mesh\) => \{/, /if \(driving\) return;/],
    ['playroom', 'floorToys/toyCar.ts', /\.forEach\(\(mesh\) => \{/, /if \(driving\) return;/],
  ];
  for (const [room, file, fan, latch] of fanOut) {
    const src = read(...ROOMS_DIR, room, ...file.split('/'));
    assert.match(src, fan, `${room}/${file} no longer registers several pick meshes for one prop`);
    assert.match(src, /userData\.onClick = /, `${room}/${file} no longer shares one handler across its pick meshes`);
    assert.match(src, latch, `${room}/${file} no longer latches, so a second fire would no longer be silent`);
  }

  const probe = readFileSync(path.join(packageRoot, '.probe', 'render', 'room.ts'), 'utf8');
  // `).__reactionScan = (` — the assignment, not the interface member and not the
  // two prose mentions. `indexOf('const __reactionScan')` was tried first, found
  // nothing, and `blockFrom` then brace-matched from index 0 and returned the
  // module's IMPORT braces, which satisfied `assert.ok` and failed only on the
  // first real assertion. Test 6 above warns about exactly this; the warning was
  // not enough, so the locator is now anchored and its result is checked.
  const scanAt = probe.indexOf('.__reactionScan = (');
  assert.ok(scanAt > 0, '__reactionScan must be locatable for this pin to mean anything');
  const scan = blockFrom(probe, probe.indexOf('=> {', scanAt));
  assert.ok(scan && /__propTargets|registry/.test(scan), 'the located block must be the reaction scan body, not some earlier block');
  // THE KEY IS `userData.onClick`, NOT THE REGISTRY'S HANDLER, AND THIS ASSERTION USED
  // TO PIN THE WRONG ONE. Grouping by `entry.handler` was argued from source — the room
  // factory passes `userData.onClick` to `register` unwrapped — and published as exact
  // before it was run. `worldTapDispatcher.register` is `controller.register(target, ()
  // => handler(), opts)`, a FRESH closure per registration, so no two registry handlers
  // can ever be equal and the grouping was a no-op that looked like a fix. The first
  // Playroom run refuted it in one column: sixteen rows, every one `picks 1`. An
  // argument from source about what an identity MEANS is not an observation of that
  // identity, and this pin is here so the difference stays checked.
  assert.match(
    scan,
    /userData\.onClick as unknown/,
    'the reaction scan must group by the handler the room author shared, not the closure the dispatcher wrapped it in',
  );
  assert.doesNotMatch(
    scan,
    /byHandler\.get\(entry\.handler\)/,
    'grouping by the registry handler is the refuted key: the dispatcher wraps every handler in a fresh closure, so it groups nothing',
  );
  // A key that silently degrades to one-group-per-mesh produces exactly the numbers
  // this round would have published as its finding, so the probe counts the sharing
  // itself and throws rather than trusting the key.
  assert.match(scan, /shared-handler census expects/, 'the reaction scan must throw when the grouping key disagrees with the shared-handler census');
  assert.match(scan, /for \(const group of byHandler\.values\(\)\)/, 'the reaction scan must iterate groups, not raw registry entries');
  // The union crop is not tidiness: the lamp's reaction rotates `armPivot`, which
  // `lampBase` knows nothing about, so a crop from the registered mesh alone clips
  // the reaction and reports the clipping as a small reaction.
  assert.match(scan, /cropFor\(group\.indices,/, 'the crop must be built from every pick mesh in the group');
  assert.match(scan, /pickMeshes: group\.indices\.length/, 'each row must report its group size so a regression is visible in the output');
});

test("the Playroom's legacy onClick props still reach the shared dispatcher", () => {
  // Five of the twelve handlers are `userData.onClick` assignments, which are
  // inert on their own. `registerUserDataClickTargets` is what makes them taps at
  // all; if its call site goes, Playroom loses five reactions with no other test
  // failing, and the render probe goes blind to them at the same time, because it
  // enumerates targets from the dispatcher registry.
  const factory = read('utils', 'roomSceneFactory.ts');
  assert.match(factory, /function registerUserDataClickTargets\(/);
  assert.match(factory, /scene\.traverse\(/);
  assert.match(factory, /dispatcher\.register\(object, clickHandler\)/);
  const createRoomScene = blockFrom(factory, factory.indexOf('export function createRoomScene'));
  assert.ok(createRoomScene, 'createRoomScene must be locatable');
  assert.match(createRoomScene, /registerUserDataClickTargets\(/);
});
