// Standalone Pi Durable experiment. No network, API key, or Vibe Kitchen resources.
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import { createModels } from '@earendil-works/pi-ai/models';
import { fauxProvider, fauxAssistantMessage, fauxToolCall } from '@earendil-works/pi-ai/providers/faux';
import { AssistantEntry, createRegistry, Harness } from '@earendil-works/pi-durable';
import { NodeExecutionEnv } from '@earendil-works/pi-durable/env/node';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';
import { CodingTools } from '@earendil-works/pi-durable/tools';

const dir = await mkdtemp(join(tmpdir(), 'vibe-pi-smoke-'));
let harness;
try {
  const faux = fauxProvider();
  const models = createModels();
  models.setProvider(faux.provider);
  const registry = createRegistry();
  registry.install(CodingTools);
  const options = { models, registry, env: ({ cwd }) => new NodeExecutionEnv({ cwd: cwd ?? dir }) };
  const open = async () => Harness.open(await openNodeSqliteStorage(join(dir, 'agent.sqlite')), options, context);
  faux.setResponses([
    fauxAssistantMessage([fauxToolCall('write', { path: 'result.txt', content: 'hello from Pi\n' })], { stopReason: 'toolUse' }),
    fauxAssistantMessage('File written.')
  ]);
  harness = await open();
  const model = faux.getModel();
  const root = await harness.root(context, { agent: { cwd: dir, model: { provider: model.provider, modelId: model.id } } });
  const request = { type: 'input', content: 'Write a file', requestId: 'smoke-1' };
  const submission = await root.submit(request, context);
  const settled = await submission.wait(context);
  assert.equal(settled.status, 'done');
  assert.equal(await readFile(join(dir, 'result.txt'), 'utf8'), 'hello from Pi\n');
  assert.ok(await root.commit((tx) => tx.entry(AssistantEntry, settled.answer), context));
  const rootId = root.id;
  const submissionId = submission.id;
  await harness.close(context);
  harness = undefined;
  harness = await open();
  harness.resume();
  const restored = await harness.root(context);
  assert.equal(restored.id, rootId);
  const retry = await restored.submit(request, context);
  assert.equal(retry.id, submissionId);
  assert.equal((await retry.wait(context)).status, 'done');
  assert.equal(faux.state.callCount, 2);
  console.log('Pi Durable: scripted coding tool, SQLite reopen and idempotent submission passed.');
} finally {
  if (harness) await harness.close(context);
  await rm(dir, { recursive: true, force: true });
}
