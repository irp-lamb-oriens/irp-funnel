/**
 * sanitizeHtml.ts
 * Minimal HTML sanitizer for QuoteBlock `html` content.
 *
 * All block content is authored by IRP staff through the CRM (trusted source),
 * so this is a light defensive strip rather than a full allowlist sanitizer.
 * Removes the most dangerous XSS vectors:
 *   1. <script> blocks
 *   2. Inline event handlers (onclick=, onmouseover=, etc.)
 *   3. javascript: URLs in href/src attributes
 *   4. Dangerous embed elements: <object>, <embed>, <base>, <form>
 *   5. <iframe> elements EXCEPT trusted video embeds (YouTube / Vimeo / Loom …)
 *
 * ── Why iframes are partially allowed ────────────────────────────────────────
 * Staff frequently paste a YouTube/Vimeo embed into a Rich-Text block. Stripping
 * every <iframe> made those embeds silently disappear in the rendered ("compiled")
 * client document, even though the saved template string still contained them.
 *
 * IMPORTANT: this is a RENDER-TIME transform only. It never mutates the stored
 * block HTML — existing template documents in the database are untouched. We
 * simply stop discarding the embed while displaying it, and only for iframes
 * whose `src` host is on the allowlist below (https / protocol-relative only).
 * Any other iframe (e.g. an arbitrary or javascript: src) is still removed.
 *
 * If block content ever comes from untrusted user input, upgrade to DOMPurify.
 *
 * Pure function — safe to call in both browser and SSR contexts (no DOM access
 * beyond the standard `URL` constructor, which exists in browser/Deno/Node).
 */

/**
 * Hosts whose iframe embeds are considered safe to render.
 * Matched against the exact lowercased hostname of the iframe `src`.
 */
const ALLOWED_IFRAME_HOSTS: ReadonlySet<string> = new Set([
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'www.youtube-nocookie.com',
  'youtube-nocookie.com',
  'player.vimeo.com',
  'vimeo.com',
  'www.loom.com',
  'loom.com',
  'www.dailymotion.com',
  'dailymotion.com',
  'geo.dailymotion.com',
  'drive.google.com',
]);

/** Pull the raw `src` value out of an opening iframe tag (or null if absent). */
function extractIframeSrc(tag: string): string | null {
  const m = tag.match(/\ssrc\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/i);
  if (!m) return null;
  const value = m[2] ?? m[3] ?? m[4] ?? '';
  return value.trim();
}

/** Is this iframe `src` an https/protocol-relative URL on the host allowlist? */
function isAllowedIframeSrc(src: string | null): boolean {
  if (!src) return false;
  let url: URL;
  try {
    // Resolve against a dummy https base so protocol-relative ("//host/…")
    // and absolute srcs both parse; relative srcs land on the dummy host
    // (and are therefore rejected by the allowlist check below).
    url = new URL(src, 'https://sanitizer.invalid');
  } catch {
    return false;
  }
  // Only https is allowed. Protocol-relative srcs inherit the https base.
  const isProtocolRelative = src.trimStart().startsWith('//');
  if (!isProtocolRelative && url.protocol !== 'https:') return false;
  return ALLOWED_IFRAME_HOSTS.has(url.hostname.toLowerCase());
}

export function sanitizeHtml(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  return raw
    // 1. Strip <script ...>...</script> blocks (case-insensitive, multiline)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

    // 2. Strip inline event handlers: onclick="...", onmouseover='...', etc.
    //    (runs before the iframe pass, so kept iframes are also handler-free)
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')

    // 3. Replace javascript: hrefs/srcs with safe fallbacks
    //    (a javascript: iframe src becomes "#" and then fails the allowlist)
    .replace(/(href|src)\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '$1="#"')

    // 4. Filter <iframe> elements: keep trusted video embeds, drop everything
    //    else (including the inner fallback content of rejected embeds).
    //    The optional `(?:…</iframe>)?` clause matches both paired iframes and
    //    a lone opening tag, so each whole element is decided in one pass and a
    //    kept iframe's closing tag is never separately stripped.
    .replace(
      /<iframe\b[^>]*>(?:[\s\S]*?<\/iframe>)?/gi,
      (match) => (isAllowedIframeSrc(extractIframeSrc(match)) ? match : ''),
    )

    // 5. Strip remaining dangerous embed elements (keep inner text if any)
    .replace(/<\/?(?:object|embed|base|form)\b[^>]*>/gi, '');
}
