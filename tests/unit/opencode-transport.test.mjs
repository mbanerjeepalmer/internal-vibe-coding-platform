import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession, fetchEventStream } from '../../src/lib/server/opencode/client.ts';

test('session creation uses binding transport and preserves method and body', async () => {
  let observed;
  const target = {
    baseUrl: 'http://sandbox.internal',
    fetch: async (request) => {
      observed = { url: request.url, method: request.method, body: await request.text() };
      return Response.json({ data: { id: 'session-1' } });
    }
  };
  assert.deepEqual(await createSession(target), { id: 'session-1' });
  assert.deepEqual(observed, { url: 'http://sandbox.internal/api/session', method: 'POST', body: '{}' });
});

test('event stream uses binding transport and carries resume cursor', async () => {
  let observed;
  const target = {
    baseUrl: 'http://sandbox.internal',
    fetch: async (request) => {
      observed = request.url;
      return new Response('data: resumed\n\n');
    }
  };
  const result = await fetchEventStream(target, 'abc', '42', () => { throw new Error('network fallback used'); });
  assert.equal(new URL(observed).searchParams.get('after'), '42');
  assert.equal(await result.text(), 'data: resumed\n\n');
});

test('event stream falls back to the existing fetch when no transport is supplied', async () => {
  let called = false;
  const result = await fetchEventStream({ baseUrl: 'http://localhost:4096' }, 'abc', undefined, async () => {
    called = true;
    return new Response('ok');
  });
  assert.equal(called, true);
  assert.equal(await result.text(), 'ok');
});

test('Cloudflare targets route only through their binding and preserve the selected port', async () => {
  const { cloudflareAgentTarget, cloudflarePreviewTarget } = await import('../../src/lib/server/opencode/cloudflare-transport.ts');
  const calls = [];
  const bridge = { proxy: async (port, request) => {
    calls.push({ port, url: request.url });
    return Response.json({ data: { id: 'session-2' } });
  } };
  await createSession(cloudflareAgentTarget('project-1', bridge));
  const preview = cloudflarePreviewTarget(bridge, 8787);
  await preview.fetch(new Request(`${preview.url}/hello`));
  assert.deepEqual(calls, [
    { port: 4096, url: 'http://sandbox.internal/api/session' },
    { port: 8787, url: 'http://sandbox.internal/hello' }
  ]);
  assert.throws(() => cloudflarePreviewTarget(bridge, 65536), /Invalid preview port/);
});

test('session creation retains the existing HTTP transport and preview token', async () => {
  const previousFetch = globalThis.fetch;
  let observed;
  try {
    globalThis.fetch = async (request) => {
      observed = { url: request.url, method: request.method, token: request.headers.get('x-daytona-preview-token') };
      return Response.json({ data: { id: 'existing-session' } });
    };
    assert.deepEqual(await createSession({ baseUrl: 'https://example.test', headers: { 'x-daytona-preview-token': 'token' } }), { id: 'existing-session' });
    assert.deepEqual(observed, { url: 'https://example.test/api/session', method: 'POST', token: 'token' });
  } finally {
    globalThis.fetch = previousFetch;
  }
});
