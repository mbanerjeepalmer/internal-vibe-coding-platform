/**
 * Shared branding for transactional emails (Resend). Centralizing this keeps
 * the sign-in and invitation emails visually consistent and gives every
 * outbound message a real display name — bare "from" addresses (no display
 * name) are one of the strongest spam-filter signals for transactional mail.
 */

const BRAND_NAME = 'Vibe Kitchen';
const BRAND_EMOJI = '🍳';
const BRAND_COLOR = '#b45309'; // amber-700, matches the app's primary buttons
const BRAND_BG = '#fffbeb'; // amber-50

/** Wraps a bare address in a display name, unless one is already present. */
export function formatSender(rawFrom: string): string {
	return /<[^>]+>/.test(rawFrom) ? rawFrom : `${BRAND_NAME} <${rawFrom}>`;
}

/** Extracts the bare email address from a "Name <email>" string, or returns it unchanged. */
export function extractEmailAddress(rawFrom: string): string {
	const match = rawFrom.match(/<([^>]+)>/);
	return (match?.[1] ?? rawFrom).trim();
}

/** Extracts the domain a "from" address sends from, e.g. "vibekitchen.dev". */
export function extractSendingDomain(rawFrom: string): string {
	const address = extractEmailAddress(rawFrom);
	const at = address.lastIndexOf('@');
	return at === -1 ? '' : address.slice(at + 1).toLowerCase().trim();
}

/**
 * Renders a small, table-based HTML layout (for email-client compatibility)
 * shared by every transactional email this app sends.
 */
export function renderEmailHtml(options: {
	preheader: string;
	heading: string;
	bodyHtml: string;
	ctaLabel: string;
	ctaUrl: string;
	footerHtml?: string;
}): string {
	const { preheader, heading, bodyHtml, ctaLabel, ctaUrl, footerHtml } = options;
	return `<!DOCTYPE html>
<html lang="en">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>${heading}</title>
	</head>
	<body style="margin:0; padding:0; background-color:#f5f5f4; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
		<div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>
		<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f4; padding:32px 16px;">
			<tr>
				<td align="center">
					<table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px; width:100%; background-color:#ffffff; border-radius:12px; border:1px solid #e7e5e4; overflow:hidden;">
						<tr>
							<td style="padding:28px 32px 8px 32px;">
								<table role="presentation" cellpadding="0" cellspacing="0">
									<tr>
										<td style="width:32px; height:32px; border-radius:8px; background-color:${BRAND_BG}; text-align:center; vertical-align:middle; font-size:16px;">${BRAND_EMOJI}</td>
										<td style="padding-left:10px; font-size:14px; font-weight:600; color:#1c1917;">${BRAND_NAME}</td>
									</tr>
								</table>
							</td>
						</tr>
						<tr>
							<td style="padding:16px 32px 0 32px;">
								<h1 style="margin:0 0 16px 0; font-size:19px; color:#1c1917;">${heading}</h1>
								<div style="font-size:14px; line-height:1.6; color:#44403c;">${bodyHtml}</div>
							</td>
						</tr>
						<tr>
							<td style="padding:24px 32px 8px 32px;">
								<a href="${ctaUrl}" style="display:inline-block; background-color:${BRAND_COLOR}; color:#ffffff; text-decoration:none; font-size:14px; font-weight:600; padding:10px 22px; border-radius:8px;">${ctaLabel}</a>
							</td>
						</tr>
						<tr>
							<td style="padding:8px 32px 28px 32px;">
								<p style="margin:0; font-size:12px; line-height:1.6; color:#a8a29e; word-break:break-all;">
									Or paste this link into your browser:<br />
									<a href="${ctaUrl}" style="color:#a8a29e;">${ctaUrl}</a>
								</p>
							</td>
						</tr>
						<tr>
							<td style="padding:16px 32px; background-color:#fafaf9; border-top:1px solid #e7e5e4;">
								<p style="margin:0; font-size:12px; color:#a8a29e;">${footerHtml ?? "If you didn't request this, you can safely ignore this email."}</p>
							</td>
						</tr>
					</table>
				</td>
			</tr>
		</table>
	</body>
</html>`;
}
