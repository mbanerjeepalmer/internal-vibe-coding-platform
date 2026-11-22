import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ProbeLifecycle } from '../../prototypes/cloudflare-sandbox/lifecycle.ts';

function fixtures() {
  let stored;
  const calls = [];
  const container = {
    running: false,
    start(options) { calls.push(['start', options]); this.running = true; },
    async snapshotContainer() { calls.push(['snapshot']); return { id: 'id-1', size: 42 }; },
    async destroy() { calls.push(['destroy']); this.running = false; }
  };
  const storage = {
    async get() { return stored; },
    async put(_key, value) { calls.push(['put', value]); stored = value; }
  };
  return { calls, container, storage, lifecycle: new ProbeLifecycle(container, storage) };
}

test('starts once, saves before stopping, and restores the stored snapshot', async () => {
  const { calls, lifecycle } = fixtures();
  await lifecycle.run(async () => {});
  await lifecycle.checkpointAndStop();
  await lifecycle.run(async () => {});
  assert.equal(calls[0][1].image, 'cloudflare/debian-trixie');
  assert.deepEqual(calls.slice(1, 4), [['snapshot'], ['put', 'id-1'], ['destroy']]);
  assert.deepEqual(calls[4][1].containerSnapshot, { id: 'id-1' });
});

test('never destroys the workspace if saving the snapshot ID fails', async () => {
  const { container, storage, calls } = fixtures();
  storage.put = async () => { throw new Error('storage failure'); };
  const lifecycle = new ProbeLifecycle(container, storage);
  await lifecycle.run(async () => {});
  await assert.rejects(lifecycle.checkpointAndStop(), /storage failure/);
  assert.equal(container.running, true);
  assert.equal(calls.some(([name]) => name === 'destroy'), false);
});

test('waits for in-flight filesystem operation before checkpoint', async () => {
  const { lifecycle, calls } = fixtures();
  let release;
  const operation = lifecycle.run(() => new Promise(resolve => { release = resolve; }));
  await new Promise(resolve => setImmediate(resolve));
  const stopping = lifecycle.checkpointAndStop();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(calls.some(([name]) => name === 'snapshot'), false);
  release();
  await Promise.all([operation, stopping]);
  assert.equal(calls.some(([name]) => name === 'snapshot'), true);
});
