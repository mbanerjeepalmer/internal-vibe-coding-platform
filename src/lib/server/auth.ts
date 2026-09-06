import { betterAuth } from 'better-auth';
import { magicLink } from 'better-auth/plugins';
import { Resend } from 'resend';
import { extractEmailAddress, formatSender, renderEmailHtml } from './email-branding';

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
				async sendMagicLink({ email, url, metadata }) {
					// Email security gateways (Mimecast, Outlook Safe Links, Proofpoint)
					// pre-fetch every link in an inbound email to scan it for malware,
					// which silently consumes this single-use token before the user
					// ever clicks. Emailing a link to our own interstitial page instead
					// means the scanner's GET just renders a harmless page; the actual
					// (token-consuming) verification link only fires from a real click
					// on the "Finish signing in" button there.
					const realVerifyUrl = new URL(url);
					const token = realVerifyUrl.searchParams.get('token') ?? '';
					const callbackURL = realVerifyUrl.searchParams.get('callbackURL') ?? '';
					const interstitialUrl = new URL('/signin/verify', realVerifyUrl.origin);
					interstitialUrl.searchParams.set('token', token);
					if (callbackURL) interstitialUrl.searchParams.set('callbackURL', callbackURL);
					const linkUrl = interstitialUrl.toString();

					const providedName =
						typeof metadata?.name === 'string' ? metadata.name.trim() : '';
					const greetingName = providedName || email.split('@')[0];

					const result = await resend.emails.send({
						from: formatSender(from),
						replyTo: extractEmailAddress(from),
						to: email,
						subject: 'Sign in to Vibe Kitchen',
						text: `Hi ${greetingName},\n\nUse this secure link to sign in to Vibe Kitchen. It expires in 15 minutes and can only be used once:\n${linkUrl}\n\nIf you didn't request this, you can safely ignore this email — no changes will be made to your account.\n\n— The Vibe Kitchen team`,
						html: renderEmailHtml({
							preheader: 'Your secure sign-in link expires in 15 minutes.',
							heading: `Hi ${greetingName},`,
							bodyHtml: `<p style="margin:0;">Click the button below to sign in to <strong>Vibe Kitchen</strong>. This link is valid for 15 minutes and can only be used once.</p>`,
							ctaLabel: 'Sign in to Vibe Kitchen',
							ctaUrl: linkUrl,
							footerHtml:
								"If you didn't request this, you can safely ignore this email — no changes will be made to your account."
						})
					});

					if (result.error) {
						throw new Error(`Resend could not deliver the magic link: ${result.error.message}`);
					}
				}
			})
		]
	});
}
