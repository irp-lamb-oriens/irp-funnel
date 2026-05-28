/**
 * emailSnippets.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized registry of pre-baked HTML snippets that non-technical operators
 * can insert into the email body with one click from the WYSIWYG editor toolbar.
 *
 * Add new snippets here — no component changes needed.
 * Set `emailTypes` to restrict a snippet to specific email templates;
 * leave empty to make it available in ALL email types.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface EmailSnippet {
  /** Unique key used as the DOM command value. */
  id: string;
  /** Label shown in the insert dropdown. */
  label: string;
  /** HTML inserted at the caret position. */
  html: string;
  /** Restrict to specific email types. Empty = all. */
  emailTypes?: string[];
  /** Visual grouping in the dropdown. */
  category?: 'block' | 'cta' | 'signature' | 'inline' | 'ops';
}

export const EMAIL_SNIPPETS: EmailSnippet[] = [
  // ── Warm signatures ────────────────────────────────────────────────────────
  {
    id: 'sig_warm',
    label: 'Warm signature — team',
    html: `<p style="margin-top:24px;font-size:14px;color:#555;">Warm regards,<br><strong>The International Relocation Partner Team</strong><br>🌍 <a href="https://www.internationalrelocationpartner.com" style="color:#4f46e5;">internationalrelocationpartner.com</a></p>`,
    category: 'signature',
  },
  {
    id: 'sig_short',
    label: 'Short signature — IRP',
    html: `<p style="margin-top:16px;font-size:14px;color:#555;">Best,<br>Your IRP Team</p>`,
    category: 'signature',
  },

  // ── Call to action ─────────────────────────────────────────────────────────
  {
    id: 'cta_book',
    label: '📅 Book a call CTA',
    html: `<div style="text-align:center;margin:24px 0;">
  <a href="https://www.internationalrelocationpartner.com/status/{statusPageUrl}" style="display:inline-block;background:#4f46e5;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">
    📅 Book your consultation call
  </a>
  <p style="font-size:13px;color:#888;margin-top:8px;">No commitment — just a friendly chat about your move.</p>
</div>`,
    category: 'cta',
  },
  {
    id: 'cta_reply',
    label: '💬 Reply CTA',
    html: `<p style="margin-top:16px;font-size:15px;color:#333;">
  Simply reply to this email or <a href="https://www.internationalrelocationpartner.com/status/{statusPageUrl}" style="color:#4f46e5;">visit your project portal</a> — we'll get back to you within 24 hours.
</p>`,
    category: 'cta',
  },

  // ── Blocks ─────────────────────────────────────────────────────────────────
  {
    id: 'block_intro',
    label: 'Intro paragraph',
    html: `<p style="font-size:15px;line-height:1.6;color:#333;">
  Thank you for reaching out to International Relocation Partner! We're excited to help make your international move as smooth and stress-free as possible.
</p>`,
    category: 'block',
  },
  {
    id: 'block_relocation_scope',
    label: 'Relocation scope explanation',
    html: `<p style="font-size:15px;line-height:1.6;color:#333;">
  Our team specialises in end-to-end international relocation — from packing and shipping your belongings, to customs clearance, to delivery at your new home. Every move is supported by a dedicated project portal where you can track progress, message your team, and manage documents.
</p>`,
    category: 'block',
  },
  {
    id: 'block_next_steps',
    label: 'Next steps paragraph',
    html: `<p style="font-size:15px;line-height:1.6;color:#333;">
  <strong>What happens next:</strong><br>
  &nbsp;&nbsp;1. We'll send you a personalised quote based on the details you shared.<br>
  &nbsp;&nbsp;2. Once you're happy, we'll lock in a packing and shipping date.<br>
  &nbsp;&nbsp;3. On moving day, our crew handles everything — you just show up at your new home.
</p>`,
    category: 'block',
  },

  // ── Ops-specific ───────────────────────────────────────────────────────────
  {
    id: 'ops_etd_request',
    label: '📦 Ops — ETD/ETA request',
    html: `<p style="font-size:15px;line-height:1.6;color:#333;">
  We're coordinating your shipment now. Could you confirm the estimated departure date (ETD) and estimated arrival date (ETA) at your earliest convenience? This helps us keep the client's project portal accurate and their timeline expectations managed.
</p>`,
    category: 'ops',
    emailTypes: ['ops_provider_date_request', 'ops_etd_provider_request'],
  },
  {
    id: 'ops_arrival_confirmation',
    label: '🚢 Ops — arrival confirmation',
    html: `<p style="font-size:15px;line-height:1.6;color:#333;">
  Great news — your shipment has arrived! Here's what you need to know about the final delivery and customs clearance process. Please reach out if you have any questions.
</p>`,
    category: 'ops',
    emailTypes: ['ops_arrival_confirmation', 'ops_eta_client_update'],
  },

  // ── Pricing summary ────────────────────────────────────────────────────────
  {
    id: 'pricing_table_placeholder',
    label: '💲 Pricing summary table',
    html: `<div style="background:#f8f9fa;border:1px solid #e0e0e0;border-radius:8px;padding:20px;margin:20px 0;">
  <h3 style="margin:0 0 16px;font-size:17px;color:#1a1a2e;">Estimated Relocation Cost Summary</h3>
  <table style="width:100%;border-collapse:collapse;font-size:14px;color:#333;">
    <tr><td style="padding:8px 0;border-bottom:1px solid #e0e0e0;">Shipping ({volume})</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid #e0e0e0;">{shippingCost}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #e0e0e0;">Packing Service</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid #e0e0e0;">{packingCost}</td></tr>
    <tr><td style="padding:8px 0;border-bottom:1px solid #e0e0e0;">Customs & Brokerage</td><td style="text-align:right;padding:8px 0;border-bottom:1px solid #e0e0e0;">{customsCost}</td></tr>
    <tr style="font-weight:700;"><td style="padding:10px 0;">Estimated Total</td><td style="text-align:right;padding:10px 0;">{totalCost}</td></tr>
  </table>
  <p style="font-size:12px;color:#888;margin-top:12px;">Placeholders ({...}) should be replaced with actual figures before sending.</p>
</div>`,
    category: 'block',
    emailTypes: ['pricing_summary'],
  },
];

/**
 * Returns snippets available for a given email type.
 * @param emailType The email type key (e.g. "quote_recap"). Pass empty for all.
 */
export function getSnippetsForType(emailType: string): EmailSnippet[] {
  if (!emailType) return EMAIL_SNIPPETS;
  return EMAIL_SNIPPETS.filter(
    (s) => !s.emailTypes || s.emailTypes.length === 0 || s.emailTypes.includes(emailType),
  );
}