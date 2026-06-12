<script lang="ts">
  // Legally-binding quote-acceptance terms.
  // Linked from the consent checkbox on every client quote-acceptance surface
  // (QuoteView / BlockRenderer accept block / QuoteAcceptance attestation form).
  // Public, no-auth, noindex — it simply explains, in precise plain language,
  // exactly what a client agrees to when they accept a quote.
  const effectiveDate = 'June 2026';
</script>

<svelte:head>
  <title>Quote Acceptance Terms | International Relocation Partner</title>
  <meta name="robots" content="noindex, nofollow" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<div class="lp-root">
  <header class="lp-header">
    <img src="/IRP-LOGO.jpg" alt="IRP" class="lp-logo" on:error={(e) => ((e.currentTarget as HTMLImageElement).style.display = 'none')} />

    <span class="lp-brand">International Relocation Partner</span>
  </header>

  <main class="lp-main">
    <span class="lp-eyebrow">Legally Binding Agreement</span>
    <h1 class="lp-title">What you’re agreeing to when you accept a quote</h1>
    <p class="lp-lede">
      This page explains, in plain language, exactly what happens when you tick the consent box,
      type your full legal name, and accept a quote inside your Relocation Portal. Please read it
      carefully — accepting a quote forms a binding agreement between you and International
      Relocation Partner (“IRP”, “we”, “us”).
    </p>
    <p class="lp-meta">Effective {effectiveDate}</p>

    <div class="lp-callout">
      <span class="lp-callout__icon">✓</span>
      <p>
        Accepting is a deliberate, recorded action. We capture <strong>your typed full legal name</strong>,
        the <strong>exact date and time</strong>, the <strong>specific quote and the services you selected</strong>,
        and the <strong>total price</strong> shown to you. This record is your electronic signature.
      </p>
    </div>

    <section class="lp-section">
      <h2><span class="lp-num">1</span> The agreement you’re forming</h2>
      <p>
        When you accept, you confirm that you have reviewed the quote — the listed services, their
        scope, and the total price — and you authorise IRP to proceed with arranging those services
        on your behalf at that price. The accepted quote, together with these terms, becomes the
        agreement between us for the work described.
      </p>
    </section>

    <section class="lp-section">
      <h2><span class="lp-num">2</span> Price &amp; what it covers</h2>
      <ul class="lp-list">
        <li>The total you accept is the price for the <strong>services listed in that quote</strong>, in the currency shown.</li>
        <li>If you selected or de-selected optional line items, you agree to the <strong>final total reflecting those choices</strong> — that is the amount shown to you at acceptance.</li>
        <li>Quotes may rely on details you provided (origin, destination, volume, dates, special items). If those materially change, the price may need to be revised, and we’ll tell you before any change takes effect.</li>
        <li>Unless explicitly stated in the quote, the price excludes duties, taxes, statutory fees, storage beyond agreed periods, and third-party charges outside our control.</li>
      </ul>
    </section>

    <section class="lp-section">
      <h2><span class="lp-num">3</span> Who may accept</h2>
      <p>
        Only the client this project is registered to may accept a quote. Acceptance is tied to the
        secure session linked to your registered email. IRP team members cannot accept on your
        behalf — the decision, and the legal commitment, are exclusively yours.
      </p>
    </section>

    <section class="lp-section">
      <h2><span class="lp-num">4</span> Electronic signature &amp; consent</h2>
      <p>
        By typing your full legal name and ticking the consent box, you agree that this constitutes
        your electronic signature, carrying the same legal effect as a handwritten signature, and
        that you intend to be bound by this agreement. You confirm you are at least 18 years old and
        legally able to enter into this agreement.
      </p>
    </section>

    <section class="lp-section">
      <h2><span class="lp-num">5</span> What happens next</h2>
      <ul class="lp-list">
        <li>Your acceptance is recorded and your project advances to the next stage automatically.</li>
        <li>A member of our team follows up to confirm scheduling, documentation, and payment arrangements.</li>
        <li>Specific timelines depend on carrier availability, customs, and information you provide. Estimated dates are not guarantees.</li>
      </ul>
    </section>

    <section class="lp-section">
      <h2><span class="lp-num">6</span> Changes &amp; cancellation</h2>
      <p>
        You may request changes or cancellation by contacting your IRP coordinator. Depending on how
        far the work has progressed, third-party commitments already made on your behalf (for
        example, booked container space or carrier slots) may be non-refundable. We’ll always be
        transparent about any costs before they’re incurred where reasonably possible.
      </p>
    </section>

    <section class="lp-section">
      <h2><span class="lp-num">7</span> Your information</h2>
      <p>
        We process the personal and shipment details you share solely to deliver the services in your
        quote and to coordinate with the vetted partners who carry them out. We don’t sell your data.
      </p>
    </section>

    <section class="lp-section">
      <h2><span class="lp-num">8</span> Questions before you accept</h2>
      <p>
        If anything in your quote is unclear, please don’t accept yet — reach out through your portal
        chat (Lily) or reply to any email from our team, and we’ll walk you through it. Accepting is
        only ever meant to happen once you’re confident and comfortable.
      </p>
    </section>

    <div class="lp-footer-note">
      <p>
        This page summarises the terms applicable to quote acceptance and may be supplemented by a
        formal services agreement for your specific move. Where a signed services agreement exists,
        its terms prevail to the extent of any conflict.
      </p>
    </div>

    <button class="lp-back" type="button" on:click={() => history.back()}>← Back to your quote</button>

  </main>

  <footer class="lp-foot">
    <span>Powered by</span>
    <strong>International Relocation Partner</strong>
  </footer>
</div>

<style>
  :global(body) {
    margin: 0;
    background: #020d10;
  }
  .lp-root {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    background:
      radial-gradient(ellipse 80% 60% at 50% -10%, rgba(2, 181, 187, 0.10) 0%, transparent 60%),
      linear-gradient(180deg, #020d10 0%, #03141a 100%);
    color: #e8eef2;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
    padding: 0 1.1rem 3.5rem;
  }
  .lp-header {
    width: 100%;
    max-width: 760px;
    display: flex;
    align-items: center;
    gap: 0.65rem;
    padding: 1.6rem 0 0;
    margin-bottom: 1.75rem;
  }
  .lp-logo { height: 30px; width: auto; border-radius: 6px; opacity: 0.95; }

  .lp-brand {
    font-size: 0.74rem;
    font-weight: 700;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: rgba(232, 238, 242, 0.5);
  }
  .lp-main {
    width: 100%;
    max-width: 760px;
    background: rgba(255, 255, 255, 0.025);
    border: 1px solid rgba(2, 181, 187, 0.16);
    border-radius: 22px;
    padding: 2.5rem 2.25rem;
    box-shadow: 0 8px 48px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }
  .lp-eyebrow {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #03cdd4;
    margin-bottom: 0.75rem;
  }
  .lp-title {
    font-size: 1.9rem;
    font-weight: 800;
    line-height: 1.18;
    letter-spacing: -0.02em;
    margin: 0 0 1rem;
    color: #f8fafc;
  }
  .lp-lede {
    font-size: 1rem;
    line-height: 1.7;
    color: rgba(232, 238, 242, 0.72);
    margin: 0 0 0.75rem;
  }
  .lp-meta {
    font-size: 0.78rem;
    color: rgba(232, 238, 242, 0.4);
    margin: 0 0 1.75rem;
    letter-spacing: 0.02em;
  }
  .lp-callout {
    display: flex;
    align-items: flex-start;
    gap: 0.85rem;
    background: rgba(2, 181, 187, 0.08);
    border: 1px solid rgba(2, 181, 187, 0.28);
    border-radius: 14px;
    padding: 1.1rem 1.25rem;
    margin-bottom: 2.25rem;
  }
  .lp-callout__icon {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: #02b5bb;
    color: #020d10;
    font-weight: 900;
    display: grid;
    place-items: center;
    font-size: 0.9rem;
  }
  .lp-callout p {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.6;
    color: rgba(232, 238, 242, 0.85);
  }
  .lp-section { margin-bottom: 1.85rem; }
  .lp-section h2 {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    font-size: 1.05rem;
    font-weight: 800;
    color: #f1f5f9;
    margin: 0 0 0.6rem;
    letter-spacing: -0.01em;
  }
  .lp-num {
    flex-shrink: 0;
    width: 24px;
    height: 24px;
    border-radius: 7px;
    background: rgba(2, 181, 187, 0.14);
    border: 1px solid rgba(2, 181, 187, 0.32);
    color: #03cdd4;
    font-size: 0.8rem;
    font-weight: 800;
    display: grid;
    place-items: center;
  }
  .lp-section p {
    margin: 0;
    font-size: 0.92rem;
    line-height: 1.7;
    color: rgba(232, 238, 242, 0.7);
  }
  .lp-list {
    margin: 0.4rem 0 0;
    padding-left: 1.15rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .lp-list li {
    font-size: 0.92rem;
    line-height: 1.65;
    color: rgba(232, 238, 242, 0.7);
  }
  .lp-list li strong, .lp-callout strong {
    color: #e8f8f9;
    font-weight: 700;
  }

  .lp-footer-note {
    margin-top: 2.25rem;
    padding-top: 1.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
  }
  .lp-footer-note p {
    margin: 0;
    font-size: 0.8rem;
    line-height: 1.6;
    color: rgba(232, 238, 242, 0.45);
    font-style: italic;
  }
  .lp-back {
    display: inline-block;
    margin-top: 1.75rem;
    color: #03cdd4;
    font-size: 0.9rem;
    font-weight: 700;
    text-decoration: none;
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    font-family: inherit;
  }
  .lp-back:hover { text-decoration: underline; }

  .lp-foot {
    margin-top: 2rem;
    display: flex;
    gap: 0.35rem;
    font-size: 0.78rem;
    color: rgba(232, 238, 242, 0.35);
  }
  .lp-foot strong { color: rgba(232, 238, 242, 0.6); }

  @media (max-width: 560px) {
    .lp-main { padding: 1.75rem 1.35rem; }
    .lp-title { font-size: 1.5rem; }
  }
</style>
