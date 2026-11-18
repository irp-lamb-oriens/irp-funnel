/**
 * Client identity (frontend): the only place in the app that converts between
 * a client's email and the identifiers derived from it. Mirrors the server's
 * `helper/clientIdentity.ts`; keep the two in step.
 *
 * Today a client's id is their email with `@` and `.` replaced by `_` (the
 * "legacy doc id"), and the portal lives at `/status/{id}`. The id scheme is
 * moving to a SHA-256 based id issued by the server, at which point the
 * browser stops deriving ids and asks the server instead. Until then every
 * derivation goes through here so that switch is a one-file change.
 *
 * `src/lib/clientIdentity.test.ts` fails if the conversion is written inline
 * anywhere else in `src/`.
 */

/** Canonical form of an email: surrounding whitespace removed, lowercased. */
export function normalizeEmail(email: string): string {
	return email.trim().toLowerCase();
}

/**
 * Legacy client id for an email (`john.doe@gmail.com` → `john_doe_gmail_com`).
 * Case is preserved; pass `normalizeEmail(email)` for a normalized id.
 */
export function emailToLegacyDocId(email: string): string {
	return email.replace(/[@.]/g, '_');
}

/**
 * Recover the principal client email from a legacy project id, for the portal
 * login prefill. Reverses `emailToLegacyDocId` by position:
 *   • last segment            → TLD
 *   • segment before it       → domain
 *   • everything before those → the local part, rejoined with `.`
 * e.g. "roxannefleszar_protonmail_com" → "roxannefleszar@protonmail.com"
 *      "john_doe_gmail_com"             → "john.doe@gmail.com"
 *
 * Lossy: an underscore in the original email comes back as a dot. It reveals
 * nothing new, since anyone holding the /status/:id URL can do the same.
 * Returns "" when the id can't be parsed into a plausible address.
 */
export function reconstructEmailFromProjectId(projectId: string): string {
	const segments = String(projectId ?? '').split('_');
	if (segments.length < 2) return '';
	const tld = segments.pop()!;
	const domain = segments.pop()!;
	if (!tld || !domain) return '';
	const local = segments.join('.');
	if (!local) return '';
	return `${local}@${domain}.${tld}`.toLowerCase().trim();
}

/**
 * The address the portal moves the browser to once it knows the client's
 * current reference: `/status/<reference>` WITH the query string and the
 * fragment the visitor arrived with.
 *
 * Those are part of the link: `?quoteToken=…` is what opens a quote from an
 * email and `#payment` is where a contract email lands. Dropping them when
 * swapping the id for the reference broke every such link sent before the
 * swap (found and fixed 2026-11-18).
 */
export function portalAddress(reference: string, current: { search: string; hash: string }): string {
	return `/status/${encodeURIComponent(reference)}${current.search ?? ''}${current.hash ?? ''}`;
}
