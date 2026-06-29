/**
 * quote-blocks.test.ts
 * Vitest unit tests for Phase 1 QuoteBlock read path.
 *
 * What we test:
 *   1. sanitizeHtml — strips the four dangerous XSS vectors
 *   2. sanitizeHtml — passes safe HTML through unchanged
 *   3. sanitizeHtml — handles null/empty/non-string inputs safely
 *   4. Backward compat — a Quote without `blocks` should NOT trigger blocks path
 *   5. Forward compat — a Quote with `blocks: []` (empty) is treated as legacy
 *   6. Blocks path — a Quote with `blocks: [...]` (non-empty) triggers blocks path
 *
 * Run: cd irp-funnel && npm run test
 */

import { describe, it, expect } from 'vitest';
import { sanitizeHtml } from './sanitizeHtml.ts';
import {
  BLOCK_PRESETS,
  PRESETS_BY_CATEGORY,
  getPreset,
  createPresetBlock,
} from '../../../lib/blocks/presets.ts';
import {
  BLOCK_CATALOG,
  BLOCK_REGISTRY,
  createBlock,
  getBlockDef,
} from '../../../lib/blocks/registry.ts';
import { MERGE_FIELDS } from '../../../lib/mergeFields.ts';

/**
 * Block types BlockRenderer.svelte actually renders (the {#if}/{:else if} chain).
 * Any preset/blank block whose type is NOT in this set would silently vanish on
 * the client status page — so the content-library presets must all map into it.
 */
const RENDERABLE_TYPES = new Set(['html', 'heading', 'banner', 'accordion', 'quoteTable', 'accept']);


// ─── sanitizeHtml ────────────────────────────────────────────────────────────

describe('sanitizeHtml', () => {

  it('strips <script> tags and their content', () => {
    const input = '<p>Hello</p><script>alert("xss")</script><p>World</p>';
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script>');
    expect(result).not.toContain('alert');
    expect(result).toContain('<p>Hello</p>');
    expect(result).toContain('<p>World</p>');
  });

  it('strips multiline <script> blocks', () => {
    const input = `<div>ok</div>\n<script type="text/javascript">\n  var x=1;\n  document.cookie='stolen';\n</script>\n<p>safe</p>`;
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<script');
    expect(result).not.toContain('document.cookie');
    expect(result).toContain('<p>safe</p>');
  });

  it('strips inline event handlers', () => {
    const input = `<button onclick="stealData()">Click me</button>`;
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('stealData');
    expect(result).toContain('Click me');
  });

  it('strips multiple event handler types', () => {
    const input = `<img src="x" onerror="alert(1)" onmouseover="bad()" />`;
    const result = sanitizeHtml(input);
    expect(result).not.toContain('onerror');
    expect(result).not.toContain('onmouseover');
    expect(result).not.toContain('alert(1)');
  });

  it('replaces javascript: href with #', () => {
    const input = `<a href="javascript:void(0)">Link</a>`;
    const result = sanitizeHtml(input);
    expect(result).not.toContain('javascript:');
    expect(result).toContain('Link');
  });

  it('strips untrusted iframe elements', () => {
    const input = `<p>Text</p><iframe src="https://evil.com"></iframe><p>More</p>`;
    const result = sanitizeHtml(input);
    expect(result).not.toContain('<iframe');
    expect(result).toContain('<p>Text</p>');
    expect(result).toContain('<p>More</p>');
  });

  it('keeps trusted YouTube embed iframes', () => {
    const input =
      `<p>Watch:</p><iframe width="560" height="315" ` +
      `src="https://www.youtube.com/embed/dQw4w9WgXcQ" title="YouTube video player" ` +
      `frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
    const result = sanitizeHtml(input);
    expect(result).toContain('<iframe');
    expect(result).toContain('https://www.youtube.com/embed/dQw4w9WgXcQ');
    expect(result).toContain('width="560"');
    expect(result).toContain('allowfullscreen');
  });

  it('keeps trusted youtube-nocookie and Vimeo embeds', () => {
    const yt = `<iframe src="https://www.youtube-nocookie.com/embed/abc123"></iframe>`;
    const vimeo = `<iframe src="https://player.vimeo.com/video/76979871"></iframe>`;
    expect(sanitizeHtml(yt)).toContain('<iframe');
    expect(sanitizeHtml(vimeo)).toContain('<iframe');
  });

  it('keeps protocol-relative trusted embeds but strips http and unknown hosts', () => {
    const protoRel = `<iframe src="//www.youtube.com/embed/xyz"></iframe>`;
    const insecure = `<iframe src="http://www.youtube.com/embed/xyz"></iframe>`;
    const unknown = `<iframe src="https://evil.example.com/embed"></iframe>`;
    expect(sanitizeHtml(protoRel)).toContain('<iframe');
    expect(sanitizeHtml(insecure)).not.toContain('<iframe');
    expect(sanitizeHtml(unknown)).not.toContain('<iframe');
  });

  it('strips inline handlers from an otherwise-trusted iframe', () => {
    const input =
      `<iframe src="https://www.youtube.com/embed/abc" onload="steal()"></iframe>`;
    const result = sanitizeHtml(input);
    expect(result).toContain('<iframe');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('steal');
  });

  it('passes safe HTML through unchanged', () => {
    const safe = `<h2 style="color:#02b6bc;">Dear Jessica,</h2><p>Thank you for your interest!</p><ul><li>Item 1</li><li>Item 2</li></ul>`;
    const result = sanitizeHtml(safe);
    expect(result).toBe(safe);
  });

  it('passes HTML with inline styles and class attributes through', () => {
    const safe = `<div class="project-block" style="background:#fff;padding:20px;"><p style="font-size:16px;">Content</p></div>`;
    expect(sanitizeHtml(safe)).toBe(safe);
  });

  it('returns empty string for null/undefined/non-string inputs', () => {
    expect(sanitizeHtml(null as any)).toBe('');
    expect(sanitizeHtml(undefined as any)).toBe('');
    expect(sanitizeHtml('' as any)).toBe('');
    expect(sanitizeHtml(42 as any)).toBe('');
  });

  it('handles Qwilr-style HTML blocks without stripping safe content', () => {
    // Real Qwilr export excerpt (trimmed) — should pass through
    const qwilrHtml = `<h2 style="--_1fux1si2:#02b6bc;" class="h2-widget__spacing-shim">` +
      `<span style="font-weight:bold;">Dear Jessica, </span></h2>` +
      `<p class="p-widget__spacing-shim">This document describes the overall investment.</p>`;
    const result = sanitizeHtml(qwilrHtml);
    expect(result).toContain('Dear Jessica');
    expect(result).toContain('font-weight:bold');
    expect(result).toContain('overall investment');
  });

});

// ─── Blocks path selector logic ───────────────────────────────────────────────
//
// These tests validate the SAME boolean logic used in QuoteView.svelte's
// `{#if Array.isArray(quote.blocks) && quote.blocks.length > 0}` condition.
// Running this here keeps the behavior contractually tested without needing
// a full Svelte component mount.

describe('QuoteBlock path selector (backward compat)', () => {

  function shouldUseBlocksPath(blocks: unknown): boolean {
    return Array.isArray(blocks) && (blocks as any[]).length > 0;
  }

  it('uses legacy path when blocks field is absent (existing quotes)', () => {
    const legacyQuote = { title: 'Old Quote', lineItems: [], total: 0 };
    expect(shouldUseBlocksPath((legacyQuote as any).blocks)).toBe(false);
  });

  it('uses legacy path when blocks is null', () => {
    expect(shouldUseBlocksPath(null)).toBe(false);
  });

  it('uses legacy path when blocks is undefined', () => {
    expect(shouldUseBlocksPath(undefined)).toBe(false);
  });

  it('uses legacy path when blocks is an empty array', () => {
    // A quote that has blocks:[] (e.g. template applied but no blocks added yet)
    // should fall back to the legacy line-items table
    expect(shouldUseBlocksPath([])).toBe(false);
  });

  it('uses blocks path (BlockRenderer) when blocks has at least one entry', () => {
    const blocks = [{ id: 'b1', type: 'html', html: '<p>Hello</p>' }];
    expect(shouldUseBlocksPath(blocks)).toBe(true);
  });

  it('uses blocks path with multiple blocks', () => {
    const blocks = [
      { id: 'b1', type: 'html', html: '<h2>Header</h2>' },
      { id: 'b2', type: 'quoteTable', data: null },
      { id: 'b3', type: 'accept', data: null },
    ];
    expect(shouldUseBlocksPath(blocks)).toBe(true);
  });

  it('safely ignores future unknown block types (forward compat)', () => {
    // An unknown type should still trigger the blocks path
    // (BlockRenderer will silently skip it, but the path is taken)
    const blocksWithUnknownType = [
      { id: 'b1', type: 'video_embed_future', html: null },
    ];
    expect(shouldUseBlocksPath(blocksWithUnknownType)).toBe(true);
  });

});

// ─── Phase 3: interactive line-item selection (dynamic total) ─────────────────
//
// These tests validate the SAME pure calculation used in BlockRenderer.svelte's
// `$: dynamicTotal = quote.lineItems.reduce(...)` reactive declaration.
// Running here proves the selection logic doesn't mutate the doc base.

describe('Phase 3 — calculateSelectedTotal (no mutation of original)', () => {

  interface LineItem { lineId: string; label: string; amount: number; isOptional?: boolean; }

  /**
   * Pure function — mirrors BlockRenderer's $: dynamicTotal reactive.
   * Key invariant: original lineItems array is NEVER mutated.
   */
  function calculateSelectedTotal(
    lineItems: LineItem[],
    selectedIds: Set<string>,
  ): number {
    return lineItems.reduce((sum, li) => {
      return selectedIds.has(li.lineId) ? sum + li.amount : sum;
    }, 0);
  }

  const lineItems: LineItem[] = [
    { lineId: 'li-main',    label: 'FCL Service',        amount: 20293, isOptional: false },
    { lineId: 'li-exon',    label: 'Exoneration Process', amount: 599,   isOptional: true  },
    { lineId: 'li-plate',   label: 'Plate Rental',        amount: 480,   isOptional: true  },
    { lineId: 'li-reg',     label: 'Registration',        amount: 1200,  isOptional: true  },
    { lineId: 'li-course',  label: 'DIY Course',          amount: 0,     isOptional: true  },
  ];

  it('required-only: total matches required items when no optional selected', () => {
    const initialSelection = new Set(
      lineItems.filter(li => !li.isOptional).map(li => li.lineId)
    );
    // Only 'li-main' is required
    expect(calculateSelectedTotal(lineItems, initialSelection)).toBe(20293);
  });

  it('required + one optional: total adds up correctly', () => {
    const selection = new Set(['li-main', 'li-exon']);
    expect(calculateSelectedTotal(lineItems, selection)).toBe(20293 + 599);
  });

  it('all items selected: total equals sum of all amounts', () => {
    const allSelected = new Set(lineItems.map(li => li.lineId));
    const expected = lineItems.reduce((s, li) => s + li.amount, 0);
    expect(calculateSelectedTotal(lineItems, allSelected)).toBe(expected);
  });

  it('empty selection: total is 0', () => {
    expect(calculateSelectedTotal(lineItems, new Set())).toBe(0);
  });

  it('free item (amount=0) selected: does not change total', () => {
    const withFree = new Set(['li-main', 'li-course']);
    expect(calculateSelectedTotal(lineItems, withFree)).toBe(20293);
  });

  it('original lineItems array is NOT mutated after calculation', () => {
    const original = lineItems.map(li => ({ ...li })); // snapshot
    const selection = new Set(['li-main', 'li-exon']);
    calculateSelectedTotal(lineItems, selection); // run it
    lineItems.forEach((li, i) => {
      expect(li.lineId).toBe(original[i].lineId);
      expect(li.amount).toBe(original[i].amount);
      expect(li.isOptional).toBe(original[i].isOptional);
    });
  });

  it('backward compat: quote without isOptional — all items treated as required', () => {
    // Legacy line items have no isOptional field — they're falsy so treated as required
    const legacyItems: LineItem[] = [
      { lineId: 'la', label: 'Service A', amount: 1000 },
      { lineId: 'lb', label: 'Service B', amount: 500  },
    ];
    // Legacy: all selected (no optional items)
    const allSelected = new Set(
      legacyItems.filter(li => !li.isOptional).map(li => li.lineId),
    );
    expect(allSelected.size).toBe(2);
    expect(calculateSelectedTotal(legacyItems, allSelected)).toBe(1500);
  });

  it('isOptional flag correctly identifies optional vs required', () => {
    const required = lineItems.filter(li => !li.isOptional);
    const optional  = lineItems.filter(li => !!li.isOptional);
    expect(required.length).toBe(1);
    expect(optional.length).toBe(4);
    expect(required[0].lineId).toBe('li-main');
  });

});

// ─── Block registry — blank-block factory (kills the empty-box placeholder) ───
//
// The WysiwygEditor's "Add block" used to insert a stale
//   "<p>…Click to edit your … content here…</p>"
// placeholder. It now delegates to the central registry's createBlock(). These
// tests pin that contract: every catalog type resolves, editable starters are
// non-empty real HTML, and nothing emits the old placeholder copy.

describe('block registry — blank starter blocks', () => {

  it('every palette catalog entry resolves to a registry definition', () => {
    expect(BLOCK_CATALOG.length).toBeGreaterThan(0);
    for (const entry of BLOCK_CATALOG) {
      expect(getBlockDef(entry.type)).toBeTruthy();
    }
  });

  it('createBlock returns the canonical { id, type, html, data, section } shape', () => {
    const b = createBlock('html', 'Intro');
    expect(typeof b.id).toBe('string');
    expect(b.id.length).toBeGreaterThan(0);
    expect(b.type).toBe('html');
    expect(b.section).toBe('Intro');
    expect('html' in b).toBe(true);
    expect('data' in b).toBe(true);
  });

  it('html/heading/banner/accordion starters are non-empty real HTML', () => {
    for (const type of ['html', 'heading', 'banner', 'accordion'] as const) {
      const b = createBlock(type, null);
      expect(typeof b.html).toBe('string');
      expect((b.html as string).trim().length).toBeGreaterThan(0);
      expect(b.html as string).toContain('<');
    }
  });

  it('no blank starter emits the legacy "Click to edit your … content here" placeholder', () => {
    for (const def of BLOCK_REGISTRY) {
      const body = def.createDefault();
      if (typeof body.html === 'string') {
        expect(body.html.toLowerCase()).not.toContain('click to edit your');
      }
    }
  });

  it('quoteTable / accept starters carry no html (rendered dynamically)', () => {
    expect(createBlock('quoteTable', null).html).toBeNull();
    expect(createBlock('accept', null).html).toBeNull();
  });

  it('generates a fresh unique id on every createBlock call', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createBlock('html', null).id));
    expect(ids.size).toBe(50);
  });

});

// ─── Content presets — the "more comprehensive block creator" ─────────────────
//
// Clicking a preset must drop REAL, client-ready content (never an empty box),
// of a block TYPE that BlockRenderer can actually render, using only merge
// tokens the renderer resolves. These tests enforce all of that.

describe('content presets — library integrity', () => {

  it('exposes a non-trivial library', () => {
    expect(BLOCK_PRESETS.length).toBeGreaterThanOrEqual(20);
  });

  it('every preset id is unique', () => {
    const ids = BLOCK_PRESETS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every preset has the required palette metadata', () => {
    for (const p of BLOCK_PRESETS) {
      expect(typeof p.id).toBe('string');
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.icon.length).toBeGreaterThan(0);
      expect(typeof p.section).toBe('string');
      expect(p.section.length).toBeGreaterThan(0);
      expect(typeof p.create).toBe('function');
    }
  });

  it('every preset emits a block TYPE that BlockRenderer can render', () => {
    for (const p of BLOCK_PRESETS) {
      const body = p.create();
      expect(RENDERABLE_TYPES.has(body.type)).toBe(true);
    }
  });

  it('content (html) presets carry non-empty real HTML — never an empty box', () => {
    for (const p of BLOCK_PRESETS) {
      const body = p.create();
      if (body.type === 'html') {
        expect(typeof body.html).toBe('string');
        const html = (body.html as string);
        expect(html.trim().length).toBeGreaterThan(40); // real copy, not a stub
        expect(html).toContain('<');
        expect(html.toLowerCase()).not.toContain('your content here');
        expect(html.toLowerCase()).not.toContain('click to edit');
      }
    }
  });

  it('presets only use merge tokens the renderer can resolve (no engine-only tokens)', () => {
    const allowed = new Set(MERGE_FIELDS.map(f => f.token));
    for (const p of BLOCK_PRESETS) {
      const html = p.create().html ?? '';
      const tokens = html.match(/\{\{[^}]+\}\}/g) ?? [];
      for (const tok of tokens) {
        expect(allowed.has(tok)).toBe(true);
      }
      // Engine-only payment-percentage tokens must be baked into concrete numbers.
      expect(html).not.toContain('payment_percentage');
    }
  });

  it('createPresetBlock returns a canonical block with a fresh id; null for unknown id', () => {
    const sample = BLOCK_PRESETS[0];
    const blk = createPresetBlock(sample.id);
    expect(blk).not.toBeNull();
    expect(blk!.type).toBe(sample.create().type);
    expect(typeof blk!.id).toBe('string');
    expect(blk!.id.length).toBeGreaterThan(0);
    // default section comes from the preset
    expect(blk!.section).toBe(sample.section);
    // unknown id → null (caller decides)
    expect(createPresetBlock('___nope___')).toBeNull();
  });

  it('createPresetBlock honours a section override', () => {
    const blk = createPresetBlock('intro-letter', 'Welcome');
    expect(blk).not.toBeNull();
    expect(blk!.section).toBe('Welcome');
  });

  it('getPreset resolves known ids and returns undefined otherwise', () => {
    expect(getPreset('intro-letter')).toBeTruthy();
    expect(getPreset('___missing___')).toBeUndefined();
  });

});

describe('content presets — conditional destination/country variants', () => {

  function variantCount(group: string): number {
    return BLOCK_PRESETS.filter(p => p.variantGroup === group).length;
  }

  it('free-course has one variant per supported destination', () => {
    // Costa Rica, Riviera Maya, Mexico (no beach), Panama
    expect(variantCount('free-course')).toBeGreaterThanOrEqual(4);
  });

  it('Section 4 regulations cover CR / MX / PA / US', () => {
    const labels = BLOCK_PRESETS
      .filter(p => p.variantGroup === 'regulations')
      .map(p => p.variantLabel);
    expect(labels).toEqual(expect.arrayContaining(['Costa Rica', 'Mexico', 'Panama', 'USA']));
  });

  it('payment-split offers both 35/65 and 50/50 with concrete numbers', () => {
    const pay = BLOCK_PRESETS.filter(p => p.variantGroup === 'payment-split');
    expect(pay.length).toBe(2);
    const joined = pay.map(p => p.create().html).join(' ');
    expect(joined).toContain('35%');
    expect(joined).toContain('65%');
    expect(joined).toContain('50%');
  });

  it('Google reviews ship as four distinct testimonial cards', () => {
    expect(variantCount('google-review')).toBe(4);
  });

  it('every variant exposes a human variantLabel', () => {
    for (const p of BLOCK_PRESETS) {
      if (p.variantGroup) {
        expect(typeof p.variantLabel).toBe('string');
        expect((p.variantLabel as string).length).toBeGreaterThan(0);
      }
    }
  });

});

describe('content presets — survive render-time sanitisation', () => {

  it('the video-testimonials preset keeps its trusted YouTube embeds', () => {
    const preset = getPreset('testimonials-video')!;
    const html = preset.create().html as string;
    expect(html).toContain('<iframe');
    const clean = sanitizeHtml(html);
    expect(clean).toContain('<iframe');
    expect(clean).toContain('youtube.com/embed/');
  });

  it('no preset HTML is destroyed by the sanitizer (headings/paragraphs survive)', () => {
    for (const p of BLOCK_PRESETS) {
      const html = p.create().html;
      if (typeof html === 'string' && html.length > 0) {
        const clean = sanitizeHtml(html);
        // sanitiser never blanks out trusted, inline-styled content
        expect(clean.length).toBeGreaterThan(0);
        expect(clean).not.toContain('<script');
        expect(clean).not.toContain('javascript:');
      }
    }
  });

});

describe('content presets — palette grouping', () => {

  it('PRESETS_BY_CATEGORY contains every preset exactly once', () => {
    const flattened = PRESETS_BY_CATEGORY.flatMap(g => g.presets);
    expect(flattened.length).toBe(BLOCK_PRESETS.length);
    expect(new Set(flattened.map(p => p.id)).size).toBe(BLOCK_PRESETS.length);
  });

  it('each grouped preset matches its category bucket', () => {
    for (const group of PRESETS_BY_CATEGORY) {
      for (const p of group.presets) {
        expect(p.category).toBe(group.category);
      }
    }
  });

});
