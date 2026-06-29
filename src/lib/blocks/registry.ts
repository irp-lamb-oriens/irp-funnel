/**
 * blocks/registry.ts — Single source of truth for quote-document BLOCK TYPES.
 * ---------------------------------------------------------------------------
 * Everything about a block type lives here: its label, icon, palette category,
 * whether it is inline-HTML editable, how a fresh instance is created, and an
 * (optional) modal-editor schema describing its editable fields + repeatable
 * groups (list items / table rows).
 *
 * WHY a registry?
 *   • "Add a block type globally" = add ONE entry to `BLOCK_REGISTRY` below.
 *     The add-block palette, the inline editor, and (later) the client output
 *     all read from this list, so a new type lights up everywhere at once.
 *   • Modularization — the 1.6k-line WysiwygEditor no longer owns the catalog.
 *
 * BACKWARD COMPATIBILITY (non-negotiable):
 *   • The block on-disk shape stays exactly `{ id, type, html, data, section }`
 *     (see server `normaliseBlocks()` + `QuoteBlock` in routes/dashboard/store).
 *   • `normalizeBlock()` here is a *read-time* shim: it never drops unknown
 *     fields and never rewrites existing html/data, so every template that
 *     already exists keeps rendering and editing unchanged.
 *
 * This file is intentionally framework-free (plain TS) so it can be imported by
 * the editor, the palette, the modal editor, and the client renderer alike.
 */

import type { QuoteBlock, QuoteBlockType } from '../../routes/dashboard/store.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Palette categories — used to group the (future) beautiful add-block palette.
// ─────────────────────────────────────────────────────────────────────────────
export type BlockCategory =
  | 'content'
  | 'media'
  | 'social-proof'
  | 'commerce'
  | 'legal';

export interface BlockCategoryMeta {
  id: BlockCategory;
  label: string;
  icon: string;
  /** Short helper line shown under the category heading in the palette. */
  hint: string;
}

/** Ordered category metadata (drives palette grouping + headings). */
export const BLOCK_CATEGORIES: BlockCategoryMeta[] = [
  { id: 'content',      label: 'Content',       icon: '✍️',  hint: 'Headings, rich text and letters' },
  { id: 'media',        label: 'Media',         icon: '🖼️',  hint: 'Images and full-width banners' },
  { id: 'commerce',     label: 'Pricing & CTA', icon: '💳',  hint: 'Live quote table and acceptance' },
  { id: 'social-proof', label: 'Social proof',  icon: '🌟',  hint: 'Testimonials, reviews and partners' },
  { id: 'legal',        label: 'Legal',         icon: '⚖️',  hint: 'Terms, conditions and waivers' },
];

// ─────────────────────────────────────────────────────────────────────────────
// Modal-editor schema (consumed in Phase 2 — additive, optional today).
// Describes the editable surface of a block beyond raw inline HTML: simple
// fields plus REPEATABLE groups (list items, table rows, logo cards…), so the
// modal can render "＋ Add row / ＋ Add item" affordances generically.
// ─────────────────────────────────────────────────────────────────────────────
export type EditorFieldKind = 'text' | 'textarea' | 'richtext' | 'url' | 'image' | 'toggle' | 'select';

export interface EditorField {
  /** Key in `block.data` (or a virtual key the editor maps onto html). */
  key: string;
  label: string;
  kind: EditorFieldKind;
  placeholder?: string;
  help?: string;
  /** For kind === 'select'. */
  options?: { value: string; label: string }[];
}

export interface RepeatableGroup {
  /** Key in `block.data` holding the array of items. */
  key: string;
  /** Singular noun, e.g. "row", "list item", "logo". */
  itemLabel: string;
  /** Fields for each item in the array. */
  fields: EditorField[];
  /** Factory for a new blank item (defaults). */
  createItem: () => Record<string, any>;
  /** Soft cap to keep documents sane (optional). */
  max?: number;
}

export interface BlockEditorSchema {
  /** Flat fields rendered at the top of the modal. */
  fields?: EditorField[];
  /** Repeatable groups (the easy "add another row/item" UX). */
  repeatables?: RepeatableGroup[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Block type definition.
// ─────────────────────────────────────────────────────────────────────────────
export interface BlockTypeDef {
  type: QuoteBlockType;
  label: string;
  icon: string;
  hint: string;
  category: BlockCategory;
  /** True when the block's primary content is inline-editable rich HTML. */
  htmlEditable: boolean;
  /**
   * Hide from the add-block palette while still resolving icon/label (e.g.
   * legacy `image` type that is inserted via the rich-text block instead).
   */
  paletteHidden?: boolean;
  /** Factory for a fresh block body of this type ({ html, data }). */
  createDefault: () => Pick<QuoteBlock, 'html' | 'data'>;
  /** Optional modal-editor schema (Phase 2). */
  editor?: BlockEditorSchema;
}

// ─────────────────────────────────────────────────────────────────────────────
// THE REGISTRY — order here is the palette order (paletteHidden entries skipped).
// Matches the historical catalog exactly so there is no visual regression:
//   html, heading, banner, accordion, quoteTable, accept, testimonials,
//   reviews, partners  (+ legacy `image`, hidden from the palette).
// ─────────────────────────────────────────────────────────────────────────────
export const BLOCK_REGISTRY: BlockTypeDef[] = [
  {
    type: 'html',
    label: 'Rich Text',
    icon: '📝',
    hint: 'Free-form HTML — headings, paragraphs, tables',
    category: 'content',
    htmlEditable: true,
    createDefault: () => ({ html: '<p>Your content here…</p>', data: null }),
  },
  {
    type: 'heading',
    label: 'Heading',
    icon: '📌',
    hint: 'Standalone heading block',
    category: 'content',
    htmlEditable: true,
    createDefault: () => ({ html: '<h2>Section heading</h2>', data: null }),
  },
  {
    type: 'image',
    label: 'Image',
    icon: '🏞️',
    hint: 'Single responsive image',
    category: 'media',
    htmlEditable: true,
    paletteHidden: true, // legacy type — inserted via the Rich Text block today
    createDefault: () => ({ html: '<p><img src="" alt="" /></p>', data: null }),
  },
  {
    type: 'banner',
    label: 'Banner',
    icon: '🖼️',
    hint: 'Full-width hero section',
    category: 'media',
    htmlEditable: true,
    createDefault: () => ({
      html: '<div style="text-align:center;padding:2rem 1rem;"><h2>Hero banner</h2><p>Tagline goes here</p></div>',
      data: null,
    }),
  },
  {
    type: 'quoteTable',
    label: 'Quote Table',
    icon: '💰',
    hint: 'Live pricing from quote line-items',
    category: 'commerce',
    htmlEditable: false,
    createDefault: () => ({ html: null, data: null }),
  },
  {
    type: 'accept',
    label: 'Accept CTA',
    icon: '✅',
    hint: '"Book Your Move" acceptance button',
    category: 'commerce',
    htmlEditable: false,
    createDefault: () => ({ html: null, data: null }),
  },
  {
    type: 'testimonials',
    label: 'Testimonials',
    icon: '🌟',
    hint: 'Customer testimonials section',
    category: 'social-proof',
    htmlEditable: false,
    createDefault: () => ({ html: null, data: { items: [] } }),
  },
  {
    type: 'reviews',
    label: 'Reviews',
    icon: '⭐',
    hint: 'Google reviews section',
    category: 'social-proof',
    htmlEditable: false,
    createDefault: () => ({ html: null, data: { items: [] } }),
  },
  {
    type: 'partners',
    label: 'Partners',
    icon: '🤝',
    hint: 'Partner logos section',
    category: 'social-proof',
    htmlEditable: false,
    createDefault: () => ({ html: null, data: { items: [] } }),
  },
  {
    type: 'accordion',
    label: 'Accordion',
    icon: '📋',
    hint: 'Expandable T&Cs / FAQ section',
    category: 'legal',
    htmlEditable: true,
    createDefault: () => ({
      html: '<details><summary>Section title</summary><div>Section content…</div></details>',
      data: null,
    }),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Derived lookups.
// ─────────────────────────────────────────────────────────────────────────────
const REGISTRY_BY_TYPE: Record<string, BlockTypeDef> = Object.fromEntries(
  BLOCK_REGISTRY.map((d) => [d.type, d]),
);

/** Resolve a block-type definition (undefined for unknown/legacy types). */
export function getBlockDef(type: string): BlockTypeDef | undefined {
  return REGISTRY_BY_TYPE[type];
}

/** Set of inline-HTML-editable types (mirrors the historical EDITABLE_TYPES). */
export const EDITABLE_TYPES: Set<QuoteBlockType> = new Set(
  BLOCK_REGISTRY.filter((d) => d.htmlEditable).map((d) => d.type),
);

/** Palette catalog entry (drop-in shape for the existing WysiwygEditor palette). */
export interface BlockCatalogEntry {
  type: QuoteBlockType;
  label: string;
  icon: string;
  hint: string;
  category: BlockCategory;
}

/** Ordered add-block palette entries (legacy/hidden types omitted). */
export const BLOCK_CATALOG: BlockCatalogEntry[] = BLOCK_REGISTRY
  .filter((d) => !d.paletteHidden)
  .map((d) => ({ type: d.type, label: d.label, icon: d.icon, hint: d.hint, category: d.category }));

/** Palette entries grouped by category (drives the future grouped palette). */
export const BLOCK_CATALOG_BY_CATEGORY: { category: BlockCategoryMeta; entries: BlockCatalogEntry[] }[] =
  BLOCK_CATEGORIES
    .map((category) => ({
      category,
      entries: BLOCK_CATALOG.filter((e) => e.category === category.id),
    }))
    .filter((g) => g.entries.length > 0);

// ─────────────────────────────────────────────────────────────────────────────
// Tiny helpers (drop-in replacements for the inline editor helpers).
// ─────────────────────────────────────────────────────────────────────────────
export function blockIcon(type: string): string {
  return getBlockDef(type)?.icon ?? '📦';
}

export function blockLabel(type: string): string {
  return getBlockDef(type)?.label ?? type;
}

/** Inline-HTML editable? (alias kept as `isEditable` for existing call sites.) */
export function isHtmlEditable(type: string): boolean {
  return EDITABLE_TYPES.has(type as QuoteBlockType);
}
export const isEditable = isHtmlEditable;

// ─────────────────────────────────────────────────────────────────────────────
// Construction + normalization.
// ─────────────────────────────────────────────────────────────────────────────

/** Cheap, collision-resistant id (no deps) — matches the editor's existing ids. */
export function newBlockId(): string {
  return `blk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Create a fresh block of `type`, optionally placed in `section`. */
export function createBlock(type: QuoteBlockType, section: string | null = null): QuoteBlock {
  const def = getBlockDef(type);
  const body = def ? def.createDefault() : { html: '', data: null };
  return { id: newBlockId(), type, html: body.html ?? null, data: body.data ?? null, section };
}

/**
 * Read-time normalizer — guarantees the stable `{ id, type, html, data, section }`
 * shape WITHOUT discarding unknown keys or rewriting content. Existing templates
 * pass through untouched (this only fills in missing structural fields).
 */
export function normalizeBlock(raw: any): QuoteBlock {
  const type = (typeof raw?.type === 'string' && raw.type ? raw.type : 'html') as QuoteBlockType;
  return {
    ...raw, // preserve any forward-compatible extra fields
    id: typeof raw?.id === 'string' && raw.id ? raw.id : newBlockId(),
    type,
    html: typeof raw?.html === 'string' ? raw.html : (raw?.html ?? null),
    data: raw?.data && typeof raw.data === 'object' ? raw.data : (raw?.data ?? null),
    section: typeof raw?.section === 'string' && raw.section ? raw.section : null,
  };
}

/** Normalize an array of blocks (safe on null/undefined). */
export function normalizeBlocks(raw: any): QuoteBlock[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeBlock);
}
