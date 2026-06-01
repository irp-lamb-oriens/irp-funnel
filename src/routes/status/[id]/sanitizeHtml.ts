/**
 * sanitizeHtml.ts
 * Minimal HTML sanitizer for QuoteBlock `html` content.
 *
 * All block content is authored by IRP staff through the CRM (trusted source),
 * so this is a light defensive strip rather than a full allowlist sanitizer.
 * Removes the four most dangerous XSS vectors:
 *   1. <script> blocks
 *   2. Inline event handlers (onclick=, onmouseover=, etc.)
 *   3. javascript: URLs in href/src attributes
 *   4. Dangerous embed elements: <iframe>, <object>, <embed>, <base>, <form>
 *
 * If block content ever comes from untrusted user input, upgrade to DOMPurify.
 *
 * Pure function — safe to call in both browser and SSR contexts (no DOM access).
 */
export function sanitizeHtml(raw: string): string {
  if (!raw || typeof raw !== 'string') return '';

  return raw
    // 1. Strip <script ...>...</script> blocks (case-insensitive, multiline)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')

    // 2. Strip inline event handlers: onclick="...", onmouseover='...', etc.
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')

    // 3. Replace javascript: hrefs/srcs with safe fallbacks
    .replace(/(href|src)\s*=\s*["']?\s*javascript:[^"'\s>]*/gi, '$1="#"')

    // 4. Strip dangerous embed elements (strip open+close tags, keep inner text if any)
    .replace(/<\/?(?:iframe|object|embed|base|form)\b[^>]*>/gi, '');
}
