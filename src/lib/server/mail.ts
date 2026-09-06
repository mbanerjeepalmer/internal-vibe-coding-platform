import { Resend } from 'resend';
import { extractEmailAddress, formatSender, renderEmailHtml } from './email-branding';

export type MailEnv = {
	RESEND_API_KEY?: string;
	RESEND_FROM_EMAIL?: string;
};

export async function sendInvitationEmail(
	env: MailEnv,
	options: {
		to: string;
		inviteeName?: string;
		url: string;
		organisationName: string;
		kitchenName?: string;
	}
) {
	const apiKey = env.RESEND_API_KEY;
	const from = env.RESEND_FROM_EMAIL;
	if (!apiKey || !from) {
		throw new Error('Missing required Cloudflare secret: RESEND_API_KEY or RESEND_FROM_EMAIL');
	}

	const place = options.kitchenName
		? `the "${options.kitchenName}" Kitchen in ${options.organisationName}`
		: options.organisationName;

	const explainer =
		"Vibe Kitchen is a platform where you describe the app you want in plain English, and an AI coding agent writes, runs, and deploys it for you — no coding required.";

	const greetingName = options.inviteeName?.trim();
	const heading = greetingName ? `Hi ${greetingName}, you're invited to join ${place}` : `You're invited to join ${place}`;

	const resend = new Resend(apiKey);
	const result = await resend.emails.send({
		from: formatSender(from),
		replyTo: extractEmailAddress(from),
		to: options.to,
		subject: `You've been invited to join ${options.organisationName} on Vibe Kitchen`,
		text: `${greetingName ? `Hi ${greetingName},\n\n` : ''}You've been invited to join ${place} on Vibe Kitchen.\n\n${explainer}\n\nAccept your invitation: ${options.url}\n\n— The Vibe Kitchen team`,
		html: renderEmailHtml({
			preheader: `You've been invited to join ${place} on Vibe Kitchen.`,
			heading,
			bodyHtml: `<p style="margin:0 0 12px 0;">${explainer}</p><p style="margin:0;">Accept the invitation below to get started.</p>`,
			ctaLabel: 'Accept your invitation',
			ctaUrl: options.url,
			footerHtml: `Not expecting this invitation? You can safely ignore this email.`
		})
	});

	if (result.error) {
		throw new Error(`Resend could not deliver the invitation: ${result.error.message}`);
	}
}
