// Tests for the seeded PRNG (js/rng.js). Pure module, no engine/DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, hashSeed } from '../js/rng.js';

test('makeRng: same seed produces the same next() sequence', () => {
  const a = makeRng(42);
  const b = makeRng(42);
  const seqA = [a.next(), a.next(), a.next(), a.next()];
  const seqB = [b.next(), b.next(), b.next(), b.next()];
  assert.deepEqual(seqA, seqB);
});

test('makeRng: different seeds diverge', () => {
  const a = makeRng(1);
  const b = makeRng(2);
  const seqA = [a.next(), a.next(), a.next()];
  const seqB = [b.next(), b.next(), b.next()];
  assert.notDeepEqual(seqA, seqB);
});

test('next() stays within [0, 1)', () => {
  const r = makeRng('kill-a-tower');
  for (let i = 0; i < 1000; i++) {
    const v = r.next();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});

test('int(n) stays within [0, n)', () => {
  const r = makeRng(7);
  for (let i = 0; i < 1000; i++) {
    const v = r.int(6);
    assert.ok(Number.isInteger(v) && v >= 0 && v < 6, `value ${v} out of range`);
  }
});

test('shuffle returns a permutation of the input and does not mutate it', () => {
  const input = [1, 2, 3, 4, 5, 6, 7, 8];
  const r = makeRng(99);
  const out = r.shuffle(input);
  // input untouched
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6, 7, 8]);
  // same multiset of elements
  assert.deepEqual([...out].sort((a, b) => a - b), [...input].sort((a, b) => a - b));
  // new array (not the same reference)
  assert.notEqual(out, input);
});

test('shuffle is deterministic for a fixed seed', () => {
  const input = ['a', 'b', 'c', 'd', 'e'];
  const o1 = makeRng(555).shuffle(input);
  const o2 = makeRng(555).shuffle(input);
  assert.deepEqual(o1, o2);
});

test('pick returns an element of the array; undefined for empty', () => {
  const r = makeRng(3);
  const arr = ['x', 'y', 'z'];
  for (let i = 0; i < 50; i++) assert.ok(arr.includes(r.pick(arr)));
  assert.equal(r.pick([]), undefined);
});

test('hashSeed: strings hash to a 32-bit uint and are stable', () => {
  const h1 = hashSeed('hello');
  const h2 = hashSeed('hello');
  assert.equal(h1, h2);
  assert.ok(Number.isInteger(h1) && h1 >= 0 && h1 <= 0xffffffff);
  assert.notEqual(hashSeed('hello'), hashSeed('world'));
});

test('string and number seeds are both usable and reproducible', () => {
  const s1 = makeRng('seed-string');
  const s2 = makeRng('seed-string');
  assert.equal(s1.next(), s2.next());
});

test('fork produces an independent but deterministic sub-stream', () => {
  const a1 = makeRng(10).fork('child');
  const a2 = makeRng(10).fork('child');
  assert.equal(a1.next(), a2.next());
});
