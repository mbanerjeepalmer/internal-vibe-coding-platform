import { Resend } from 'resend';

export type MailEnv = {
	RESEND_API_KEY?: string;
	RESEND_FROM_EMAIL?: string;
};

export async function sendInvitationEmail(
	env: MailEnv,
	options: { to: string; url: string; organisationName: string; kitchenName?: string }
) {
	const apiKey = env.RESEND_API_KEY;
	const from = env.RESEND_FROM_EMAIL;
	if (!apiKey || !from) {
		throw new Error('Missing required Cloudflare secret: RESEND_API_KEY or RESEND_FROM_EMAIL');
	}

	const place = options.kitchenName
		? `the "${options.kitchenName}" Kitchen in ${options.organisationName}`
		: options.organisationName;

	const resend = new Resend(apiKey);
	const result = await resend.emails.send({
		from,
		to: options.to,
		subject: `You've been invited to ${options.organisationName} on Vibe Kitchen`,
		text: `You've been invited to join ${place} on Vibe Kitchen. Accept your invitation: ${options.url}`,
		html: `<p>You've been invited to join <strong>${place}</strong> on Vibe Kitchen.</p><p><a href="${options.url}">Accept your invitation</a></p>`
	});

	if (result.error) {
		throw new Error(`Resend could not deliver the invitation: ${result.error.message}`);
	}
}
