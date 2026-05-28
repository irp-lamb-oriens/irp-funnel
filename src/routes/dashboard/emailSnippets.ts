/**
 * emailSnippets.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Declarative library of one-click HTML snippet insertions for the
 * EmailPreviewDrawer visual editor.
 *
 * HOW TO ADD A SNIPPET
 *   1. Add an entry to EMAIL_SNIPPETS below.
 *   2. That's it. The toolbar picks it up automatically.
 *
 * If `emailTypes` is omitted or empty, the snippet is available for every
 * email type. Set it to restrict availability (e.g. only show a "Quote table"
 * snippet on quote_recap emails).
 *
 * The html field is injected verbatim at the current caret position using
 * execCommand('insertHTML', ...) — so write it as you would inline HTML.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type SnippetCategory = 'cta' | 'signature' | 'block' | 'inline' | 'ops';

export interface EmailSnippet {
  id: string;
  label: string;
  /** Emoji icon shown in the snippet picker menu */
  icon: string;
  /** HTML inserted at the caret. Keep it inline-style friendly for email clients. */
  html: string;
  /** If set, snippet only appears when the email type matches one of these keys. */
  emailTypes?: string[];
  category: SnippetCategory;
}

export const EMAIL_SNIPPETS: EmailSnippet[] = [
  // ── CTAs ──────────────────────────────────────────────────────────────────
  {
    id: 'cta_book_call',
    label: 'Book a call button',
    icon: '📅',
    category: 'cta',
    html: `<div style="text-align:center;margin:24px 0;">
  <a href="https://calendly.com/irp" target="_blank"
     style="display:inline-block;background:#1e3a5f;color:#ffffff;font-family:Arial,sans-serif;
            font-size:16px;font-weight:bold;text-decoration:none;
            padding:14px 32px;border-radius:6px;">
    📅 Schedule Your Free Consultation
  </a>
</div>`,
  },
  {
    id: 'cta_reply_here',
    label: 'Reply here prompt',
    icon: '💬',
    category: 'cta',
    html: `<p style="font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;">
  Just hit reply and let me know — I'll get back to you within one business day.
</p>`,
  },

  // ── Signature ─────────────────────────────────────────────────────────────
  {
    id: 'signature_standard',
    label: 'Standard signature',
    icon: '✍️',
    category: 'signature',
    html: `<table style="font-family:Arial,sans-serif;font-size:13px;color:#555;margin-top:24px;border-top:1px solid #e0e0e0;padding-top:12px;">
  <tr>
    <td><strong style="color:#1e3a5f;">International Relocation Partners</strong></td>
  </tr>
  <tr>
    <td style="color:#888;">www.internationalrelocationpartner.com</td>
  </tr>
</table>`,
  },

  // ── Inline blocks ─────────────────────────────────────────────────────────
  {
    id: 'block_warm_close',
    label: 'Warm closing line',
    icon: '🤝',
    category: 'block',
    html: `<p style="font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;">
  Looking forward to helping make your move as smooth as possible. We're here every step of the way.
</p>`,
  },
  {
    id: 'block_next_steps',
    label: 'Next steps placeholder',
    icon: '➡️',
    category: 'block',
    html: `<p style="font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;font-weight:bold;">
  Here's what happens next:
</p>
<ol style="font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.8;padding-left:20px;">
  <li>Step one — describe it here</li>
  <li>Step two — describe it here</li>
  <li>Step three — describe it here</li>
</ol>`,
  },
  {
    id: 'block_divider',
    label: 'Divider line',
    icon: '─',
    category: 'block',
    html: `<hr style="border:none;border-top:1px solid #e0e0e0;margin:24px 0;" />`,
  },
  {
    id: 'block_highlight_box',
    label: 'Highlight box',
    icon: '📦',
    category: 'block',
    html: `<div style="background:#f0f7ff;border-left:4px solid #1e3a5f;padding:16px 20px;margin:16px 0;border-radius:4px;">
  <p style="font-family:Arial,sans-serif;font-size:14px;color:#1e3a5f;margin:0;line-height:1.6;">
    ✏️ Add your highlighted note here.
  </p>
</div>`,
  },

  // ── Ops-specific ──────────────────────────────────────────────────────────
  {
    id: 'ops_etd_placeholder',
    label: 'ETD / ETA placeholder',
    icon: '🚢',
    category: 'ops',
    emailTypes: ['ops_eta_client_update', 'ops_arrival_confirmation', 'ops_provider_date_request'],
    html: `<p style="font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;">
  <strong>Estimated Departure (ETD):</strong> [DATE]<br>
  <strong>Estimated Arrival (ETA):</strong> [DATE]<br>
  <strong>Vessel / Carrier:</strong> [CARRIER NAME]
</p>`,
  },
  {
    id: 'ops_docs_checklist',
    label: 'Documents checklist',
    icon: '📋',
    category: 'ops',
    html: `<p style="font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.6;font-weight:bold;">
  Documents you'll need to prepare:
</p>
<ul style="font-family:Arial,sans-serif;font-size:15px;color:#333;line-height:1.8;padding-left:20px;">
  <li>Passport (valid for at least 6 months)</li>
  <li>Bill of lading / packing list</li>
  <li>Proof of residence in destination country</li>
  <li>Customs declaration form</li>
</ul>`,
  },
];

/** Returns snippets visible for a given emailType (or all, if no emailType given). */
export function getSnippetsForEmailType(emailType?: string): EmailSnippet[] {
  if (!emailType) return EMAIL_SNIPPETS;
  return EMAIL_SNIPPETS.filter(
    (s) => !s.emailTypes || s.emailTypes.length === 0 || s.emailTypes.includes(emailType),
  );
}

/** Groups snippets by category for rendering the picker menu. */
export function groupSnippetsByCategory(
  snippets: EmailSnippet[],
): Record<SnippetCategory, EmailSnippet[]> {
  const groups: Record<SnippetCategory, EmailSnippet[]> = {
    cta: [],
    signature: [],
    block: [],
    inline: [],
    ops: [],
  };
  for (const s of snippets) {
    groups[s.category].push(s);
  }
  return groups;
}
