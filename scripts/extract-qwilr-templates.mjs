/**
 * extract-qwilr-templates.mjs
 *
 * Fetches the 8 Qwilr template pages, extracts their block content from
 * the embedded AngularJS `initialData` JSON (the full project data is
 * stored as HTML-entity-encoded JSON in the ng-init attribute — no
 * headless browser required), and writes one JSON file per template
 * to `scripts/qwilr-extracted/`.
 *
 * Run from irp-funnel/:
 *   node scripts/extract-qwilr-templates.mjs
 *
 * Output: scripts/qwilr-extracted/<id>.json
 * Each file has shape: { id, name, category, destinationCountries, blocks[] }
 *
 * Images are STRIPPED per design decision (no CDN dependency).
 * Qwilr QuoteV2 blocks → our `quoteTable` block (live line-items).
 * Qwilr Accept blocks  → our `accept` block.
 * Qwilr Text blocks    → our `html` block with section label.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(__dir, 'qwilr-extracted');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ── Template manifest ─────────────────────────────────────────────────────────
const TEMPLATES = [
  {
    id: 'irp-mexico-riviera-maya',
    name: 'México — Rivera Maya (Oferta Irresistible)',
    category: 'mexico-riviera-maya',
    destinationCountries: ['Mexico'],
    url: 'https://internationalrelocationpartner.qwilr.com/Templete-Jeff-Natale-Rivera-Maya-Mexico-Oferta-Irresistible-Shh12vQyTDml',
  },
  {
    id: 'irp-mexico-standard',
    name: 'México — Todo México excepto Rivera Maya',
    category: 'mexico-standard',
    destinationCountries: ['Mexico'],
    url: 'https://internationalrelocationpartner.qwilr.com/Templete-todo-M-xico-excepto-Rivera-Maya-Sonia-Diaz-Oferta-Irresistible-3VL1kpofRlPw',
  },
  {
    id: 'irp-us-standard',
    name: 'United States — Standard Proposal',
    category: 'us',
    destinationCountries: ['United States'],
    url: 'https://internationalrelocationpartner.qwilr.com/Templete-US-HDd51UsRAKap',
  },
  {
    id: 'irp-panama-standard',
    name: 'Panama — Oferta Irresistible',
    category: 'panama',
    destinationCountries: ['Panama'],
    url: 'https://internationalrelocationpartner.qwilr.com/Templete-Ofeta-irresistible-Panama-7lQiL4e7QMWn',
  },
  {
    id: 'irp-cr-roro-vehicle',
    name: 'Costa Rica — Vehículo solo (RoRo)',
    category: 'cr-car-roro',
    destinationCountries: ['Costa Rica'],
    url: 'https://internationalrelocationpartner.qwilr.com/Templete-RoRo-con-Ship-Overseas-25-1-2025-WTBqoP3VR4eI',
  },
  {
    id: 'irp-cr-tampa-container',
    name: 'Costa Rica — Vehículo solo (Contenedor Consolidado desde Tampa)',
    category: 'cr-car-container',
    destinationCountries: ['Costa Rica'],
    url: 'https://internationalrelocationpartner.qwilr.com/-Templete-Consolidated-container-1x40ft-con-Altamar-1-vehicle-Consolidated-container-1x40ft-US-to-Costa-Rica-ThKcdiYrQSCZ',
  },
  {
    id: 'irp-cr-hhg-car',
    name: 'Costa Rica — Menaje y Vehículo',
    category: 'cr-hhg-car',
    destinationCountries: ['Costa Rica'],
    url: 'https://internationalrelocationpartner.qwilr.com/Templete-Costa-Rica-Oferta-Irresistible-HHG-Carro-bONcIJ45TpW2',
  },
  {
    id: 'irp-cr-hhg-only',
    name: 'Costa Rica — Menaje solo',
    category: 'cr-hhg-only',
    destinationCountries: ['Costa Rica'],
    url: 'https://internationalrelocationpartner.qwilr.com/Templete-Costa-Rica-Oferta-Irresistible-5EAMhQeSQsOq',
  },
];

// ── ProseMirror-like content → HTML converter ─────────────────────────────────
function nodeToHtml(node) {
  if (!node) return '';

  if (node.type === 'text') {
    let text = (node.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const marks = node.marks || [];
    for (const mark of marks) {
      if (mark.type === 'bold' || mark.type === 'strong') text = `<strong>${text}</strong>`;
      if (mark.type === 'italic' || mark.type === 'em') text = `<em>${text}</em>`;
      if (mark.type === 'underline') text = `<u>${text}</u>`;
      if (mark.type === 'link') {
        const href = mark.attrs?.href || '#';
        text = `<a href="${href}" target="_blank" rel="noopener noreferrer">${text}</a>`;
      }
      if (mark.type === 'code') text = `<code>${text}</code>`;
    }
    return text;
  }

  const children = (node.content || []).map(nodeToHtml).join('');

  switch (node.type) {
    case 'doc': return children;
    case 'paragraph': return children ? `<p>${children}</p>` : '<p>&nbsp;</p>';
    case 'heading': {
      const lvl = Math.min(Math.max(node.attrs?.level || 2, 1), 6);
      return `<h${lvl}>${children}</h${lvl}>`;
    }
    case 'bulletList': return `<ul>${children}</ul>`;
    case 'orderedList': return `<ol>${children}</ol>`;
    case 'listItem': return `<li>${children}</li>`;
    case 'blockquote': return `<blockquote>${children}</blockquote>`;
    case 'hardBreak': return '<br>';
    case 'horizontalRule': return '<hr>';
    case 'table': return `<table style="width:100%;border-collapse:collapse;">${children}</table>`;
    case 'tableRow': return `<tr>${children}</tr>`;
    case 'tableCell': return `<td style="padding:8px 12px;border:1px solid #e2e8f0;">${children}</td>`;
    case 'tableHeader': return `<th style="padding:8px 12px;border:1px solid #e2e8f0;background:#f8fafc;font-weight:700;">${children}</th>`;
    // Images: stripped per user decision — no CDN dependency
    case 'image': return '';
    default: return children;
  }
}

// ── Qwilr block → IRP QuoteBlock ────────────────────────────────────────────
let blockCounter = 0;
function qwilrBlockToIrpBlock(qBlock, sectionLabel) {
  blockCounter++;
  const bType = qBlock.blockType || '';

  // Quote table blocks → our interactive quoteTable (uses live line-items)
  if (bType === 'QuoteV2' || bType === 'Quote') {
    return {
      id: `ext-${Date.now()}-${blockCounter}`,
      type: 'quoteTable',
      html: null,
      data: null,
      section: sectionLabel,
    };
  }

  // Accept/booking blocks → our accept CTA
  if (bType === 'Accept') {
    return {
      id: `ext-${Date.now()}-${blockCounter}`,
      type: 'accept',
      html: null,
      data: null,
      section: sectionLabel || 'Book Your Move',
    };
  }

  // Text blocks — extract rich text content
  if (bType === 'Text' || bType === 'Splash') {
    // Try to find content in various locations in the Qwilr block data
    let htmlContent = '';

    // Strategy 1: ProseMirror-style content.nodes
    if (qBlock.content?.nodes) {
      htmlContent = qBlock.content.nodes.map(nodeToHtml).join('');
    }
    // Strategy 2: direct content array (ProseMirror doc)
    else if (Array.isArray(qBlock.content?.content)) {
      htmlContent = nodeToHtml(qBlock.content);
    }
    // Strategy 3: content is a string
    else if (typeof qBlock.content === 'string') {
      htmlContent = qBlock.content;
    }
    // Strategy 4: look in widgets
    else if (Array.isArray(qBlock.widgets)) {
      htmlContent = qBlock.widgets
        .map(w => {
          if (w.type === 'text' || w.type === 'html') {
            return w.content ? nodeToHtml({ type: 'doc', content: w.content }) : (w.html || '');
          }
          return '';
        })
        .join('');
    }

    // Strip any remaining <img> tags
    htmlContent = htmlContent.replace(/<img[^>]*>/gi, '');

    if (!htmlContent.trim()) return null; // skip empty blocks

    return {
      id: `ext-${Date.now()}-${blockCounter}`,
      type: 'html',
      html: `<div style="padding:32px 40px;background:#fff;">${htmlContent}</div>`,
      data: null,
      section: sectionLabel,
    };
  }

  return null;
}

// ── Section name derivation ───────────────────────────────────────────────────
const SECTION_MAP = [
  { pattern: /dear|intro|welcome|bienvenid/i,            section: 'Introduction' },
  { pattern: /project\s*desc|descripci[oó]n|overview/i,  section: 'Project Description' },
  { pattern: /investment|pricing|quote|precio|cotiz/i,    section: 'Project Investment' },
  { pattern: /customer|testimon|opinion|cliente/i,        section: 'Testimonials' },
  { pattern: /google\s*review|reviews/i,                  section: 'Google Reviews' },
  { pattern: /partner|aliado|associate/i,                 section: 'Our Partners' },
  { pattern: /important|term|condition|t[eé]rmino/i,      section: 'Important Info' },
  { pattern: /book|accept|complete|booking|accept\s*your/i, section: 'Book Your Move' },
  { pattern: /splash|hero|banner/i,                       section: 'Introduction' },
];

function deriveSectionName(blockName, blockType, index) {
  if (blockType === 'Accept') return 'Book Your Move';
  if (blockType === 'QuoteV2' || blockType === 'Quote') return 'Project Investment';

  const name = (blockName || '').toLowerCase().trim();
  for (const { pattern, section } of SECTION_MAP) {
    if (pattern.test(name)) return section;
  }
  // Unnamed block: use order-based fallback
  if (index === 0) return 'Introduction';
  if (index === 1) return 'Project Description';
  return `Section ${index + 1}`;
}

// ── HTML extraction from ng-init ───────────────────────────────────────────
function extractBlocksFromHtml(html) {
  // The full project JSON is embedded as HTML-entity-encoded JSON in the
  // <html ng-init="initialData = {...}"> attribute.
  const match = html.match(/ng-init="initialData\s*=\s*([^"]+)"/);
  if (!match) return [];

  let jsonStr = match[1];
  // Decode HTML entities
  jsonStr = jsonStr
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;/g, "'");

  let data;
  try {
    data = JSON.parse(jsonStr);
  } catch (e) {
    console.warn('  ⚠️  Could not parse ng-init JSON:', e.message.slice(0, 80));
    return [];
  }

  // The blocks are nested somewhere in data — try various paths
  const blockSources = [
    data?.page?.blocks,
    data?.project?.blocks,
    data?.blocks,
    data?.pageBlocks,
  ].filter(Boolean);

  for (const blockArr of blockSources) {
    if (Array.isArray(blockArr) && blockArr.length > 0) {
      return blockArr;
    }
  }

  return [];
}

// ── Main extraction loop ──────────────────────────────────────────────────────
async function extractTemplate(tpl) {
  console.log(`\n📄 Extracting: ${tpl.name}`);
  console.log(`   URL: ${tpl.url}`);

  let rawHtml;
  try {
    const res = await fetch(tpl.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IRP-template-extractor/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    rawHtml = await res.text();
    console.log(`   ✓ Fetched ${(rawHtml.length / 1024).toFixed(0)} KB`);
  } catch (err) {
    console.error(`   ✗ Fetch failed: ${err.message}`);
    return null;
  }

  const qwilrBlocks = extractBlocksFromHtml(rawHtml);
  console.log(`   Qwilr blocks found: ${qwilrBlocks.length}`);

  if (qwilrBlocks.length === 0) {
    console.warn(`   ⚠️  No blocks extracted — will use section stubs.`);
    // Return a stub with placeholder blocks that staff can fill via WYSIWYG
    return buildStubTemplate(tpl);
  }

  const irpBlocks = [];
  for (let i = 0; i < qwilrBlocks.length; i++) {
    const qb = qwilrBlocks[i];
    const section = deriveSectionName(qb.name || '', qb.blockType || '', i);
    const irpBlock = qwilrBlockToIrpBlock(qb, section);
    if (irpBlock) irpBlocks.push(irpBlock);
  }

  console.log(`   ✓ Converted to ${irpBlocks.length} IRP blocks`);
  return {
    id: tpl.id,
    name: tpl.name,
    category: tpl.category,
    destinationCountries: tpl.destinationCountries,
    blocks: irpBlocks,
  };
}

// ── Stub template builder (fallback when extraction fails) ────────────────────
function buildStubTemplate(tpl) {
  const isVehicleOnly = tpl.category.includes('roro') || tpl.category.includes('container');
  const isHhgCar = tpl.category.includes('hhg-car');

  const blocks = [
    {
      id: `${tpl.id}-banner`,
      type: 'banner',
      section: 'Introduction',
      html: `<div style="background:linear-gradient(135deg,#0f172a 0%,#0d3140 60%,#052a30 100%);padding:52px 48px 44px;border-radius:0;text-align:center;color:#fff;">
<h1 style="font-family:'Jost',sans-serif;font-size:2rem;font-weight:900;color:#fff;margin:0 0 10px;">${tpl.name}</h1>
<p style="font-size:1.05rem;color:rgba(255,255,255,0.75);margin:0;">Prepared for <strong style="color:#02b5bb;">{{client.fullName}}</strong></p>
</div>`,
      data: null,
    },
    {
      id: `${tpl.id}-intro`,
      type: 'html',
      section: 'Introduction',
      html: `<div style="padding:40px 48px 32px;background:#fff;">
<h2 style="font-family:'Jost',sans-serif;font-size:1.45rem;font-weight:800;color:#0f172a;margin:0 0 14px;">Dear {{client.fullName}},</h2>
<p style="font-size:1rem;line-height:1.75;color:#334155;margin:0 0 20px;">Thank you for trusting <strong>International Relocation Partners</strong> with your move from <strong>{{route.originCity}}, {{route.originCountry}}</strong> to <strong>{{route.destinationCity}}, {{route.destinationCountry}}</strong>. Below you will find the complete service breakdown prepared for your relocation.</p>
</div>`,
      data: null,
    },
    {
      id: `${tpl.id}-desc`,
      type: 'html',
      section: 'Project Description',
      html: `<div style="padding:32px 48px;background:#fff;">
<h2 style="font-family:'Jost',sans-serif;font-size:1.3rem;font-weight:800;color:#0f172a;margin:0 0 16px;">Project Description</h2>
<table style="width:100%;border-collapse:collapse;font-family:'Jost',sans-serif;font-size:0.92rem;">
  <tr style="background:#f8fafc;"><td style="padding:10px 14px;color:#64748b;font-weight:700;width:38%;border-bottom:1px solid #f1f5f9;">Route</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;">{{route.originCity}} → {{route.destinationCity}}, {{route.destinationCountry}}</td></tr>
  <tr><td style="padding:10px 14px;color:#64748b;font-weight:700;border-bottom:1px solid #f1f5f9;">Move Size</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;">{{move.size}}</td></tr>
  ${!isVehicleOnly ? `<tr style="background:#f8fafc;"><td style="padding:10px 14px;color:#64748b;font-weight:700;border-bottom:1px solid #f1f5f9;">Vehicles</td><td style="padding:10px 14px;border-bottom:1px solid #f1f5f9;">{{move.vehicles}}</td></tr>` : ''}
  <tr><td style="padding:10px 14px;color:#64748b;font-weight:700;">Est. Move Date</td><td style="padding:10px 14px;">{{move.scheduling}}</td></tr>
</table>
</div>`,
      data: null,
    },
    {
      id: `${tpl.id}-quotetable`,
      type: 'quoteTable',
      section: 'Project Investment',
      html: null,
      data: null,
    },
    {
      id: `${tpl.id}-testimonials`,
      type: 'html',
      section: 'Testimonials',
      html: `<div style="padding:32px 48px;background:#f8fafc;">
<h2 style="font-family:'Jost',sans-serif;font-size:1.3rem;font-weight:800;color:#0f172a;margin:0 0 20px;">What Our Customers Say</h2>
<p style="color:#64748b;font-style:italic;">✏️ <em>Add customer testimonials here via the template editor.</em></p>
</div>`,
      data: null,
    },
    {
      id: `${tpl.id}-terms`,
      type: 'accordion',
      section: 'Important Info',
      html: `<div style="padding:32px 48px;background:#f8fafc;border-top:2px solid #e2e8f0;">
<h3 style="font-family:'Jost',sans-serif;font-size:1.05rem;font-weight:800;color:#0f172a;margin:0 0 20px;">📋 Terms &amp; Conditions</h3>
<div style="display:flex;flex-direction:column;gap:14px;font-size:0.88rem;line-height:1.7;color:#475569;">
  <div><strong style="color:#0f172a;">1. Payment Terms.</strong> A 50% deposit is required to confirm booking. The remaining balance is due prior to loading. IRP accepts bank wire, Zelle, and SWIFT.</div>
  <div><strong style="color:#0f172a;">2. Scope.</strong> This proposal covers the services listed. Additional services require written approval and may affect pricing.</div>
  <div><strong style="color:#0f172a;">3. Insurance.</strong> Basic cargo insurance is included. We recommend All-Risk marine insurance for full coverage.</div>
  <div><strong style="color:#0f172a;">4. Customs &amp; Duties.</strong> Destination import duties are estimates only. Final amounts depend on customs authorities at the time of import.</div>
</div>
</div>`,
      data: null,
    },
    {
      id: `${tpl.id}-accept`,
      type: 'accept',
      section: 'Book Your Move',
      html: null,
      data: null,
    },
  ];

  return { id: tpl.id, name: tpl.name, category: tpl.category, destinationCountries: tpl.destinationCountries, blocks };
}

// ── Run ───────────────────────────────────────────────────────────────────────
console.log('🚀 IRP Qwilr Template Extractor\n');
console.log('Extracting templates from Qwilr...\n');

const results = [];
for (const tpl of TEMPLATES) {
  const result = await extractTemplate(tpl);
  if (result) {
    results.push(result);
    const outPath = join(OUT_DIR, `${tpl.id}.json`);
    writeFileSync(outPath, JSON.stringify(result, null, 2), 'utf-8');
    console.log(`   💾 Saved → ${outPath}`);
  }
}

// Write a combined manifest
const manifestPath = join(OUT_DIR, '_manifest.json');
writeFileSync(manifestPath, JSON.stringify(results.map(r => ({
  id: r.id, name: r.name, category: r.category,
  destinationCountries: r.destinationCountries,
  blockCount: r.blocks.length,
  sections: [...new Set(r.blocks.map(b => b.section).filter(Boolean))],
})), null, 2), 'utf-8');

console.log(`\n✅ Done! ${results.length}/${TEMPLATES.length} templates extracted.`);
console.log(`📋 Manifest: ${manifestPath}`);
console.log('\nNext step:');
console.log('  cd ../irp-funnel-server');
console.log('  deno run --allow-env --allow-net scripts/seed-qwilr-templates.ts');
