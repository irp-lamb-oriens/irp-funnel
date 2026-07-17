/**
 * renderMarkdown.ts
 * Render trusted, staff-authored Markdown into sanitized HTML for the
 * client-facing quote/status descriptions (per-group scope blurbs, the
 * "About this service" summary, line-item notes, …).
 *
 * Combines `marked` (Markdown → HTML) with the local `sanitizeHtml` defensive
 * strip so every description shares ONE render path (DRY). Options are passed
 * per-call — the global `marked` config is never mutated, so other consumers
 * (e.g. the country guides page) keep their existing behaviour.
 *
 * Pure + synchronous — safe in both browser and SSR contexts. Blank/absent
 * input returns '' so callers can guard with a simple `{#if}`.
 */
import { marked } from 'marked';
import { sanitizeHtml } from './sanitizeHtml.ts';

export function renderMarkdown(md: string | null | undefined): string {
  if (!md || typeof md !== 'string' || !md.trim()) return '';
  // gfm: tables/strikethrough/autolinks · breaks: single newlines → <br>
  const html = marked.parse(md, { gfm: true, breaks: true, async: false }) as string;
  return sanitizeHtml(html);
}
