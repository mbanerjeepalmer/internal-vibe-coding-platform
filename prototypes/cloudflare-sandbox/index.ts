// Standalone, isolated feasibility spike. This is not wired to Vibe Kitchen.
// The HTTP entry point deliberately only permits a fixed probe; arbitrary
// command execution is exposed solely as Durable Object RPC for a future,
// authorised control-plane integration.
import { DurableObject } from 'cloudflare:workers';

type Env = {
  SANDBOX_PROBE_TOKEN?: string;
  SANDBOX: DurableObjectNamespace<CloudflareSandbox>;
};

export class CloudflareSandbox extends DurableObject<Env> {
  private containerOrThrow(): Container {
    const container = this.ctx.container;
    if (!container) throw new Error('No Cloudflare container is configured for this Durable Object');
    return container;
  }

  async execute(argv: string[]): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    if (!Array.isArray(argv) || argv.length === 0 || argv.some((arg) => typeof arg !== 'string')) {
      throw new Error('A nonempty command argument array is required');
    }
    const container = this.containerOrThrow();
    if (!container.running) {
      container.start({ image: 'cloudflare/debian-trixie', entrypoint: ['sleep', 'infinity'], enableInternet: false });
    }
    const process = await container.exec(argv);
    const output = await process.output();
    const decoder = new TextDecoder();
    return { stdout: decoder.decode(output.stdout), stderr: decoder.decode(output.stderr), exitCode: output.exitCode };
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const token = env.SANDBOX_PROBE_TOKEN;
    // Fail closed unless a dedicated token is explicitly configured.
    if (!token || token.length < 32) return new Response('Probe is not configured', { status: 503 });
    const actual = request.headers.get('Authorization') ?? '';
    const expected = `Bearer ${token}`;
    const encoder = new TextEncoder();
    const actualBytes = encoder.encode(actual);
    const expectedBytes = encoder.encode(expected);
    if (actualBytes.length !== expectedBytes.length || !crypto.subtle.timingSafeEqual(actualBytes, expectedBytes)) {
      return new Response('Unauthorized', { status: 401 });
    }
    if (request.method !== 'POST' || new URL(request.url).pathname !== '/probe') {
      return new Response('Not found', { status: 404 });
    }
    try {
      const sandbox = env.SANDBOX.getByName('isolated-probe');
      const result = await sandbox.execute(['uname', '-a']);
      return Response.json(result, { status: result.exitCode === 0 ? 200 : 500 });
    } catch {
      return new Response('Container probe failed', { status: 502 });
    }
  }
};
