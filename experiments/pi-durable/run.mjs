// Local prototype only. Do not expose this process over a network or use with
// untrusted code: CodingTools can read files and run commands as the user.
import { resolve, dirname } from 'node:path';
import { mkdir } from 'node:fs/promises';
import { BACKGROUND_CONTEXT as context } from '@earendil-works/chord/context';
import { createModels } from '@earendil-works/pi-ai/models';
import { openaiProvider } from '@earendil-works/pi-ai/providers/openai';
import { fauxProvider, fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import { AssistantEntry, createRegistry, Harness } from '@earendil-works/pi-durable';
import { NodeExecutionEnv } from '@earendil-works/pi-durable/env/node';
import { openNodeSqliteStorage } from '@earendil-works/pi-durable/storage/sqlite/node';
import { CodingTools } from '@earendil-works/pi-durable/tools';

const [workspace, storagePath, ...promptParts] = process.argv.slice(2);
const prompt = promptParts.join(' ').trim();
if (!workspace || !storagePath || !prompt) {
  console.error('Usage: node run.mjs WORKSPACE STATE.sqlite PROMPT');
  process.exit(2);
}
const cwd = resolve(workspace);
const state = resolve(storagePath);
const models = createModels();
const fake = process.env.PI_PROTOTYPE_FAUX === '1' ? fauxProvider() : undefined;
if (fake) {
  fake.setResponses([fauxAssistantMessage('Prototype response.')]);
  models.setProvider(fake.provider);
} else {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is required for a real model.');
  models.setProvider(openaiProvider());
}
const model = fake?.getModel();
const modelConfig = model ? { provider: model.provider, modelId: model.id } : {
  provider: 'openai', modelId: process.env.PI_MODEL || 'gpt-5.6-luna'
};
const registry = createRegistry();
registry.install(CodingTools);
await mkdir(dirname(state), { recursive: true });
const harness = await Harness.open(await openNodeSqliteStorage(state), {
  models, registry, env: ({ cwd: conversationCwd }) => new NodeExecutionEnv({ cwd: conversationCwd ?? cwd })
}, context);
try {
  const root = await harness.root(context, { agent: { cwd, model: modelConfig } });
  harness.resume();
  const submission = await root.submit({ type: 'input', content: prompt }, context);
  const settled = await submission.wait(context);
  if (settled.status !== 'done' || settled.type !== 'input') {
    console.error('Agent did not complete:', settled.status);
    process.exitCode = 1;
  } else {
    const answer = await root.commit((tx) => tx.entry(AssistantEntry, settled.answer), context);
    for (const message of answer?.model ?? []) {
      for (const block of message.content ?? []) if (block.type === 'text') console.log(block.text);
    }
  }
} finally {
  await harness.close(context);
}
