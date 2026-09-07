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

/** Android package name for each provider's official app, used to build an intent:// link. */
const ANDROID_PACKAGES: Record<string, string> = {
	Gmail: 'com.google.android.gm',
	Outlook: 'com.microsoft.office.outlook',
	'Yahoo Mail': 'com.yahoo.mobile.client.android.mail'
};

/**
 * Rewrites an https:// URL as an Android `intent://` link that opens
 * `androidPackage` directly instead of going through mobile Chrome — which
 * only resolves mail.google.com etc. to the app if Chrome itself already has
 * a matching Google/Microsoft/Yahoo web session, regardless of whether the
 * native app is signed in. Falls back to the plain https URL (browser_fallback_url)
 * if the app isn't installed.
 */
function androidIntentUrl(httpsUrl: string, androidPackage: string): string {
	// intent:// syntax reserves everything from "#Intent;" onward for its own
	// extras, so the target URL's own "#" (Gmail's client-side search route)
	// has to be escaped as %23 to survive as part of the target path instead
	// of being parsed as the start of the Intent block.
	const opaqueUrl = httpsUrl.replace('#', '%23').replace(/^https:\/\//, '');
	return `intent://${opaqueUrl}#Intent;scheme=https;package=${androidPackage};S.browser_fallback_url=${encodeURIComponent(httpsUrl)};end`;
}

export function getInboxSearchLink(
	recipientEmail: string,
	sendingDomain: string,
	options: { android?: boolean } = {}
): { provider: string; url: string } | null {
	if (!sendingDomain) return null;

	const at = recipientEmail.lastIndexOf('@');
	if (at === -1) return null;
	const recipientDomain = recipientEmail.slice(at + 1).toLowerCase().trim();
	const query = `from:${sendingDomain}`;

	let match: { provider: string; url: string } | null = null;

	if (GMAIL_DOMAINS.has(recipientDomain)) {
		match = {
			provider: 'Gmail',
			// in:anywhere includes Spam and Trash, which is the whole point here.
			url: `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(`${query} in:anywhere`)}`
		};
	} else if (OUTLOOK_DOMAINS.has(recipientDomain)) {
		match = {
			provider: 'Outlook',
			url: `https://outlook.office.com/mail/deeplink/search?query=${encodeURIComponent(query)}`
		};
	} else if (YAHOO_DOMAINS.has(recipientDomain)) {
		match = {
			provider: 'Yahoo Mail',
			url: `https://mail.yahoo.com/d/search/keyword=${encodeURIComponent(query)}`
		};
	}

	if (!match) return null;
	if (!options.android) return match;

	const androidPackage = ANDROID_PACKAGES[match.provider];
	return androidPackage ? { ...match, url: androidIntentUrl(match.url, androidPackage) } : match;
}
