// Local-only experiment: not wired to Vibe Kitchen and deliberately contains
// no credentials or coding tools. Never publish this unauthenticated Worker.
import { DurableObject } from 'cloudflare:workers';
import { createModels } from '@earendil-works/pi-ai/models';
import { fauxProvider, fauxAssistantMessage } from '@earendil-works/pi-ai/providers/faux';
import { createRegistry, Harness } from '@earendil-works/pi-durable';
import { PiHarness } from 'agents/harness/pi';
import { Lifecycle } from 'agents/lifecycle';

export class Assistant extends DurableObject {
  registry = createRegistry();
  faux = fauxProvider();
  harness = new PiHarness({
    harness: ({ storage, context, onWake }) => {
      const models = createModels();
      this.faux.setResponses([fauxAssistantMessage('Local Pi Durable response.')]);
      models.setProvider(this.faux.provider);
      return Harness.open(storage, { models, registry: this.registry, onWake }, context);
    },
    defaults: { model: this.faux.getModel() }
  });
  lifecycle = Lifecycle.install(this).use(this.harness);

  async submit(input, operationId) {
    const receipt = await this.harness.submit(input, { operationId });
    const result = await this.harness.wait(receipt.operationId);
    return { accepted: receipt.accepted, status: result.status, text: result.text };
  }
}

export default {
  async fetch(request, env) {
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
    const { session, operationId, prompt } = await request.json();
    if (![session, operationId, prompt].every(x => typeof x === 'string' && x.length > 0 && x.length <= 256)) {
      return new Response('Invalid input', { status: 400 });
    }
    return Response.json(await env.ASSISTANT.getByName(session).submit(prompt, operationId));
  }
};
