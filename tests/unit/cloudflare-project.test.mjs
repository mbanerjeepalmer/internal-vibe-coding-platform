import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cloudflareProject } from '../../src/lib/server/opencode/cloudflare-project.ts';

const first = '13d9fc52-4049-437e-87f2-82c125c950ad';
const second = '6db09f63-64d1-4b37-a138-fd7df22ca01e';

test('app IDs select independent bindings and status does not proxy or start', async () => {
  const calls = [];
  const namespace = { getByName(name) {
    calls.push(['get', name]);
    return {
      isRunning: async () => { calls.push(['status', name]); return false; },
      proxy: async (port) => { calls.push(['proxy', name, port]); return new Response(); }
    };
  }};
  const a = cloudflareProject(namespace, first.toUpperCase());
  const b = cloudflareProject(namespace, second);
  assert.equal(await a.isRunning(), false);
  await b.preview(8787).fetch(new Request('http://sandbox.internal/'));
  assert.deepEqual(calls, [
    ['get', `app:${first}`], ['get', `app:${second}`],
    ['status', `app:${first}`], ['proxy', `app:${second}`, 8787]
  ]);
});

test('rejects invalid app IDs before looking up a binding', () => {
  const namespace = { getByName() { throw new Error('must not look up binding'); } };
  for (const id of ['', 'app:other', '../x', first + '/x']) {
    assert.throws(() => cloudflareProject(namespace, id), /Invalid app ID/);
  }
});

test('agent and preview ports use the same app binding', async () => {
  const ports = [];
  const project = cloudflareProject({ getByName: () => ({
    isRunning: async () => true,
    proxy: async (port) => { ports.push(port); return new Response(); }
  }) }, first);
  await project.agent().fetch(new Request('http://sandbox.internal/api/health'));
  await project.preview(3000).fetch(new Request('http://sandbox.internal/'));
  assert.deepEqual(ports, [4096, 3000]);
  assert.throws(() => project.preview(0), /Invalid preview port/);
});
