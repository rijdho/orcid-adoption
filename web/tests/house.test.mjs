// The house style is a copy of the house style, never a fork. Two checks:
//  1. the copy matches its lock: always runs, so an edit to src/house/house.css fails in CI;
//  2. the lock matches the original: runs when a checkout sits next to this repository, so a copy
//     that has fallen behind fails locally. When it is absent the test says so, it does not pass quietly.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';

const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex');
const copy = new URL('../src/house/house.css', import.meta.url);
const lock = JSON.parse(readFileSync(new URL('../src/house/house.lock.json', import.meta.url)));
const original = new URL('../../../house-style/house.css', import.meta.url);

test('the house.css copy is exactly what was synced', () => {
  assert.equal(sha(copy), lock.sha256, 'src/house/house.css was edited: put project styles in src/index.css and re-sync');
});

test('the synced copy is the current original', (t) => {
  if (!existsSync(original)) return t.skip('house-style checkout not next to this repository');
  assert.equal(lock.sha256, sha(original), 'house-style changed: run npm run sync-house');
});

const dataLock = JSON.parse(readFileSync(new URL('../src/house/house-data.lock.json', import.meta.url)));

test('the house-data copies are exactly what was synced', () => {
  for (const [f, hash] of Object.entries(dataLock.files))
    assert.equal(sha(new URL(`../src/house/${f}`, import.meta.url)), hash, `src/house/${f} was edited: re-sync`);
});

test('the house-data copies are the current originals', (t) => {
  if (!existsSync(original)) return t.skip('house-style checkout not next to this repository');
  for (const [f, hash] of Object.entries(dataLock.files))
    assert.equal(hash, sha(new URL(`../../../house-style/${f}`, import.meta.url)), `house-style ${f} changed: run npm run sync-house`);
});
