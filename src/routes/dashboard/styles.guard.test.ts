/**
 * Dashboard style guard — keeps every tab, panel and modal on the shared
 * design tokens (styles/_tokens.scss) so the UI cannot drift apart again.
 *
 * Fails when a dashboard <style> block or styles/_*.scss partial:
 *   1. writes a raw hex colour            → use var(--irp-…) (ramp or semantic token)
 *   2. writes a literal font-size ≤ 21px  → use var(--irp-fs-2xs … 2xl)
 *   3. writes a literal radius 3–30px     → use var(--irp-r-2xs … 2xl | full)
 *   4. removes the outline in a :focus-visible rule without drawing a ring
 *      another way (box-shadow) — keyboard users would lose their place
 *
 * Most violations are fixed automatically by:  python3 scripts/dashboard-tokenize.py
 * The few colours that are deliberately off-palette are listed, with a reason,
 * in ALLOWED_HEX below. That list may only shrink.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(process.cwd(), 'src/routes/dashboard');

// Files that DEFINE the system, or deliberately mirror another medium.
const EXEMPT = new Set([
  'styles/_tokens.scss',
  'styles/_mixins.scss',
  'styles/_primitives.scss',
  'styles/_foundation.scss',
  'styles/irp-tokens.scss',
  // Mirrors the server-rendered PDF invoice, which has its own print palette.
  'components/InvoiceDocument.svelte',
]);

// Off-palette colours kept on purpose. file → hex → reason.
const ALLOWED_HEX: Record<string, Record<string, string>> = {
  'styles/_detail-activity.scss': {
    '#ec4899': 'categorical activity-type colour (field edits); every other ramp hue is taken',
  },
};

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) return files(p);
    if (p.endsWith('.svelte')) return [p];
    if (p.endsWith('.scss') && dir.endsWith('styles')) return [p];
    return [];
  });
}

function styleOf(path: string): string {
  const src = readFileSync(path, 'utf8');
  const css = path.endsWith('.scss')
    ? src
    : [...src.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n');
  // Drop comments, url(...) payloads and SCSS colour-function arguments.
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/url\([^)]*\)/g, 'url()')
    .replace(/\b(rgba?|mix|darken|lighten|transparentize|color\.[a-z]+)\(([^()]|\([^()]*\))*\)/g, '$1()');
}

type Hit = { file: string; line: string };
const scan = () => {
  const out = { hex: [] as Hit[], font: [] as Hit[], radius: [] as Hit[], focus: [] as Hit[] };
  for (const path of files(ROOT)) {
    const file = relative(ROOT, path).replaceAll('\\', '/');
    if (EXEMPT.has(file)) continue;
    const css = styleOf(path);
    const allowed = ALLOWED_HEX[file] ?? {};
    for (const line of css.split('\n')) {
      // Ignore SCSS variable definitions — they only feed compile-time maths.
      if (/^\s*\$[\w-]+\s*:/.test(line)) continue;
      for (const m of line.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
        if (!(m[0].toLowerCase() in allowed)) out.hex.push({ file, line: line.trim() });
      }
      for (const m of line.matchAll(/font-size\s*:\s*(\d*\.?\d+)(px|rem)\b/g)) {
        const px = parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1);
        if (px <= 21) out.font.push({ file, line: line.trim() });
      }
      const r = line.match(/(?:^|[\s;{])border(?:-[a-z]+)*-radius\s*:\s*([^;}]+)/);
      if (r) {
        for (const v of r[1].matchAll(/(?<![\w.(-])(\d*\.?\d+)(px|rem)\b/g)) {
          const px = parseFloat(v[1]) * (v[2] === 'rem' ? 16 : 1);
          if (px >= 3 && px <= 30) out.radius.push({ file, line: line.trim() });
        }
      }
    }
    for (const m of css.matchAll(/([^{}]*:focus-visible[^{}]*)\{([^{}]*)\}/g)) {
      const removed = /outline\s*:\s*(none|0)\b/.test(m[2]);
      const replaced = /box-shadow\s*:/.test(m[2]); // a visible ring drawn another way is fine
      const container = /overlay|backdrop/.test(m[1]); // programmatic-focus shells (see _foundation.scss)
      if (removed && !replaced && !container) out.focus.push({ file, line: m[1].trim() });
    }
  }
  return out;
};

const fmt = (hits: Hit[]) => hits.slice(0, 25).map((h) => `  ${h.file}: ${h.line}`).join('\n');

describe('dashboard styles stay on the design tokens', () => {
  const r = scan();
  it('uses no raw hex colours (var(--irp-…) instead)', () => {
    expect(r.hex, `Raw hex colours — run scripts/dashboard-tokenize.py:\n${fmt(r.hex)}`).toEqual([]);
  });
  it('uses the type scale for every font-size ≤ 21px (var(--irp-fs-…))', () => {
    expect(r.font, `Off-scale font sizes:\n${fmt(r.font)}`).toEqual([]);
  });
  it('uses the radius scale (var(--irp-r-…))', () => {
    expect(r.radius, `Off-scale radii:\n${fmt(r.radius)}`).toEqual([]);
  });
  it('never removes the keyboard focus outline', () => {
    expect(r.focus, `outline: none inside :focus-visible:\n${fmt(r.focus)}`).toEqual([]);
  });
});
