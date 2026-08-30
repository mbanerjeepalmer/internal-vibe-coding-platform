import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import { Resend } from 'resend';

/** Cloudflare secrets required by the authentication service. */
export type AuthEnv = Pick<Env, 'DB'> & {
	BETTER_AUTH_SECRET?: string;
	BETTER_AUTH_URL?: string;
	RESEND_API_KEY?: string;
	RESEND_FROM_EMAIL?: string;
};

function requireSecret(env: AuthEnv, name: keyof AuthEnv): string {
	const value = env[name];
	if (typeof value !== 'string' || value.length === 0) {
		throw new Error(`Missing required Cloudflare secret: ${name}`);
	}

	return value;
}

/**
 * Builds a request-scoped auth instance so each Cloudflare request uses its
 * D1 binding and the public origin that generated its magic-link URL.
 */
export function createAuth(env: AuthEnv, requestOrigin: string) {
	const from = requireSecret(env, 'RESEND_FROM_EMAIL');
	const resend = new Resend(requireSecret(env, 'RESEND_API_KEY'));

	return betterAuth({
		database: env.DB,
		secret: requireSecret(env, 'BETTER_AUTH_SECRET'),
		baseURL: env.BETTER_AUTH_URL ?? requestOrigin,
		emailAndPassword: {
			enabled: false
		},
		plugins: [
			magicLink({
				expiresIn: 60 * 15,
				storeToken: 'hashed',
				async sendMagicLink({ email, url }) {
					const result = await resend.emails.send({
						from,
						to: email,
						subject: 'Sign in to Vibe Kitchen',
						text: `Use this secure link to sign in to Vibe Kitchen: ${url}`,
						html: `<p>Use this secure link to sign in to Vibe Kitchen:</p><p><a href="${url}">Sign in to Vibe Kitchen</a></p>`
					});

					if (result.error) {
						throw new Error(`Resend could not deliver the magic link: ${result.error.message}`);
					}
				}
			})
		]
	});
}
