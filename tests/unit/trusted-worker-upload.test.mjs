import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prototypeDeploymentAccess, uploadPrototypeWorker, validateWorkerArtifact } from '../../src/lib/server/trusted-worker-upload.ts';

const id = '11111111-1111-4111-8111-111111111111';
const creds = { accountId: 'a'.repeat(32), apiToken: 'example-token' };

test('uploads only a fixed target and data, with credentials only in the request header', async () => {
	let called = false;
	await uploadPrototypeWorker(id, 'export default {fetch(){ return new Response("ok") }}', creds, async (url, init) => {
		called = true;
		assert.equal(url, `https://api.cloudflare.com/client/v4/accounts/${creds.accountId}/workers/scripts/vibe-prototype-${id}`);
		assert.equal(init.method, 'PUT');
		assert.equal(init.redirect, 'error');
		assert.equal(init.headers.Authorization, `Bearer ${creds.apiToken}`);
		assert.equal(JSON.parse(init.body.get('metadata')).main_module, 'worker.js');
		assert.equal(init.body.get('worker.js').type, 'application/javascript+module');
		assert.equal((await init.body.get('worker.js').text()).includes(creds.apiToken), false);
		return Response.json({ success: true });
	});
	assert.equal(called, true);
});

test('rejects invalid targets and never includes provider error contents', async () => {
	await assert.rejects(uploadPrototypeWorker('../production', 'code', creds), /Invalid app ID/);
	await assert.rejects(uploadPrototypeWorker(id, 'code', creds, async () => new Response('sensitive provider details', { status: 403 })), (error) => {
		assert.equal(error.message, 'Cloudflare Worker upload failed (HTTP 403).');
		return true;
	});
	await assert.rejects(uploadPrototypeWorker(id, '', creds), /Invalid module/);
});


test('prototype upload is opt-in and restricted to head chefs', () => {
	assert.equal(prototypeDeploymentAccess('chef', 'true'), 403);
	assert.equal(prototypeDeploymentAccess('chef'), 403);
	assert.equal(prototypeDeploymentAccess('head_chef'), 503);
	assert.equal(prototypeDeploymentAccess('head_chef', 'false'), 503);
	assert.equal(prototypeDeploymentAccess('head_chef', 'true'), null);
});


test('validates and uploads a bounded multi-module artifact', async () => {
 const artifact = { entrypoint: 'index.js', modules: { 'index.js': 'import x from "./lib/a.js"; export default x;', 'lib/a.js': 'export default {}' } };
 await uploadPrototypeWorker(id, artifact, creds, async (_url, init) => {
   assert.equal(JSON.parse(init.body.get('metadata')).main_module, 'index.js');
   assert.equal(await init.body.get('lib/a.js').text(), 'export default {}');
   return Response.json({success: true});
 });
 assert.throws(() => validateWorkerArtifact({entrypoint:'index.js', modules: {'../index.js':'x'}}));
 assert.throws(() => validateWorkerArtifact({entrypoint:'missing.js', modules: {'index.js':'x'}}));
 assert.throws(() => validateWorkerArtifact({entrypoint:'index.js', modules: {'index.js':'x'.repeat(1000001)}}));
});
