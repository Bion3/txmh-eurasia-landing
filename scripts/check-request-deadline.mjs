import assert from 'node:assert/strict';
import { withRequestDeadline } from '../src/lib/requestDeadline.js';

assert.equal(await withRequestDeadline(async () => 42, 100), 42);
await assert.rejects(withRequestDeadline(async () => { throw new Error('backend'); }), /backend/);
let signal;
await assert.rejects(withRequestDeadline((value) => {
  signal = value;
  return new Promise(() => {});
}, 10), { name: 'TimeoutError' });
assert.equal(signal.aborted, true);

// A delayed auth/lookup completion must not start an insert after timeout.
let release;
let inserted = false;
const gate = new Promise(resolve => { release = resolve; });
await assert.rejects(withRequestDeadline(async (value) => {
  await gate;
  value.throwIfAborted();
  inserted = true;
}, 10), { name: 'TimeoutError' });
release();
await new Promise(resolve => setTimeout(resolve, 0));
assert.equal(inserted, false);
console.log('Request deadline checks passed: success, error, abort, no late insert.');
