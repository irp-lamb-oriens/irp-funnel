/**
 * blocks/presets.ts — Canonical CONTENT presets for the quote-document builder.
 * ---------------------------------------------------------------------------
 * The block REGISTRY (registry.ts) defines the block *types* (html, banner,
 * quoteTable, accept, …) and the EMPTY starter each one creates. This file is
 * the next layer up: a curated library of *content-filled* blocks — the actual
 * segmented sections of the IRP proposal (intro letter, project description,
 * payment terms, country regulations, the self-packing waiver, video
 * testimonials, Google reviews, …) so that clicking a preset drops REAL,
 * client-ready content into the template instead of an empty placeholder box.
 *
 * WHY this exists
 *   • The add-block palette used to insert `<p>Click to edit…</p>` — an empty
 *     box. Operators had to paste/author every section by hand. These presets
 *     turn the builder into a true "content library": pick a segment, it lands
 *     fully written and on-brand.
 *   • Many segments are CONSTANT, a few are CONDITIONAL on the destination /
 *     country (free-course link, Section 4 regulations) or on the deal shape
 *     (35/65 vs 50/50 payment split). Those ship as labelled VARIANTS grouped
 *     under a `variantGroup`, so the palette can show "Regulations ▸ Costa Rica
 *     / Mexico / Panama / USA" etc.
 *
 * RENDERING CONTRACT (critical — keep in lock-step with BlockRenderer.svelte)
 *   • BlockRenderer only renders these block types: html, heading, banner,
 *     accordion, quoteTable, accept. Every CONTENT preset below therefore emits
 *     an `html` block (always rendered via the render-time sanitizer) — never a
 *     non-rendering type like `testimonials`/`reviews`/`partners`.
 *   • The render-time sanitizer keeps a trusted video-embed iframe allowlist
 *     (YouTube/youtube-nocookie/Vimeo/Loom/Dailymotion/Drive over https or //),
 *     so the testimonial embeds below survive sanitisation.
 *   • Merge tokens are limited to the ones mergeFields.ts actually resolves
 *     ({{client.name}}, {{client.fullName}}, {{route.destinationCountry}}, …).
 *     Any unresolved {{token}} is STRIPPED at render time, so engine-only values
 *     (payment %) are baked in as concrete numbers via labelled variants.
 *
 * BACKWARD COMPATIBILITY
 *   • Purely additive. The on-disk block shape stays `{ id, type, html, data,
 *     section }`; presets only ever produce those fields. No server change.
 */

import type { QuoteBlock, QuoteBlockType } from '../../routes/dashboard/store.ts';
import { newBlockId, type BlockCategory } from './registry.ts';

// ─────────────────────────────────────────────────────────────────────────────
// Brand tokens (from the proposal spec: highlight #37bcc3, white bg, black text)
// ─────────────────────────────────────────────────────────────────────────────
const HL = '#37bcc3';
const TEXT = '#0f172a';
const MUTED = '#475569';
const FONT =
  "-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// ── Tiny HTML builders (keep every preset DRY + visually consistent) ──────────
const root = (inner: string): string =>
  `<div style="font-family:${FONT};color:${TEXT};line-height:1.6;font-size:1rem;">${inner}</div>`;

const h2 = (t: string): string =>
  `<h2 style="font-size:1.5rem;font-weight:800;color:${TEXT};margin:0 0 16px;letter-spacing:-0.01em;">${t}</h2>`;

const h3 = (t: string): string =>
  `<h3 style="font-size:1.15rem;font-weight:700;color:${TEXT};margin:24px 0 10px;">${t}</h3>`;

const eyebrow = (t: string): string =>
  `<div style="display:inline-block;padding:5px 11px;background-color:${HL};color:#ffffff;font-weight:700;font-size:0.72rem;border-radius:5px;margin-bottom:16px;letter-spacing:0.08em;text-transform:uppercase;">${t}</div>`;

const p = (t: string): string =>
  `<p style="margin:0 0 16px;color:${MUTED};line-height:1.7;">${t}</p>`;

const callout = (t: string): string =>
  `<div style="margin:20px 0;padding:16px 20px;border-left:4px solid ${HL};background-color:rgba(55,188,195,0.08);border-radius:0 8px 8px 0;"><p style="margin:0;color:${TEXT};line-height:1.65;font-size:0.95rem;">${t}</p></div>`;

const ul = (items: string[]): string =>
  `<ul style="margin:0 0 16px;padding-left:22px;color:${MUTED};line-height:1.7;">${items
    .map((i) => `<li style="margin:0 0 7px;">${i}</li>`)
    .join('')}</ul>`;

const button = (label: string, href: string): string =>
  `<p style="margin:18px 0;"><a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 28px;background-color:${HL};color:#ffffff;text-decoration:none;font-size:0.95rem;font-weight:600;border-radius:8px;">${label}</a></p>`;

const videoEmbed = (src: string, title: string): string =>
  `<div style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:12px;margin:0 0 16px;background:#0f172a;"><iframe src="${src}" title="${title}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>`;

const stars = (): string =>
  `<div style="font-size:1.05rem;letter-spacing:2px;margin:0 0 10px;color:#f59e0b;">★★★★★</div>`;

const reviewCard = (body: string, link: string): string =>
  `<div style="border:1px solid #e2e8f0;border-radius:12px;padding:22px 24px;margin:0 0 16px;background:#ffffff;box-shadow:0 1px 3px rgba(0,0,0,0.04);">${stars()}<p style="margin:0 0 14px;color:${MUTED};line-height:1.7;font-size:0.95rem;">${body}</p><a href="${link}" target="_blank" rel="noopener noreferrer" style="color:${HL};font-weight:600;text-decoration:none;font-size:0.85rem;">Read on Google →</a></div>`;

// ─────────────────────────────────────────────────────────────────────────────
// Preset model.
// ─────────────────────────────────────────────────────────────────────────────
export interface BlockPreset {
  /** Stable, unique preset id (used by the palette + createPresetBlock). */
  id: string;
  /** Short palette label. */
  label: string;
  icon: string;
  category: BlockCategory;
  /** One-line helper shown under the label in the palette. */
  description: string;
  /** Default section this preset is dropped into (the lane heading). */
  section: string;
  /**
   * Conditional-variant grouping. Presets that share a `variantGroup` are
   * mutually-exclusive choices (pick ONE), e.g. the free-course link or the
   * Section-4 regulations differ per destination country. `variantLabel` is the
   * choice name shown in the palette ("Costa Rica", "Mexico", "50 / 50"…).
   */
  variantGroup?: string;
  variantLabel?: string;
  /** Factory → the block body ({ type, html, data }). Pure, no side-effects. */
  create: () => Pick<QuoteBlock, 'type' | 'html' | 'data'>;
}

const htmlBlock = (html: string): Pick<QuoteBlock, 'type' | 'html' | 'data'> => ({
  type: 'html' as QuoteBlockType,
  html,
  data: null,
});

// ─────────────────────────────────────────────────────────────────────────────
// THE PRESET LIBRARY.
// Order here = display order within each category in the palette.
// ─────────────────────────────────────────────────────────────────────────────
export const BLOCK_PRESETS: BlockPreset[] = [
  // ═══════════════════════════ CONTENT ════════════════════════════════════════
  {
    id: 'intro-letter',
    label: 'Intro letter',
    icon: '✉️',
    category: 'content',
    description: 'Personalised "Dear {{client.name}}" cover note',
    section: 'Introduction',
    create: () =>
      htmlBlock(
        root(
          `<p style="font-size:1.25rem;font-weight:700;color:${TEXT};margin:0 0 18px;">Dear {{client.name}},</p>` +
            p('Thank you for considering our service proposal!') +
            p(
              'This document describes the overall investment and other important considerations for your International Move Project based on the information you provided during the consultation call.',
            ) +
            callout(
              '<strong>Action required:</strong> The final quote will include only the services marked on this document. Please scroll down to the <strong>PROJECT INVESTMENT</strong> section and mark/unmark accordingly; after this, proceed to book the service.',
            ) +
            p('Please let us know if you have any questions about the project investment, customs process, or logistics.') +
            p('Sincerely,<br/><strong>International Relocation Partner</strong>'),
        ),
      ),
  },
  {
    id: 'waiver-notice',
    label: 'Waiver notice',
    icon: '⚠️',
    category: 'content',
    description: 'Urges the client to review the self-packing waiver',
    section: 'Introduction',
    create: () =>
      htmlBlock(
        root(
          callout(
            '<strong>Please note:</strong> we kindly urge you to thoroughly review and comprehend the Self-Packing Waiver located at the bottom of this document prior to accepting this service proposal. Your careful consideration of this important information is greatly appreciated.',
          ),
        ),
      ),
  },
  {
    id: 'project-description',
    label: 'Project description',
    icon: '📦',
    category: 'content',
    description: 'The 7 services every project includes',
    section: 'Project Description',
    create: () =>
      htmlBlock(
        root(
          h2('Project Description') +
            p('Every project includes the management of all the necessary processes to accomplish an efficient and successful delivery.') +
            ul([
              '<strong>Consultation Call:</strong> our professional assessment and advice concerning logistics and customs matters — always free of charge — providing crucial information that helps you avoid expensive and damaging mistakes.',
              '<strong>Origin Services:</strong> all required services from the point of origin up to the exit port (professional packing and loading, pick-up and hauling).',
              '<strong>Export Process:</strong> the official declaration of exporting items and compliance with international shipping regulations before exiting the country.',
              '<strong>International Freight:</strong> the primary international transportation from the origin country\u2019s exit port to the destination\u2019s entry port.',
              '<strong>Destination Services:</strong> reception of the shipment at the entry port, the import customs clearance process, and the final delivery.',
              '<strong>Additional Services:</strong> special handling, over-size/weight items (piano, safe, vehicles), assembling/disassembling, long carry, stairs, custom crating, parking permits, storage, particular customs procedures, and more.',
              '<strong>International Shipping Insurance:</strong> optional coverage for your belongings during international transit, with different coverages, deductibles, and rates depending on the packing process and total insured value.',
            ]),
        ),
      ),
  },
  {
    id: 'fuel-cost-notice',
    label: 'Fuel-cost notice',
    icon: '⛽',
    category: 'content',
    description: 'Rates subject to change due to fuel fluctuations',
    section: 'Project Description',
    create: () =>
      htmlBlock(
        root(
          callout(
            '<strong>Fluctuations in fuel cost:</strong> due to current global developments and their potential impact on fuel costs, the rates below may be subject to change and cannot be guaranteed. We will, of course, keep you informed and aligned should any adjustments be required.',
          ),
        ),
      ),
  },
  {
    id: 'rate-validity',
    label: 'Rate validity',
    icon: '⏳',
    category: 'content',
    description: '20-day validity + booking lead-time reminder',
    section: 'Project Description',
    create: () =>
      htmlBlock(
        root(
          callout(
            '<strong>This rate will be valid for 20 days.</strong> International freight cost is subject to variation at any time due to the instability of fuel prices worldwide. To ensure maximum availability, we recommend booking your service at least 30 days prior to your planned departure date.',
          ),
        ),
      ),
  },
  {
    id: 'free-course-cr',
    label: 'Free course',
    icon: '🎓',
    category: 'content',
    description: 'Destination-specific settling-in course',
    section: 'Project Description',
    variantGroup: 'free-course',
    variantLabel: 'Costa Rica',
    create: () =>
      htmlBlock(
        root(
          h3('A free course to help you settle in') +
            p('We are thrilled to offer you a free course to help you settle into your new home with ease. Your satisfaction is our priority, and we\u2019re committed to supporting you every step of the way.') +
            button('Open the Costa Rica course', 'https://www.lasarahelena.com/diy-move-to-costa-rica/'),
        ),
      ),
  },
  {
    id: 'free-course-mx-riviera',
    label: 'Free course',
    icon: '🎓',
    category: 'content',
    description: 'Destination-specific settling-in course',
    section: 'Project Description',
    variantGroup: 'free-course',
    variantLabel: 'Mexico — Riviera Maya',
    create: () =>
      htmlBlock(
        root(
          h3('A free course to help you settle in') +
            p('We are thrilled to offer you a free course to help you settle into your new home with ease. Your satisfaction is our priority, and we\u2019re committed to supporting you every step of the way.') +
            button('Open the Riviera Maya course', 'https://livingplaya.com.mx/'),
        ),
      ),
  },
  {
    id: 'free-course-mx',
    label: 'Free course',
    icon: '🎓',
    category: 'content',
    description: 'Destination-specific settling-in course',
    section: 'Project Description',
    variantGroup: 'free-course',
    variantLabel: 'Mexico — no beach',
    create: () =>
      htmlBlock(
        root(
          h3('A free course to help you settle in') +
            p('We are thrilled to offer you a free course to help you settle into your new home with ease. Your satisfaction is our priority, and we\u2019re committed to supporting you every step of the way.') +
            button('Open the Mexico course', 'https://soniadiazmexico.com/our-book/'),
        ),
      ),
  },
  {
    id: 'free-course-panama',
    label: 'Free course',
    icon: '🎓',
    category: 'content',
    description: 'Destination-specific settling-in course',
    section: 'Project Description',
    variantGroup: 'free-course',
    variantLabel: 'Panama',
    create: () =>
      htmlBlock(
        root(
          h3('A free course to help you settle in') +
            p('We are thrilled to offer you a free course to help you settle into your new home with ease. Your satisfaction is our priority, and we\u2019re committed to supporting you every step of the way.') +
            button('Open the Panama course', 'https://www.panamarelocationonlinecourses.com/'),
        ),
      ),
  },
  {
    id: 'cr-vehicle-customs',
    label: 'CR vehicle customs note',
    icon: '🚗',
    category: 'content',
    description: 'One vehicle at a time (Costa Rica)',
    section: 'Project Description',
    create: () =>
      htmlBlock(
        root(
          callout(
            '<strong>Customs procedures for vehicles (Costa Rica):</strong> customs procedures for vehicles can only be completed one at a time per customer. If you are bringing more than one vehicle, you must first complete the process for the first vehicle before beginning customs procedures for any additional vehicles.',
          ),
        ),
      ),
  },
  {
    id: 'section1-how-to-move-forward',
    label: 'Section 1 · How to move forward',
    icon: '🧭',
    category: 'content',
    description: 'Relocation Specialist & Operations hand-off',
    section: 'How to Move Forward',
    create: () =>
      htmlBlock(
        root(
          eyebrow('Section 1') +
            h2('How to Move Forward') +
            h3('The Relocation Specialist') +
            p('Your Relocation Specialist (RS) is your primary point of contact throughout the quotation and contracting stages. Upon completion of your booking, the RS will seamlessly transfer your service to our Operations Team for smooth and efficient delivery.') +
            p('To finalize your booking and move forward, kindly follow these steps:') +
            `<ol style="margin:0 0 16px;padding-left:22px;color:${MUTED};line-height:1.7;">` +
            '<li style="margin:0 0 7px;">Click the <strong>BOOK YOUR MOVE</strong> button to initiate your booking process.</li>' +
            '<li style="margin:0 0 7px;">Complete the initial payment of your service request. You will receive the banking instructions once you have initiated the booking process.</li>' +
            '<li style="margin:0 0 7px;">The remaining balance will be due upon the pick-up date of your shipment at origin, settled exclusively through bank transfer.</li>' +
            '<li style="margin:0 0 7px;">As soon as we receive confirmation of your payment, your RS will hand over your service request to our Operations Team.</li>' +
            '</ol>' +
            h3('The Operations Team') +
            p('The Operations Department oversees the successful completion of your project and will:') +
            ul([
              'Answer all queries and attend to concerns about the contracted service(s).',
              'Check and confirm the dates available for your service.',
              'Provide instructions and request the required documents to prepare for the start of your service.',
              'Keep you up to date on your service progress through email and a WhatsApp chat group.',
              'Coordinate all the processes involved in the completion of your contracted services.',
            ]),
        ),
      ),
  },
  {
    id: 'section6-extra-charges',
    label: 'Section 6 · Extra charges',
    icon: '💸',
    category: 'content',
    description: 'Out-of-control mandatory destination costs',
    section: 'Extra Charges',
    create: () =>
      htmlBlock(
        root(
          eyebrow('Section 6') +
            h2('Extra Charges') +
            p('Extra charges are mandatory costs associated with shipping that are out of our control. It is impossible to determine the precise amount for these concepts in advance, but we can provide an approximate range of the most common extra costs based on previous operations. Please bear in mind these are always estimations only:') +
            ul([
              'Miscellaneous Port Charges or Deconsolidation fees: around 750–950 USD.',
              'Import duties (vary by shipment).',
              'Fiscal Warehouse storage fees: around 500 USD per month.',
              'Random customs inspections or special procedures may occur without prior notice; related costs are determined on a case-by-case basis.',
            ]),
        ),
      ),
  },
  {
    id: 'section7-lead-time',
    label: 'Section 7 · Lead time',
    icon: '🗓️',
    category: 'content',
    description: 'Transit & end-to-end delivery estimates',
    section: 'Lead Time',
    create: () =>
      htmlBlock(
        root(
          eyebrow('Section 7') +
            h2('Lead Time') +
            ul([
              'Estimated transit time to the destination port: <strong>4 to 6 weeks</strong>.',
              'Destination customs process: <strong>about 4 weeks</strong>.',
              'Registration process per vehicle (Costa Rica): <strong>2 to 3 weeks</strong>.',
              'Total end-to-end delivery time: <strong>approximately 3 months</strong>.',
            ]) +
            callout('Please complete your booking process at least 20 days before your departure date to increase the probability of securing your preferred date.'),
        ),
      ),
  },
  {
    id: 'vehicle-registration-cr',
    label: 'Vehicle registration (CR)',
    icon: '🪪',
    category: 'content',
    description: 'Temporary plate rental & registration package',
    section: 'Lead Time',
    create: () =>
      htmlBlock(
        root(
          h3('Temporary Plate Rental & Vehicle Registration in Costa Rica') +
            p('By obtaining the package for additional local registration services in Costa Rica, you will have the option to rent temporary plates on a monthly basis. These plates allow you to drive the vehicle while the local registration process is completed.') +
            callout('<strong>Provisional plate rental:</strong> in the event of loss or damage to the plates, you will be required to cover the full replacement cost, which could be approximately USD $2,000.00.') +
            p('When importing a vehicle, we strongly recommend selecting the "Vehicle Registration Process in Costa Rica" package. This includes the issuance of Costa Rican plates, plus assistance with the DREKA mechanical inspection and emissions test. If you choose not to purchase this package, International Relocation Partner will not be responsible for any issues regarding the vehicle\u2019s legalization process, and you will not be able to drive the vehicle upon pickup until local registration is complete.'),
        ),
      ),
  },

  // ═══════════════════════════ MEDIA ══════════════════════════════════════════
  {
    id: 'team-professionals',
    label: 'A team of professionals',
    icon: '👥',
    category: 'media',
    description: 'Team banner image + reassurance copy',
    section: 'Project Description',
    create: () =>
      htmlBlock(
        root(
          h2('A Team of Professionals') +
            `<p style="margin:0 0 16px;"><img src="https://internationalrelocationpartner.com/1.png" alt="The International Relocation Partner team" style="width:100%;height:auto;border-radius:12px;display:block;" /></p>` +
            p('Go with a moving company that has a well-established reputation for reliability and quality service.'),
        ),
      ),
  },
  {
    id: 'business-partners',
    label: 'Business partners',
    icon: '🤝',
    category: 'media',
    description: 'Partner / accreditation logo wall',
    section: 'Our Partners',
    create: () => {
      const logos = [
        'AAH.svg', 'AAE.webp', 'AAK.svg', 'AAB.svg', 'AAC.svg', 'AAA.png',
        'AAD.svg', 'AAF.svg', 'AAG.svg', 'AAI.svg', 'AAJ.png',
      ];
      const grid =
        `<div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:18px 28px;margin:8px 0 0;">` +
        logos
          .map(
            (f) =>
              `<img src="https://internationalrelocationpartner.com/icons/partners/${f}" alt="Business partner" style="height:46px;width:auto;object-fit:contain;" />`,
          )
          .join('') +
        `</div>`;
      return htmlBlock(
        root(
          h2('Meet Our Business Partners') +
            p('Your satisfaction and peace of mind are our top priorities. If you have any questions or need additional support, please don\u2019t hesitate to reach out to your International Relocation Specialist.') +
            grid,
        ),
      );
    },
  },

  // ════════════════════════ SOCIAL PROOF ══════════════════════════════════════
  {
    id: 'testimonials-video',
    label: 'Video testimonials',
    icon: '🎬',
    category: 'social-proof',
    description: 'YouTube testimonial embeds (trusted iframes)',
    section: 'Our Customers\u2019 Voice',
    create: () =>
      htmlBlock(
        root(
          h2('Our Customers\u2019 Voice') +
            p('Testimonials from our valued clients.') +
            videoEmbed('https://www.youtube.com/embed/XoYFMUn_6_c', 'Client testimonial') +
            videoEmbed('https://www.youtube.com/embed/-tMlb7ZQqyI', 'Client testimonial') +
            p('Go with a moving company that has a well-established reputation for reliability and quality service.'),
        ),
      ),
  },
  {
    id: 'review-a',
    label: 'Google review',
    icon: '⭐',
    category: 'social-proof',
    description: 'Individual 5-star Google review card',
    section: 'Google Reviews',
    variantGroup: 'google-review',
    variantLabel: 'Review A — Costa Rica + vehicle',
    create: () =>
      htmlBlock(
        root(
          reviewCard(
            'We recently completed an international move to Costa Rica, including importing our vehicle and household goods, and we could not have done it without Pablo Arias and his incredible team! From the very beginning they were professional, knowledgeable, responsive, and incredibly patient in guiding us through a complex process. What impressed us most was their honesty, integrity, and commitment to customer service. We highly recommend International Relocation Partner to anyone planning a move to Costa Rica. \uD83C\uDDE8\uD83C\uDDF7',
            'https://share.google/qSZWlBIidyrxVYWPM',
          ),
        ),
      ),
  },
  {
    id: 'review-b',
    label: 'Google review',
    icon: '⭐',
    category: 'social-proof',
    description: 'Individual 5-star Google review card',
    section: 'Google Reviews',
    variantGroup: 'google-review',
    variantLabel: 'Review B — Florida → Costa Rica',
    create: () =>
      htmlBlock(
        root(
          reviewCard(
            'I highly recommend International Relocation Partner! They handled my move from Florida to Costa Rica, and the entire experience was excellent. Their team kept me informed every step of the way — from Marian leading things to Pablo overseeing everything. The crew in Florida packed everything carefully, and the delivery team in Costa Rica was fantastic. Five stars all the way!',
            'https://share.google/e3tSTp0hxDSzfCRCR',
          ),
        ),
      ),
  },
  {
    id: 'review-c',
    label: 'Google review',
    icon: '⭐',
    category: 'social-proof',
    description: 'Individual 5-star Google review card',
    section: 'Google Reviews',
    variantGroup: 'google-review',
    variantLabel: 'Review C — Costa Rica → Panama',
    create: () =>
      htmlBlock(
        root(
          reviewCard(
            'It was a seamless process from scheduling to pickup in Atenas, Costa Rica, to customs clearance and delivery to Boquete, Panama. Excellent communication throughout the entire shipment. They use the latest AI technology where you video the containers/boxes and it automatically calculates the weight and even makes a packing list! We were extremely impressed and have absolutely no reservations recommending Pablo Arias and International Relocation Partner for your international move.',
            'https://share.google/EvIkisq4qmjNej8bc',
          ),
        ),
      ),
  },
  {
    id: 'review-d',
    label: 'Google review',
    icon: '⭐',
    category: 'social-proof',
    description: 'Individual 5-star Google review card',
    section: 'Google Reviews',
    variantGroup: 'google-review',
    variantLabel: 'Review D — Australia → Costa Rica',
    create: () =>
      htmlBlock(
        root(
          reviewCard(
            'From beginning to end in this 6-month process, International Relocation Partner were a joy to deal with — from wrapping and loading the container in Australia right up until the last box was unloaded in Playa Negra, Guanacaste. Communication was excellent with Cristina, and all the relocation partners they chose communicated clearly and efficiently. They handled our goods with care and respect, and they were upfront with ALL costs so we knew exactly what we were getting into. Highly recommend this company. Pura Vida!',
            'https://share.google/kI7xB7mk5G1OgZOle',
          ),
        ),
      ),
  },
  {
    id: 'social-links',
    label: 'Social links',
    icon: '🔗',
    category: 'social-proof',
    description: 'Google / Facebook / YouTube / IG / LinkedIn',
    section: 'Google Reviews',
    create: () =>
      htmlBlock(
        root(
          p(
            'Feel free to look us up on ' +
              `<a href="https://www.google.com/maps/place/International+Relocation+Partner" target="_blank" rel="noopener noreferrer" style="color:${HL};font-weight:600;text-decoration:none;">Google</a>, ` +
              `<a href="https://www.facebook.com/IntRelocationPartner/" target="_blank" rel="noopener noreferrer" style="color:${HL};font-weight:600;text-decoration:none;">Facebook</a>, ` +
              `<a href="https://www.youtube.com/@internationalrelocationparner" target="_blank" rel="noopener noreferrer" style="color:${HL};font-weight:600;text-decoration:none;">YouTube</a>, ` +
              `<a href="https://www.instagram.com/int.relocation.partner/" target="_blank" rel="noopener noreferrer" style="color:${HL};font-weight:600;text-decoration:none;">Instagram</a>, and ` +
              `<a href="https://www.linkedin.com/company/internationalrelocationpartner" target="_blank" rel="noopener noreferrer" style="color:${HL};font-weight:600;text-decoration:none;">LinkedIn</a> ` +
              'to learn what our customers say about us.',
          ),
        ),
      ),
  },

  // ═══════════════════════════ COMMERCE ═══════════════════════════════════════
  {
    id: 'quote-table',
    label: 'Project investment table',
    icon: '💰',
    category: 'commerce',
    description: 'Live pricing table from the quote line-items',
    section: 'Project Investment',
    create: () => ({ type: 'quoteTable' as QuoteBlockType, html: null, data: null }),
  },
  {
    id: 'accept-cta',
    label: 'Book Your Move (Accept)',
    icon: '✅',
    category: 'commerce',
    description: 'Client acceptance / e-signature CTA',
    section: 'Accept',
    create: () => ({ type: 'accept' as QuoteBlockType, html: null, data: null }),
  },
  {
    id: 'payment-35-65',
    label: 'Payment terms',
    icon: '💳',
    category: 'commerce',
    description: 'Initial / final balance split',
    section: 'Project Investment',
    variantGroup: 'payment-split',
    variantLabel: '35 / 65 (standard)',
    create: () =>
      htmlBlock(
        root(
          h2('Almost done!') +
            p('We request a <strong>35% initial payment</strong> (non-refundable) to complete your booking process. The initial payment can be made via credit card or bank transfer, whichever is more convenient for you.') +
            p('Please note the remaining <strong>65% balance</strong> will be due upon the pick-up date of your shipment at origin and must be settled exclusively through bank transfer.') +
            callout('The 65% payment is required to proceed with the export of the shipment. If this payment is not received, the shipment will be placed on hold and will not be exported until payment is completed; storage and additional handling charges begin to accrue after 7 days at origin.') +
            p('<em>The final quotation and total charges will be confirmed upon receipt and verification of the actual shipment volume. Any adjustments will be reflected in the final invoice.</em>'),
        ),
      ),
  },
  {
    id: 'payment-50-50',
    label: 'Payment terms',
    icon: '💳',
    category: 'commerce',
    description: 'Initial / final balance split',
    section: 'Project Investment',
    variantGroup: 'payment-split',
    variantLabel: '50 / 50 (RoRo / ship overseas)',
    create: () =>
      htmlBlock(
        root(
          h2('Almost done!') +
            p('We request a <strong>50% initial payment</strong> (non-refundable) to complete your booking process. The initial payment can be made via credit card or bank transfer, whichever is more convenient for you.') +
            p('Please note the remaining <strong>50% balance</strong> will be due upon the pick-up date of your shipment at origin and must be settled exclusively through bank transfer.') +
            callout('The 50% payment is required to proceed with the export of the shipment. If this payment is not received, the shipment will be placed on hold and will not be exported until payment is completed; storage and additional handling charges begin to accrue after 7 days at origin.') +
            p('<em>The final quotation and total charges will be confirmed upon receipt and verification of the actual shipment volume. Any adjustments will be reflected in the final invoice.</em>'),
        ),
      ),
  },

  // ═════════════════════════════ LEGAL ════════════════════════════════════════
  {
    id: 'section2-protection-plan',
    label: 'Section 2 · Protection plan',
    icon: '🛡️',
    category: 'legal',
    description: 'Insurance is optional, presented post-booking',
    section: 'Important Information',
    create: () =>
      htmlBlock(
        root(
          eyebrow('Section 2') +
            h2('Protection Plan (Insurance)') +
            p('International Shipping Insurance is an optional service offered for added protection. Our Operations Manager will present you with a range of protection plans based on the unique requirements of your shipment, once you have booked your service and prior to the scheduled pick-up date.'),
        ),
      ),
  },
  {
    id: 'section3-payment-terms',
    label: 'Section 3 · Payment terms & conditions',
    icon: '📑',
    category: 'legal',
    description: 'What is NOT included + booking terms',
    section: 'Important Information',
    create: () =>
      htmlBlock(
        root(
          eyebrow('Section 3') +
            h2('Payment Terms and Conditions') +
            p('All costs are presented in USD.') +
            p('Due to international cargo regulations and best business practices, International Relocation Partner does NOT include the following charges in your quote: Import Duties and Taxes, delay expenses of any type, Crating, Special Customs Inspection, Quarantine, X-Ray, Fumigation, Parking Fees, Ports / NVOCC Charges, Container Detention, Demurrages, Fuel Surcharge, THC (Terminal Handling Charges), Shuttles, delivery to offshore islands or remote rural areas, multiple pick-ups or deliveries.') +
            p('The following special concepts are not included unless explicitly stated in the PROJECT INVESTMENT section:') +
            ul([
              'Long carries; difficult access conditions; stairs beyond the first floor.',
              'Piano handling; safe handling; any heavy-weight or over-size items.',
              'Assembling and disassembling of furniture; handyman services; cleaning services.',
              'Cardboard or wood crating; vehicle handling; extra freight stop; special transport unit; parking permit.',
              'Diplomatic shipments (duty-free).',
            ]),
        ),
      ),
  },
  {
    id: 'regulations-cr',
    label: 'Section 4 · Regulations',
    icon: '🏛️',
    category: 'legal',
    description: 'Destination-country import regulations',
    section: 'Country Regulations',
    variantGroup: 'regulations',
    variantLabel: 'Costa Rica',
    create: () =>
      htmlBlock(
        root(
          eyebrow('Section 4') +
            h2('Costa Rica Regulations') +
            h3('Common destination charges (estimates)') +
            ul([
              'Fiscal Warehouse: $350–$450.',
              'Terminal Handling Charge at destination: $350–$550 (LCL) / $500–$750 (FCL), or $200–$300 for air shipments.',
              'Container demurrages: $100–$150 per day (FCL). Chassis demurrages: $35–$100 per day.',
              'Taxes: $1,500–$5,000 depending on the shipment.',
              'Special permission: $100–$250. RTV vehicle inspection: $100. Sworn deed for vehicles: $150–$250.',
            ]) +
            h3('Household goods — documents required') +
            ul([
              'Copy of passport with the stamp of last entry to Costa Rica.',
              'Lease contract in Spanish or property title (corporate documents if titled under a corporation).',
            ]) +
            p('Customs clearance takes approximately 22 business days from arrival at the bonded warehouse. Items and weights on the OBL must match the shipment or customs will set a fine. 99% of shipments are physically inspected. Diplomatic shipments are duty-free. Wood packing must be ISPM-15 fumigated and marked.') +
            h3('Motor vehicles') +
            ul([
              'Documents: original title, original purchase invoice, miles & condition declaration (notarized).',
              'Duties range 48.10%–68.10% of CIF value. Modified engines are forbidden.',
              'Only one vehicle permit per person per month is processed.',
            ]),
        ),
      ),
  },
  {
    id: 'regulations-mx',
    label: 'Section 4 · Regulations',
    icon: '🏛️',
    category: 'legal',
    description: 'Destination-country import regulations',
    section: 'Country Regulations',
    variantGroup: 'regulations',
    variantLabel: 'Mexico',
    create: () =>
      htmlBlock(
        root(
          eyebrow('Section 4') +
            h2('Mexico Regulations') +
            p('Customs regulations and information for importing used household goods and personal effects.') +
            h3('Required documents') +
            ul([
              'Original legalized inventory in Spanish ("Certificado de Menaje") from the Mexican Consulate (temporary residents often exempt).',
              'Full delivery address and contact details in Mexico; copy of passport; declaration of value.',
              'Temporary or permanent resident visa as applicable; copy of INE/IFE (both sides); RFC/CURP for returning citizens.',
              'List of electronics with serial, model and make; solidarity letter (temporary residents).',
            ]) +
            p('The owner must have lived abroad at least 6 months. New items (under 6 months) are taxed at 20% duty + 16% IVA and must be declared separately. The shipment must be imported within the first 6 months the visa was issued.') +
            h3('Motor vehicles') +
            ul([
              'Only temporary residents may import a vehicle, which must be returned to origin when residency ends.',
              'Owner must be present at port to obtain a temporary import permit (renewed yearly).',
              'Mexican citizens and permanent residents cannot import a vehicle; only diplomats can.',
            ]),
        ),
      ),
  },
  {
    id: 'regulations-pa',
    label: 'Section 4 · Regulations',
    icon: '🏛️',
    category: 'legal',
    description: 'Destination-country import regulations',
    section: 'Country Regulations',
    variantGroup: 'regulations',
    variantLabel: 'Panama',
    create: () =>
      htmlBlock(
        root(
          eyebrow('Section 4') +
            h2('Panama Regulations') +
            h3('Used household goods — documents required') +
            ul([
              'Rated bill of lading (OBL) / express release / air waybill (AWB); copy of passport.',
              'Copy of detailed inventory; original packing list; contact info and delivery instructions.',
              'Visa-specific letters (working / pensionado / investor / self-solvency / diplomat) addressed to Panamanian Customs.',
            ]) +
            p('Goods must be used and show evidence of use. The owner must be in the country when the shipment arrives. Customs clearance takes 7–10 business days. All shipments are subject to inspection at the port of entry. Wood packing materials must be treated and marked per ISPM-15.') +
            p('Returning Panamanians (after 2+ years abroad), working, pensionado/jubilado, investor, diplomat and self-solvency visa holders may import used household goods free of duties and taxes. New household goods are subject to ~25% duties based on CIF value.') +
            h3('Motor vehicles') +
            ul([
              'Only left-hand drive; processing can take up to five months; temporary permits are prohibited.',
              'All vehicles are subject to ~30% taxes based on a Customs appraisal plus shipping and insurance.',
            ]),
        ),
      ),
  },
  {
    id: 'regulations-us',
    label: 'Section 4 · Regulations',
    icon: '🏛️',
    category: 'legal',
    description: 'Destination-country import regulations',
    section: 'Country Regulations',
    variantGroup: 'regulations',
    variantLabel: 'USA',
    create: () =>
      htmlBlock(
        root(
          eyebrow('Section 4') +
            h2('USA Regulations') +
            h3('Documents required') +
            ul([
              'Copy of passport (some ports require all family members); Form CF-3299 (declaration for free entry of unaccompanied articles).',
              'Copy of visa / permanent resident card; I-94 stamp/card; CBP 7501 entry summary; CF-6059B customs declaration.',
              'Copy of bill of lading (OBL) / AWB; detailed inventory in English; Importer Security Filing (ISF); food questionnaire.',
            ]) +
            p('All shipments are subject to examination at the discretion of Customs. For duty-free clearance, household goods must have been used at least 12 months in the foreign household prior to shipment, and the owner must hold a proper long-term visa. Timely ISF filing prior to vessel sailing is essential to avoid penalties. Exams can cost $200–$1,700+ on an FCL shipment.') +
            h3('Motor vehicles') +
            ul([
              'EPA form 3520-21 and DOT form HS-7 as applicable; proof of conformity to EPA/DOT standards.',
              'Vehicles 25+ years old with the original drivetrain are generally exempt from EPA/DOT.',
              'Non-complying vehicles must be brought into conformity, exported, or destroyed; the undercarriage must be free of foreign soil.',
            ]),
        ),
      ),
  },
  {
    id: 'section5-prohibited-items',
    label: 'Section 5 · Prohibited items',
    icon: '🚫',
    category: 'legal',
    description: 'What cannot ship in an international move',
    section: 'Important Information',
    create: () =>
      htmlBlock(
        root(
          eyebrow('Section 5') +
            h2('Prohibited Items in an International Household Goods Move') +
            h3('Hazardous & flammable materials') +
            ul([
              'Aerosols & compressed gases: hairspray, spray paint, deodorant, butane, propane tanks.',
              'Liquids & chemicals: household cleaners, solvents, paint thinners, bleach, ammonia, varnishes, pool chemicals.',
              'Combustibles: gasoline, lighter fluid, charcoal, matches. Batteries of all types (especially rechargeable/car).',
              'Fireworks, ammunition, explosives, fire extinguishers.',
            ]) +
            h3('Food & organic matter') +
            ul([
              'Perishables, canned goods, dried food, oils, sauces. Alcohol & tobacco (often restricted/prohibited).',
              'Live plants, bulbs, soil, and untreated wood products.',
            ]) +
            h3('Weapons, valuables & other') +
            ul([
              'Firearms, ammunition, swords, knives, replicas; narcotics/drugs; counterfeit or pirated goods.',
              'Cash, bonds, jewelry, passports, visas, deeds, wills.',
              'Prescription medication; cosmetics (creams, oils, nail polish/remover); pornographic materials; animal skins/products.',
            ]),
        ),
      ),
  },
  {
    id: 'section8-waiver',
    label: 'Section 8 · Self-packing waiver',
    icon: '✍️',
    category: 'legal',
    description: 'Binding self-packing waiver of compensation',
    section: 'Self-Packing Waiver',
    create: () =>
      htmlBlock(
        root(
          eyebrow('Section 8') +
            h2('Waiver of Compensation for Self-Packing') +
            p('I, {{client.fullName}}, hereby acknowledge and agree that I will be solely responsible for the packing of my personal belongings for the purpose of moving to {{route.destinationCountry}}. I understand and accept that I will not be entitled to any compensation, reimbursement, or liability claims for any potential damage, loss, or injury incurred during my self-packing process.') +
            p('It is essential to perform precise counting and create a comprehensive shipping manifest (general packing list) for all packages shipped to {{route.destinationCountry}}. Each individual box or wrap must be listed as a separate package. Upon arrival, customs authorities will verify the number of packages declared against the actual count; the count must match precisely. Any discrepancy can result in an exhaustive inspection, significant delays, high storage fees, and confiscation of unlisted packages.') +
            p('I, {{client.fullName}}, acknowledge that the pick-up date can be subject to cancellation or rescheduling due to various reasons including trailer mechanical failure, changes in shipping line sailing dates, equipment unavailability, traffic, port congestion, strikes, and other unforeseen circumstances. International Relocation Partner LLC and its employees, agents, or representatives will not be held responsible or liable for any payments or agreements I have made with other parties for packing services.') +
            p('I have read and understood the terms of this waiver, and I voluntarily assume all risks associated with self-packing. By accepting this proposal, I release and discharge International Relocation Partner LLC and its affiliates, employees, agents, and representatives from any and all claims, liabilities, damages, costs, and expenses that may arise from the self-packing process.'),
        ),
      ),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Derived lookups + helpers.
// ─────────────────────────────────────────────────────────────────────────────
const PRESET_BY_ID: Record<string, BlockPreset> = Object.fromEntries(
  BLOCK_PRESETS.map((p2) => [p2.id, p2]),
);

/** Resolve a preset by id (undefined when unknown). */
export function getPreset(id: string): BlockPreset | undefined {
  return PRESET_BY_ID[id];
}

/** Presets grouped by palette category (display order preserved). */
export const PRESETS_BY_CATEGORY: { category: BlockCategory; presets: BlockPreset[] }[] = (() => {
  const order: BlockCategory[] = ['content', 'media', 'commerce', 'social-proof', 'legal'];
  return order
    .map((category) => ({ category, presets: BLOCK_PRESETS.filter((p2) => p2.category === category) }))
    .filter((g) => g.presets.length > 0);
})();

/**
 * Build a fresh, ready-to-insert QuoteBlock from a preset id.
 * Returns the canonical on-disk shape `{ id, type, html, data, section }`.
 * `section` overrides the preset's default section when provided (so the editor
 * can drop a preset into whatever lane the operator clicked "+ Add" on).
 * Returns null for an unknown id (caller decides how to handle).
 */
export function createPresetBlock(id: string, section?: string | null): QuoteBlock | null {
  const preset = getPreset(id);
  if (!preset) return null;
  const body = preset.create();
  return {
    id: newBlockId(),
    type: body.type,
    html: body.html ?? null,
    data: body.data ?? null,
    section: section ?? preset.section ?? null,
  } as QuoteBlock;
}
