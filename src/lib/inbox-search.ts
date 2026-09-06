/**
 * Deep-links into a "search all mail" view (including Spam/Junk) for the
 * webmail providers we can reliably detect from the recipient's own address.
 * Since the point is helping people find an email that may have landed in
 * spam, unrecognized/custom domains (Workspace on a company domain, iCloud,
 * etc.) intentionally return null rather than guess at an unstable URL.
 */

const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com']);
const OUTLOOK_DOMAINS = new Set([
	'outlook.com',
	'hotmail.com',
	'live.com',
	'msn.com',
	'outlook.co.uk',
	'hotmail.co.uk',
	'hotmail.fr',
	'live.co.uk'
]);
const YAHOO_DOMAINS = new Set(['yahoo.com', 'ymail.com', 'rocketmail.com']);

export function getInboxSearchLink(
	recipientEmail: string,
	sendingDomain: string
): { provider: string; url: string } | null {
	if (!sendingDomain) return null;

	const at = recipientEmail.lastIndexOf('@');
	if (at === -1) return null;
	const recipientDomain = recipientEmail.slice(at + 1).toLowerCase().trim();
	const query = `from:${sendingDomain}`;

	if (GMAIL_DOMAINS.has(recipientDomain)) {
		return {
			provider: 'Gmail',
			// in:anywhere includes Spam and Trash, which is the whole point here.
			url: `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`${query} in:anywhere`)}`
		};
	}

	if (OUTLOOK_DOMAINS.has(recipientDomain)) {
		return {
			provider: 'Outlook',
			url: `https://outlook.office.com/mail/deeplink/search?query=${encodeURIComponent(query)}`
		};
	}

	if (YAHOO_DOMAINS.has(recipientDomain)) {
		return {
			provider: 'Yahoo Mail',
			url: `https://mail.yahoo.com/d/search/keyword=${encodeURIComponent(query)}`
		};
	}

	return null;
}
