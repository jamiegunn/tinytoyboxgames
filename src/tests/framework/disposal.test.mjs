/**
 * DisposalScope contract test — behavioural.
 *
 * Enforces the three invariants in architecture-standards.md#disposalscope:
 *   1. LIFO — teardown runs in reverse registration order, so a resource is
 *      never freed before something registered after it (which may depend on it).
 *   2. Idempotent — dispose() is safe to call more than once.
 *   3. Exception-isolated — one throwing teardown never blocks the rest.
 * Plus the documented behaviours: add-after-dispose runs immediately (never
 * leaks), tween()/listener() adapters, and nested child scopes.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadTs } from './_tsload.mjs';

const { createDisposalScope } = await loadTs('src/utils/disposal.ts');

test('teardowns run in LIFO (reverse registration) order', () => {
  const scope = createDisposalScope();
  const order = [];
  scope.add(() => order.push(1));
  scope.add(() => order.push(2));
  scope.add(() => order.push(3));
  scope.dispose();
  assert.deepEqual(order, [3, 2, 1]);
});

test('dispose is idempotent — a second call is a no-op', () => {
  const scope = createDisposalScope();
  let count = 0;
  scope.add(() => count++);
  scope.dispose();
  scope.dispose();
  scope.dispose();
  assert.equal(count, 1, 'each teardown must run exactly once across repeated dispose()');
});

test('a throwing teardown does not block the others (exception isolation)', () => {
  const scope = createDisposalScope();
  const ran = [];
  scope.add(() => ran.push('a'));
  scope.add(() => {
    throw new Error('boom');
  });
  scope.add(() => ran.push('c'));
  assert.doesNotThrow(() => scope.dispose());
  // c (registered last) runs, then the thrower is skipped, then a.
  assert.deepEqual(ran, ['c', 'a']);
});

test('registering after dispose runs the teardown immediately (never leaks)', () => {
  const scope = createDisposalScope();
  scope.dispose();
  let ran = false;
  scope.add(() => {
    ran = true;
  });
  assert.ok(ran, 'add() after dispose must run the teardown right away');
});

test('tween() adapter kills anything with kill()', () => {
  const scope = createDisposalScope();
  let killed = false;
  scope.tween({ kill: () => (killed = true) });
  scope.dispose();
  assert.ok(killed, 'tween teardown must call kill()');
});

test('listener() adapter removes the exact listener on dispose', () => {
  const scope = createDisposalScope();
  const calls = [];
  const target = {
    addEventListener() {},
    removeEventListener(type, fn, opts) {
      calls.push({ type, fn, opts });
    },
  };
  const fn = () => {};
  scope.listener(target, 'click', fn, true);
  scope.dispose();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].type, 'click');
  assert.equal(calls[0].fn, fn);
  assert.equal(calls[0].opts, true);
});

test('a child scope is disposed with its parent, before earlier-registered parent teardowns', () => {
  const scope = createDisposalScope();
  const order = [];
  scope.add(() => order.push('parent-first'));
  const child = scope.child();
  child.add(() => order.push('child'));
  scope.dispose();
  // LIFO: the child (registered after 'parent-first') disposes first.
  assert.deepEqual(order, ['child', 'parent-first']);
});
