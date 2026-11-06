<script lang="ts">
  /**
   * PaymentStep.svelte — "Reserve your move", shown the moment a client signs.
   * ────────────────────────────────────────────────────────────────────────
   * Built to the Payments UX plan's design language: one question per step,
   * plain words, the result shown before the action, statuses as word + icon +
   * color, help where the question is.
   *
   *   1. How much do you want to pay today?   (deposit or in full — priced by
   *      the server from the signed agreement; the browser only picks a plan)
   *   2. How do you want to pay?               Card · US bank account · Wire,
   *      three equal choices. Card and bank open Stripe's form already on that
   *      method, so the form never asks a second "card or bank?" question.
   *   3. Pay                                  a summary that says what will
   *      happen stays next to the button (sticky on phones).
   *
   * A card payment starts the project at once; a bank payment is "On its way"
   * for up to 4 business days; a wire waits for the team to confirm it.
   *
   * Accessibility: native radios in fieldsets with legends, one polite live
   * region for every change, errors as alerts, focus moved to the result after
   * paying, 44px+ targets, visible focus, WCAG AA contrast, reduced motion.
   */
  import { onMount, tick, createEventDispatcher } from 'svelte';
  import { page } from '$app/stores';
  import { loadStripe, type Stripe, type StripeElements } from '@stripe/stripe-js';
  import {
    fetchQuotePayments,
    startQuotePayment,
    syncQuotePayment,
    reportWireTransfer,
    type ClientPaymentState,
    type PaymentPlan,
  } from '../../dashboard/store.ts';
  import StatusPill from '../../../lib/payments/StatusPill.svelte';
  import { friendlyPaymentError, statusOfPayment } from '../../../lib/payments/paymentStatus.ts';

  export let consultationId: string;
  export let token: string;
  /** IRP staff previewing the portal: show everything, take no money. */
  export let isStaff = false;

  const dispatch = createEventDispatcher<{ paid: { status: string } }>();

  type Method = 'card' | 'bank' | 'wire';

  let state: ClientPaymentState | null = null;
  let loading = true;
  let loadError = '';

  let plan: PaymentPlan = 'next';
  let method: Method = 'card';
  let methodTouched = false;

  let stripe: Stripe | null = null;
  let elements: StripeElements | null = null;
  let elementHost: HTMLDivElement;
  let elementReady = false;
  let preparing = false;
  let prepareError = '';
  let mountedFor = '';
  let prepareSeq = 0;
  let paying = false;
  let payError = '';

  // Wire
  let wireFrom: 'us' | 'intl' = 'us';
  let wireAmount = '';
  let wireDate = new Date().toISOString().slice(0, 10);
  let wireSending = false;
  let wireSent = false;
  let wireSentOn = '';
  let wireError = '';

  let announce = '';
  let resultHeading: HTMLHeadingElement;
  /** After the first payment the form stays folded until the client asks for it. */
  let wantsToPayMore = false;
  let helpOpen = false;
  let wireTouched = false;

  $: summary = state?.summary ?? null;
  $: options = summary?.options ?? [];
  $: if (options.length && !options.some((o) => o.plan === plan)) plan = options[0].plan;
  $: selected = options.find((o) => o.plan === plan) ?? null;
  $: onlineAvailable = !!state?.enabled && !!state?.publishableKey;
  $: bankAvailable = onlineAvailable && !!state?.methods.bank;
  $: if (state && !onlineAvailable) method = 'wire';
  $: if (state && method === 'bank' && !bankAvailable) method = onlineAvailable ? 'card' : 'wire';
  $: onItsWay = state?.latest?.status === 'processing' || (summary?.processing ?? 0) > 0;
  $: lastFailed = state?.latest?.status === 'requires_payment_method' && !!state?.latest?.failureMessage;
  $: received = summary?.received ?? 0;
  $: reference = state?.quote.contractRef || state?.quote.title || 'IRP';
  $: formOpen = !onItsWay && (received <= 0 || wantsToPayMore);
  $: if (selected && !wireTouched) wireAmount = selected.amount.toFixed(2);

  $: deposit = summary && summary.schedule.length > 1 ? summary.schedule[0] : null;
  $: later = summary && summary.schedule.length > 1 ? summary.schedule.slice(1) : [];

  const METHOD_INFO: Record<Method, { name: string; when: string; detail: string }> = {
    card: { name: 'Card', when: 'Confirms instantly', detail: 'Visa, Mastercard, Amex, Apple Pay or Google Pay' },
    bank: { name: 'US bank account', when: 'Up to 4 business days', detail: 'No extra cost. Log in to your bank or enter your account details.' },
    wire: { name: 'Wire', when: '1–3 business days', detail: 'From any bank, in the US or abroad' },
  };

  function fmt(n: number | null | undefined, currency = summary?.currency ?? 'USD'): string {
    const v = typeof n === 'number' && Number.isFinite(n) ? n : 0;
    try {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(v);
    } catch {
      return `${currency} ${v.toFixed(2)}`;
    }
  }

  function say(msg: string) {
    announce = '';
    tick().then(() => (announce = msg));
  }

  async function load() {
    loading = true;
    loadError = '';
    try {
      state = await fetchQuotePayments(consultationId, token);
      if (state.transferReportedAt) {
        wireSent = true;
        if (!state.summary.received && !methodTouched) method = 'wire';
      }
    } catch (e: any) {
      loadError = e?.message ?? 'We couldn’t load your payment options. Please try again.';
    } finally {
      loading = false;
    }
  }

  /** Stripe sends the client back here after a bank login or a 3-D Secure check. */
  async function handleReturn(): Promise<boolean> {
    const params = $page.url.searchParams;
    const piId = params.get('payment_intent');
    if (!piId) return false;
    const clean = new URL(window.location.href);
    ['payment_intent', 'payment_intent_client_secret', 'redirect_status'].forEach((k) => clean.searchParams.delete(k));
    history.replaceState(history.state, '', clean.toString());
    try {
      await syncQuotePayment(consultationId, token, piId);
    } catch { /* the webhook / 10-minute check will still catch it */ }
    return true;
  }

  function teardownElement() {
    try { elements?.getElement('payment')?.destroy(); } catch { /* already gone */ }
    elements = null;
    mountedFor = '';
    elementReady = false;
  }

  async function prepareOnline() {
    if (isStaff || !onlineAvailable || !selected || method === 'wire' || !formOpen) return;
    const key = `${plan}:${method}:${selected.amount}`;
    if (mountedFor === key && elements) return;
    const mySeq = ++prepareSeq;
    preparing = true;
    prepareError = '';
    payError = '';
    elementReady = false;
    try {
      const intent = await startQuotePayment(consultationId, token, plan, method);
      stripe = stripe ?? (await loadStripe(intent.publishableKey));
      if (!stripe) throw new Error('The secure payment form didn’t load. Please refresh the page.');
      if (mySeq !== prepareSeq) return; // the client changed their mind meanwhile
      teardownElement();
      elements = stripe.elements({
        clientSecret: intent.clientSecret,
        appearance: APPEARANCE,
        fonts: [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Jost:wght@400;500;600;700&display=swap' }],
        loader: 'auto',
      });
      await tick();
      const el = elements.create('payment', {
        layout: { type: 'tabs' },
        business: { name: 'International Relocation Partner' },
        terms: { card: 'never', usBankAccount: 'auto' },
        // Link is on at the account level and would add its own "Bank" and
        // "Klarna" tabs plus a sign-up box to a card-only form — exactly the
        // second choice this page removes. Apple Pay / Google Pay stay.
        wallets: { link: 'never', applePay: 'auto', googlePay: 'auto' },
      });
      el.on('ready', () => {
        elementReady = true;
        say(`${METHOD_INFO[method].name} form ready. ${fmt(intent.amount)}.`);
      });
      el.on('loaderror', (ev: any) => {
        prepareError = friendlyPaymentError(ev?.error);
      });
      el.mount(elementHost);
      mountedFor = key;
    } catch (e: any) {
      if (mySeq === prepareSeq) {
        prepareError = e?.message ?? 'We couldn’t open the payment form. Please try again.';
        mountedFor = '';
      }
    } finally {
      if (mySeq === prepareSeq) preparing = false;
    }
  }

  // Leaving card/bank (or folding the form) releases Stripe's form so it
  // remounts cleanly when the client comes back.
  $: if ((method === 'wire' || !formOpen) && mountedFor) teardownElement();
  $: if (state && method !== 'wire' && selected && formOpen) void prepareOnline();

  async function pay() {
    if (!stripe || !elements || paying || isStaff) return;
    paying = true;
    payError = '';
    say('Processing your payment. Please keep this page open.');
    try {
      const returnUrl = new URL(window.location.href);
      returnUrl.hash = 'payment';
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: { return_url: returnUrl.toString() },
        redirect: 'if_required',
      });
      if (error) {
        payError = friendlyPaymentError(error);
        say(payError);
        // Record the attempt (for the payment log) without waiting on it.
        const piId = (error as any)?.payment_intent?.id;
        if (piId) syncQuotePayment(consultationId, token, piId).catch(() => {});
        return;
      }
      if (paymentIntent) {
        try {
          await syncQuotePayment(consultationId, token, paymentIntent.id);
        } catch { /* reconciled by webhook / the 10-minute check */ }
        teardownElement();
        wantsToPayMore = false;
        await load();
        await tick();
        resultHeading?.focus();
        say(paymentIntent.status === 'processing'
          ? 'Your bank payment is on its way. It takes up to 4 business days.'
          : 'Payment received. Thank you, your move is reserved.');
        dispatch('paid', { status: paymentIntent.status });
      }
    } catch (e: any) {
      payError = friendlyPaymentError(e);
      say(payError);
    } finally {
      paying = false;
    }
  }

  async function sendWireNotice() {
    if (wireSending || isStaff) return;
    const amount = Number(String(wireAmount).replace(/[$,\s]/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) {
      wireError = 'Please enter the amount you sent.';
      return;
    }
    wireSending = true;
    wireError = '';
    try {
      await reportWireTransfer(consultationId, token, { amount, reference, sentOn: wireDate });
      wireSent = true;
      wireSentOn = wireDate;
      await tick();
      resultHeading?.focus();
      say('Thank you. Our team will watch for your wire and email you when it arrives.');
    } catch (e: any) {
      wireError = e?.message ?? 'We couldn’t send this. Please reply to your agreement email with your bank receipt.';
    } finally {
      wireSending = false;
    }
  }

  // ── Copy ──────────────────────────────────────────────────────────────
  let copiedKey = '';
  async function copy(key: string, value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    copiedKey = key;
    say(`${label} copied.`);
    setTimeout(() => { if (copiedKey === key) copiedKey = ''; }, 1800);
  }

  type Field = { k: string; label: string; value: string; hint?: string };
  $: wireFields = ((): Field[] => {
    if (!state) return [];
    const b = state.bank.beneficiary;
    const r = state.bank.receivingBank;
    const common: Field[] = [
      { k: 'beneficiary', label: 'Account name', value: b.name },
      { k: 'account', label: 'Account number', value: b.accountNumber },
    ];
    if (wireFrom === 'us') {
      return [
        ...common,
        { k: 'routing', label: 'Routing number', value: r.wireRoutingNumber ?? r.abaRoutingNumber, hint: r.wireRoutingNumber ? `For a wire. Sending an ACH transfer instead? Use ${r.abaRoutingNumber}.` : undefined },
        { k: 'ref', label: 'Reference / memo', value: reference },
      ];
    }
    return [
      ...common,
      ...(r.swiftBic ? [{ k: 'swift', label: 'SWIFT / BIC code', value: r.swiftBic }] : []),
      { k: 'bank', label: 'Bank name and address', value: `${r.name}, ${r.address.join(', ')}` },
      { k: 'ref', label: 'Reference / message', value: reference },
    ];
  })();
  $: allWireText = [
    ...wireFields.map((f) => `${f.label}: ${f.value}`),
    state ? `Account holder address: ${state.bank.beneficiary.address.join(', ')}` : '',
    selected ? `Amount: ${fmt(selected.amount)}` : '',
  ].filter(Boolean).join('\n');

  function longDay(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }

  // Brand-matched Stripe form. Teal darkened to #0a7c81 wherever it carries
  // text or a focus ring, for WCAG AA (≈5:1 on white).
  const APPEARANCE = {
    theme: 'stripe' as const,
    variables: {
      colorPrimary: '#0a7c81',
      colorText: '#0f172a',
      colorTextSecondary: '#475569',
      colorDanger: '#b42318',
      colorBackground: '#ffffff',
      fontFamily: "Jost, Inter, system-ui, -apple-system, 'Segoe UI', sans-serif",
      fontSizeBase: '16px',
      fontWeightNormal: '400',
      fontWeightMedium: '600',
      borderRadius: '12px',
      spacingUnit: '4px',
      focusBoxShadow: '0 0 0 3px rgba(10, 124, 129, 0.35)',
      focusOutline: '2px solid #0a7c81',
    },
    rules: {
      '.Label': { fontWeight: '600', color: '#1e293b' },
      '.Input': { border: '1.5px solid #cbd5e1', boxShadow: 'none', padding: '12px 14px' },
      '.Input:focus': { borderColor: '#0a7c81' },
      '.Tab': { border: '1.5px solid #e2e8f0', boxShadow: 'none' },
      '.Tab--selected': { borderColor: '#0a7c81' },
    },
  };

  onMount(async () => {
    const returned = await handleReturn();
    await load();
    if (returned || $page.url.hash === '#payment') {
      await tick();
      document.getElementById('payment')?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      if (returned) resultHeading?.focus();
    }
  });
</script>

<section id="payment" class="ps" aria-labelledby="ps-title">
  <ol class="ps-steps" aria-label="Your progress">
    <li class="is-done"><span class="ps-steps__dot" aria-hidden="true">✓</span><span>Quote accepted</span></li>
    <li class="is-done"><span class="ps-steps__dot" aria-hidden="true">✓</span><span>Agreement signed</span></li>
    <li class:is-done={summary?.fullyPaid || received > 0} class:is-current={!(summary?.fullyPaid || received > 0)} aria-current={!(summary?.fullyPaid || received > 0) ? 'step' : undefined}>
      <span class="ps-steps__dot" aria-hidden="true">{summary?.fullyPaid || received > 0 ? '✓' : '3'}</span><span>Payment</span>
    </li>
    <li class:is-current={received > 0} aria-current={received > 0 ? 'step' : undefined}>
      <span class="ps-steps__dot" aria-hidden="true">4</span><span>Your move begins</span>
    </li>
  </ol>

  <header class="ps-head">
    <p class="ps-eyebrow">Last step</p>
    <h2 id="ps-title" class="ps-title">Project Management Fee</h2>
    {#if summary && deposit && received <= 0}
      <p class="ps-sub">
        Your agreement is <strong>{fmt(summary.agreedTotal)}</strong>: <strong>{fmt(deposit.amount)}</strong> now to reserve your move{#each later as row}, and <strong>{fmt(row.amount)}</strong>{row.index1 === summary.schedule.length ? ' when your shipment is picked up' : ''}{/each}.
      </p>
    {:else if summary && received <= 0}
      <p class="ps-sub">Your agreement is <strong>{fmt(summary.agreedTotal)}</strong>. Your project starts as soon as your payment arrives.</p>
    {/if}
  </header>

  <p class="ps-sr" aria-live="polite" aria-atomic="true">{announce}</p>

  {#if loading}
    <div class="ps-skeleton" aria-busy="true" aria-label="Loading your payment options">
      <span></span><span></span><span class="short"></span>
    </div>
  {:else if loadError}
    <div class="ps-alert ps-alert--error" role="alert">
      <p>{loadError}</p>
      <button type="button" class="ps-btn ps-btn--ghost" on:click={load}>Try again</button>
    </div>
  {:else if state && summary}
    {#if isStaff}
      <p class="ps-staff">Staff preview: this is what the client sees. Only the client can pay here.</p>
    {/if}

    <!-- ── Where things stand ──────────────────────────────────────────── -->
    {#if summary.fullyPaid}
      <div class="ps-result ps-result--received">
        <h3 class="ps-result__title" tabindex="-1" bind:this={resultHeading}>You’re all paid</h3>
        <p>We received {fmt(summary.agreedTotal)}. Thank you. Our operations team is taking care of your move.</p>
      </div>
    {:else if onItsWay}
      <div class="ps-result ps-result--on_its_way">
        <h3 class="ps-result__title" tabindex="-1" bind:this={resultHeading}>Your bank payment is on its way</h3>
        <p>{fmt(summary.processing)} from {state.latest?.methodLabel ?? 'your bank account'} takes up to 4 business days to arrive. You don’t need to do anything.</p>
        <ul class="ps-next">
          <li>We’ll email you when it arrives.</li>
          <li>Your project starts automatically at that moment.</li>
        </ul>
      </div>
    {:else if received > 0}
      <div class="ps-result ps-result--received">
        <h3 class="ps-result__title" tabindex="-1" bind:this={resultHeading}>Your move is reserved</h3>
        <p>We received {fmt(received)}. Thank you.</p>
        <p class="ps-next__title">What happens now</p>
        <ul class="ps-next">
          <li>Your receipt is in your email.</li>
          <li>Our operations team will contact you to plan the next steps.</li>
          {#if summary.outstanding > 0}
            <li><strong>{fmt(summary.outstanding)}</strong> is left to pay{summary.schedule.length > 1 ? ', due when your shipment is picked up' : ''}. You can also pay it below whenever you like.</li>
          {/if}
        </ul>
      </div>
    {:else if wireSent && method === 'wire'}
      <div class="ps-result ps-result--on_its_way">
        <h3 class="ps-result__title" tabindex="-1" bind:this={resultHeading}>Thanks. We’re watching for your wire</h3>
        <p>Wires usually arrive in 1–3 business days{wireSentOn ? ` after ${longDay(wireSentOn)}` : ''}. We’ll email you as soon as it lands, and your project starts then.</p>
      </div>
    {:else}
      <h3 class="ps-sr" tabindex="-1" bind:this={resultHeading}>Payment</h3>
    {/if}

    {#if lastFailed && !onItsWay && received <= 0}
      <div class="ps-alert ps-alert--error" role="alert">
        <p><strong>Your last payment didn’t go through.</strong> {state.latest?.failureMessage}</p>
      </div>
    {/if}

    {#if onItsWay}
      <!-- Nothing to choose while a bank payment arrives; the rest reopens after. -->
    {:else if options.length > 0 && !formOpen}
      <div class="ps-more">
        <p><strong>{fmt(summary.outstanding)}</strong> left to pay{summary.schedule.length > 1 ? ', due when your shipment is picked up' : ''}.</p>
        <button type="button" class="ps-btn ps-btn--secondary" on:click={() => (wantsToPayMore = true)}>Pay the rest now</button>
      </div>
    {:else if options.length > 0}
      <!-- ── 1. How much ──────────────────────────────────────────────── -->
      <fieldset class="ps-fieldset">
        <legend class="ps-legend"><span class="ps-num" aria-hidden="true">1</span> How much do you want to pay today?</legend>
        <div class="ps-options">
          {#each options as opt (opt.plan)}
            <label class="ps-option" class:is-selected={plan === opt.plan}>
              <input type="radio" name="ps-plan" value={opt.plan} bind:group={plan} disabled={paying} />
              <span class="ps-option__body">
                <span class="ps-option__label">{opt.label}</span>
                <span class="ps-option__desc">{opt.description}</span>
              </span>
              <span class="ps-option__amount">{fmt(opt.amount)}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <!-- ── 2. How ───────────────────────────────────────────────────── -->
      <fieldset class="ps-fieldset">
        <legend class="ps-legend"><span class="ps-num" aria-hidden="true">2</span> How do you want to pay?</legend>
        <div class="ps-methods" class:ps-methods--two={!bankAvailable && onlineAvailable} class:ps-methods--one={!onlineAvailable}>
          {#each (onlineAvailable ? (bankAvailable ? ['card', 'bank', 'wire'] : ['card', 'wire']) : ['wire']) as m}
            {@const info = METHOD_INFO[m as Method]}
            <label class="ps-method" class:is-selected={method === m}>
              <input type="radio" name="ps-method" value={m} bind:group={method} on:change={() => (methodTouched = true)} disabled={paying} />
              <span class="ps-method__icon" aria-hidden="true">
                {#if m === 'card'}
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19M6.5 15h4"/></svg>
                {:else if m === 'bank'}
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 10 12 4l9 6M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18"/></svg>
                {:else}
                  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>
                {/if}
              </span>
              <span class="ps-method__name">{info.name}</span>
              <span class="ps-method__when">{info.when}</span>
              <span class="ps-method__desc">{info.detail}</span>
            </label>
          {/each}
        </div>
      </fieldset>

      <!-- ── 3. Pay ───────────────────────────────────────────────────── -->
      {#if method !== 'wire'}
        <div class="ps-panel">
          {#if isStaff}
            <p class="ps-muted">The secure {METHOD_INFO[method].name.toLowerCase()} form appears here for the client.</p>
          {:else}
            {#if preparing && !elementReady}
              <div class="ps-skeleton ps-skeleton--form" aria-busy="true" aria-label="Opening the secure form">
                <span></span><span></span><span class="short"></span>
              </div>
            {/if}
            {#if prepareError}
              <div class="ps-alert ps-alert--error" role="alert">
                <p>{prepareError}</p>
                <button type="button" class="ps-btn ps-btn--ghost" on:click={() => { mountedFor = ''; prepareOnline(); }}>Try again</button>
              </div>
            {/if}
            <div class="ps-element" bind:this={elementHost} class:is-hidden={!elementReady && !!prepareError}></div>
            {#if payError}
              <div class="ps-alert ps-alert--error" role="alert"><p>{payError}</p></div>
            {/if}

            <div class="ps-paybar">
              <p class="ps-summary">
                You’ll pay <strong>{fmt(selected?.amount)}</strong> by {method === 'card' ? 'card' : 'bank account'}.
                {method === 'card'
                  ? 'It confirms instantly and your move is reserved right away.'
                  : 'It arrives in up to 4 business days; your move is reserved when it does.'}
              </p>
              <button type="button" class="ps-btn ps-btn--pay" on:click={pay} disabled={!elementReady || paying} aria-busy={paying}>
                {#if paying}
                  <span class="ps-spinner" aria-hidden="true"></span> Processing…
                {:else}
                  <svg aria-hidden="true" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/></svg>
                  Pay {fmt(selected?.amount)}
                {/if}
              </button>
              <p class="ps-trust">Secured by Stripe. IRP never sees your card or bank login. A receipt is emailed to you.</p>
            </div>
          {/if}
        </div>
      {:else}
        <div class="ps-panel">
          <fieldset class="ps-fieldset ps-fieldset--inline">
            <legend class="ps-sublegend">Where are you sending from?</legend>
            <div class="ps-seg">
              <label class:is-selected={wireFrom === 'us'}><input type="radio" name="ps-wirefrom" value="us" bind:group={wireFrom} /> A US bank</label>
              <label class:is-selected={wireFrom === 'intl'}><input type="radio" name="ps-wirefrom" value="intl" bind:group={wireFrom} /> A bank outside the US</label>
            </div>
          </fieldset>

          <p class="ps-hint">Send <strong>{fmt(selected?.amount)}</strong> using these details. Include the reference so we can match your wire to your move.</p>
          <dl class="ps-bank">
            {#each wireFields as row (row.k)}
              <div class="ps-bank__row">
                <dt>{row.label}</dt>
                <dd>
                  <span class="ps-bank__val">
                    <span class="ps-mono">{row.value}</span>
                    {#if row.hint}<span class="ps-bank__hint">{row.hint}</span>{/if}
                  </span>
                  <button type="button" class="ps-copy" class:is-copied={copiedKey === row.k} on:click={() => copy(row.k, row.value, row.label)} aria-label={`Copy ${row.label}`}>{copiedKey === row.k ? 'Copied' : 'Copy'}</button>
                </dd>
              </div>
            {/each}
          </dl>
          <button type="button" class="ps-btn ps-btn--ghost ps-copyall" on:click={() => copy('all', allWireText, 'All wire details')}>
            {copiedKey === 'all' ? '✓ All details copied' : 'Copy all details'}
          </button>
          <p class="ps-fine">Your bank may charge a sending fee; that is paid by the sender.</p>

          {#if !isStaff && !wireSent}
            <div class="ps-wiresent">
              <p class="ps-sublegend">Already sent it? Tell us, so we can watch for it.</p>
              <div class="ps-wiresent__grid">
                <label>Amount sent<input inputmode="decimal" bind:value={wireAmount} on:input={() => (wireTouched = true)} /></label>
                <label>Date sent<input type="date" bind:value={wireDate} /></label>
              </div>
              {#if wireError}<div class="ps-alert ps-alert--error" role="alert"><p>{wireError}</p></div>{/if}
              <button type="button" class="ps-btn ps-btn--secondary" on:click={sendWireNotice} disabled={wireSending} aria-busy={wireSending}>
                {wireSending ? 'Sending…' : 'I’ve sent the wire'}
              </button>
            </div>
          {/if}
        </div>
      {/if}
    {/if}

    {#if state.history.length > 0}
      <div class="ps-history">
        <h3 class="ps-history__title">Your payments</h3>
        <ul>
          {#each state.history as p (p.paymentIntentId)}
            <li>
              <span class="ps-history__main">
                <span>{fmt(p.amount, p.currency)}</span>
                <span class="ps-muted">{p.methodLabel ?? 'Online payment'} · {longDay(p.createdAt)}</span>
              </span>
              <StatusPill status={statusOfPayment(p.status)} size="sm" />
              {#if p.receiptUrl}
                <a class="ps-link" href={p.receiptUrl} target="_blank" rel="noopener noreferrer">Receipt<span class="ps-sr"> (opens in a new tab)</span></a>
              {/if}
            </li>
          {/each}
        </ul>
      </div>
    {/if}

    <details class="ps-help" bind:open={helpOpen}>
      <summary>Questions about paying?</summary>
      <dl>
        <dt>Is it safe?</dt><dd>Card and bank payments are processed by Stripe, used by millions of businesses. IRP never sees or stores your card number or bank login.</dd>
        <dt>Which should I choose?</dt><dd>A card is fastest. A US bank account has no extra cost but takes up to 4 business days. A wire works from any country.</dd>
        <dt>What if it doesn’t go through?</dt><dd>Nothing is charged. You’ll see why, and you can try again or choose another way to pay.</dd>
      </dl>
    </details>
  {/if}
</section>

<style>
  .ps {
    --ps-teal: #0a7c81;
    --ps-teal-bright: #02b5bb;
    --ps-ink: #0f172a;
    --ps-body: #334155;
    --ps-muted: #5b6b80;
    --ps-line: #e2e8f0;
    --ps-soft: #f0fbfb;
    max-width: 680px;
    margin: 28px auto 40px;
    padding: 32px 36px;
    background: #ffffff;
    border-radius: 22px;
    box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 24px 60px -12px rgba(15, 23, 42, 0.16);
    color: var(--ps-body);
    font-family: inherit;
    scroll-margin-top: 24px;
    animation: ps-rise 0.45s cubic-bezier(0.22, 0.61, 0.36, 1) both;
  }
  @keyframes ps-rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

  .ps-sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }

  .ps-steps { display: flex; gap: 6px; list-style: none; margin: 0 0 22px; padding: 0; }
  .ps-steps li { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 600; color: var(--ps-muted); text-align: center; position: relative; }
  .ps-steps li:not(:last-child)::after { content: ''; position: absolute; top: 14px; left: calc(50% + 18px); right: calc(-50% + 18px); height: 2px; background: var(--ps-line); }
  .ps-steps li.is-done:not(:last-child)::after { background: var(--ps-teal-bright); }
  .ps-steps__dot { width: 28px; height: 28px; border-radius: 50%; display: grid; place-items: center; font-size: 13px; font-weight: 800; border: 2px solid var(--ps-line); background: #fff; color: var(--ps-muted); }
  .ps-steps li.is-done .ps-steps__dot { background: var(--ps-teal); border-color: var(--ps-teal); color: #fff; }
  .ps-steps li.is-done { color: var(--ps-teal); }
  .ps-steps li.is-current .ps-steps__dot { border-color: var(--ps-teal); color: var(--ps-teal); box-shadow: 0 0 0 4px rgba(2, 181, 187, 0.16); }
  .ps-steps li.is-current { color: var(--ps-ink); }

  .ps-head { text-align: center; margin-bottom: 24px; }
  .ps-eyebrow { margin: 0 0 6px; font-size: 12px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--ps-teal); }
  .ps-title { margin: 0 0 8px; font-size: 28px; line-height: 1.15; font-weight: 800; letter-spacing: -0.02em; color: var(--ps-ink); }
  .ps-sub { margin: 0 auto; max-width: 520px; font-size: 16px; line-height: 1.55; color: var(--ps-body); }
  .ps-sub strong { color: var(--ps-ink); font-variant-numeric: tabular-nums; }

  .ps-staff { margin: 0 0 16px; padding: 10px 14px; border-radius: 10px; background: #fff7ed; color: #9a3412; font-size: 14px; border: 1px solid #fed7aa; }

  .ps-result { border-radius: 16px; padding: 20px 22px; margin: 0 0 22px; border: 1.5px solid; }
  .ps-result p { margin: 0; font-size: 15.5px; line-height: 1.6; }
  .ps-result__title { margin: 0 0 6px; font-size: 19px; font-weight: 800; color: var(--ps-ink); outline: none; display: flex; align-items: center; gap: 8px; }
  .ps-result__title:focus-visible { outline: 3px solid var(--ps-teal); outline-offset: 4px; border-radius: 4px; }
  .ps-result--received { background: #f0fdf4; border-color: #86efac; }
  .ps-result--received .ps-result__title::before { content: '✓'; display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: #16a34a; color: #fff; font-size: 14px; }
  .ps-result--on_its_way { background: #f0f9ff; border-color: #7dd3fc; }
  .ps-result--on_its_way .ps-result__title::before { content: '◷'; display: inline-grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: #0369a1; color: #fff; font-size: 14px; }
  .ps-next__title { margin-top: 12px !important; font-weight: 700; color: var(--ps-ink); }
  .ps-next { margin: 6px 0 0; padding-left: 20px; font-size: 15px; line-height: 1.6; }

  .ps-fieldset { border: 0; margin: 0 0 24px; padding: 0; min-width: 0; }
  .ps-legend { display: flex; align-items: center; gap: 10px; margin: 0 0 12px; padding: 0; font-size: 17px; font-weight: 700; color: var(--ps-ink); }
  .ps-num { width: 26px; height: 26px; border-radius: 50%; display: inline-grid; place-items: center; background: var(--ps-soft); color: var(--ps-teal); font-size: 13px; font-weight: 800; }

  .ps-options { display: grid; gap: 10px; }
  .ps-option, .ps-method {
    position: relative; border: 1.5px solid #cbd5e1; border-radius: 14px; background: #fff; cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
  }
  .ps-option { display: flex; align-items: center; gap: 14px; min-height: 56px; padding: 16px 18px; }
  .ps-option:hover, .ps-method:hover { border-color: #94a3b8; }
  .ps-option.is-selected, .ps-method.is-selected { border-color: var(--ps-teal); background: var(--ps-soft); box-shadow: 0 0 0 1px var(--ps-teal); }
  .ps-option input { width: 20px; height: 20px; margin: 0; flex: none; accent-color: var(--ps-teal); cursor: pointer; }
  .ps-option:has(input:focus-visible), .ps-method:has(input:focus-visible), .ps-seg label:has(input:focus-visible) { outline: 3px solid var(--ps-teal); outline-offset: 2px; }
  .ps-option__body { display: flex; flex-direction: column; gap: 2px; flex: 1; min-width: 0; }
  .ps-option__label { font-size: 16px; font-weight: 700; color: var(--ps-ink); }
  .ps-option__desc { font-size: 14px; color: var(--ps-muted); line-height: 1.45; }
  .ps-option__amount { font-size: 18px; font-weight: 800; color: var(--ps-ink); font-variant-numeric: tabular-nums; white-space: nowrap; }

  /* Three equal method cards */
  .ps-methods { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .ps-methods--two { grid-template-columns: repeat(2, 1fr); }
  .ps-methods--one { grid-template-columns: 1fr; }
  .ps-method { display: grid; grid-template-columns: 1fr auto; grid-template-areas: 'icon radio' 'name name' 'when when' 'desc desc'; gap: 2px; padding: 14px 16px 16px; }
  .ps-method input { grid-area: radio; width: 20px; height: 20px; margin: 0; accent-color: var(--ps-teal); cursor: pointer; }
  .ps-method__icon { grid-area: icon; color: var(--ps-teal); margin-bottom: 6px; }
  .ps-method__name { grid-area: name; font-size: 16px; font-weight: 700; color: var(--ps-ink); }
  .ps-method__when { grid-area: when; font-size: 13.5px; font-weight: 700; color: var(--ps-teal); }
  .ps-method__desc { grid-area: desc; font-size: 13.5px; color: var(--ps-muted); line-height: 1.45; margin-top: 4px; }

  .ps-panel { border-top: 1px solid var(--ps-line); padding-top: 20px; }
  .ps-hint { margin: 0 0 12px; font-size: 15px; color: var(--ps-body); line-height: 1.55; }
  .ps-hint strong { color: var(--ps-ink); }
  .ps-element { min-height: 40px; margin-bottom: 16px; }
  .ps-element.is-hidden { display: none; }

  .ps-paybar { display: grid; gap: 10px; }
  .ps-summary { margin: 0; padding: 12px 14px; border-radius: 12px; background: #f8fafc; border: 1px solid var(--ps-line); font-size: 15px; line-height: 1.5; color: var(--ps-body); }
  .ps-summary strong { color: var(--ps-ink); font-variant-numeric: tabular-nums; }
  .ps-trust { margin: 0; font-size: 13px; line-height: 1.5; color: var(--ps-muted); text-align: center; }

  .ps-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 10px; min-height: 48px;
    padding: 0 22px; border-radius: 999px; font: inherit; font-size: 16px; font-weight: 700; cursor: pointer;
    border: 1.5px solid transparent; transition: transform 0.12s, box-shadow 0.15s, background 0.15s;
  }
  .ps-btn:focus-visible { outline: 3px solid var(--ps-teal); outline-offset: 3px; }
  .ps-btn:disabled { cursor: not-allowed; opacity: 0.6; }
  .ps-btn--pay { width: 100%; min-height: 56px; font-size: 17.5px; color: #fff; background: linear-gradient(135deg, #0a7c81 0%, #086a6e 100%); box-shadow: 0 10px 24px -8px rgba(10, 124, 129, 0.55); }
  .ps-btn--pay:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 14px 28px -8px rgba(10, 124, 129, 0.6); }
  .ps-btn--secondary { width: 100%; background: #fff; color: var(--ps-teal); border-color: var(--ps-teal); }
  .ps-btn--secondary:hover:not(:disabled) { background: var(--ps-soft); }
  .ps-btn--ghost { background: transparent; color: var(--ps-teal); border-color: currentColor; min-height: 40px; font-size: 14.5px; }
  .ps-spinner { width: 18px; height: 18px; border-radius: 50%; border: 2.5px solid rgba(255,255,255,0.4); border-top-color: #fff; animation: ps-spin 0.8s linear infinite; }
  @keyframes ps-spin { to { transform: rotate(360deg); } }

  /* Wire */
  .ps-fieldset--inline { margin-bottom: 16px; }
  .ps-sublegend { margin: 0 0 8px; padding: 0; font-size: 15px; font-weight: 700; color: var(--ps-ink); }
  .ps-seg { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .ps-seg label { display: flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 14px; border: 1.5px solid #cbd5e1; border-radius: 12px; font-size: 15px; font-weight: 600; color: var(--ps-ink); cursor: pointer; }
  .ps-seg label.is-selected { border-color: var(--ps-teal); background: var(--ps-soft); box-shadow: 0 0 0 1px var(--ps-teal); }
  .ps-seg input { width: 18px; height: 18px; margin: 0; accent-color: var(--ps-teal); }
  .ps-bank { margin: 0 0 10px; border: 1px solid var(--ps-line); border-radius: 14px; overflow: hidden; }
  .ps-bank__row { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 10px 14px; border-bottom: 1px solid var(--ps-line); }
  .ps-bank__row:last-child { border-bottom: 0; }
  .ps-bank__row:nth-child(odd) { background: #fafcfd; }
  .ps-bank__row dt { font-size: 14px; color: var(--ps-muted); flex: none; }
  .ps-bank__row dd { margin: 0; display: flex; align-items: center; gap: 10px; min-width: 0; }
  .ps-bank__val { display: flex; flex-direction: column; align-items: flex-end; min-width: 0; }
  .ps-bank__hint { font-size: 12.5px; color: var(--ps-muted); text-align: right; }
  .ps-mono { font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace; font-size: 15px; color: var(--ps-ink); word-break: break-word; text-align: right; }
  .ps-copy { min-width: 64px; min-height: 36px; padding: 0 12px; border-radius: 8px; border: 1.5px solid #cbd5e1; background: #fff; font: inherit; font-size: 13px; font-weight: 700; color: var(--ps-teal); cursor: pointer; flex: none; }
  .ps-copy:hover { border-color: var(--ps-teal); }
  .ps-copy:focus-visible { outline: 3px solid var(--ps-teal); outline-offset: 2px; }
  .ps-copy.is-copied { background: var(--ps-teal); border-color: var(--ps-teal); color: #fff; }
  .ps-copyall { width: 100%; margin-bottom: 8px; }
  .ps-fine { margin: 0 0 18px; font-size: 13px; color: var(--ps-muted); line-height: 1.5; }
  .ps-wiresent { border-top: 1px solid var(--ps-line); padding-top: 16px; display: grid; gap: 10px; }
  .ps-wiresent__grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .ps-wiresent label { display: flex; flex-direction: column; gap: 6px; font-size: 14px; font-weight: 600; color: var(--ps-ink); }
  .ps-wiresent input { min-height: 46px; padding: 0 12px; border: 1.5px solid #cbd5e1; border-radius: 10px; font: inherit; font-size: 16px; color: var(--ps-ink); background: #fff; }
  .ps-wiresent input:focus { outline: 3px solid rgba(10, 124, 129, 0.35); border-color: var(--ps-teal); }

  .ps-alert { margin: 0 0 16px; padding: 12px 16px; border-radius: 12px; display: flex; gap: 12px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
  .ps-alert p { margin: 0; font-size: 15px; line-height: 1.5; }
  .ps-alert--error { background: #fef3f2; border: 1px solid #fecdca; color: #912018; }
  .ps-skeleton { display: grid; gap: 10px; margin: 8px 0 18px; }
  .ps-skeleton span { height: 52px; border-radius: 12px; background: linear-gradient(90deg, #f1f5f9 25%, #e2e8f0 37%, #f1f5f9 63%); background-size: 400% 100%; animation: ps-shimmer 1.4s ease infinite; }
  .ps-skeleton span.short { width: 60%; height: 18px; }
  @keyframes ps-shimmer { 0% { background-position: 100% 0; } 100% { background-position: 0 0; } }

  .ps-more { display: grid; gap: 12px; padding: 18px 20px; border-radius: 14px; background: #f8fafc; border: 1px solid var(--ps-line); }
  .ps-more p { margin: 0; font-size: 15.5px; line-height: 1.55; }
  .ps-more strong { color: var(--ps-ink); }

  .ps-history { margin-top: 26px; border-top: 1px solid var(--ps-line); padding-top: 18px; }
  .ps-history__title { margin: 0 0 10px; font-size: 15px; font-weight: 700; color: var(--ps-ink); }
  .ps-history ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .ps-history li { display: flex; align-items: center; gap: 12px; font-size: 14.5px; }
  .ps-history__main { display: flex; flex-direction: column; flex: 1; min-width: 0; }
  .ps-history__main > span:first-child { font-weight: 700; color: var(--ps-ink); font-variant-numeric: tabular-nums; }
  .ps-link { color: var(--ps-teal); font-weight: 700; text-underline-offset: 3px; }
  .ps-link:focus-visible { outline: 3px solid var(--ps-teal); outline-offset: 2px; border-radius: 3px; }

  .ps-help { margin-top: 22px; border-top: 1px solid var(--ps-line); padding-top: 14px; font-size: 14.5px; }
  .ps-help summary { cursor: pointer; font-weight: 700; color: var(--ps-teal); min-height: 32px; display: flex; align-items: center; }
  .ps-help summary:focus-visible { outline: 3px solid var(--ps-teal); outline-offset: 2px; border-radius: 4px; }
  .ps-help dl { margin: 8px 0 0; display: grid; gap: 4px; }
  .ps-help dt { font-weight: 700; color: var(--ps-ink); margin-top: 6px; }
  .ps-help dd { margin: 0; line-height: 1.55; color: var(--ps-body); }

  .ps-muted { color: var(--ps-muted); }

  @media (max-width: 640px) {
    .ps { margin: 16px 0 28px; padding: 24px 18px; border-radius: 18px; }
    .ps-title { font-size: 24px; }
    .ps-methods, .ps-methods--two { grid-template-columns: 1fr; }
    .ps-method { grid-template-columns: auto 1fr auto; grid-template-areas: 'icon name radio' 'icon when radio' 'icon desc radio'; column-gap: 12px; }
    .ps-method__icon { margin: 2px 0 0; }
    .ps-method input { align-self: center; }
    .ps-steps li { font-size: 11px; }
    .ps-option { flex-wrap: wrap; }
    .ps-option__amount { width: 100%; padding-left: 34px; }
    .ps-seg, .ps-wiresent__grid { grid-template-columns: 1fr; }
    .ps-bank__row { flex-direction: column; align-items: flex-start; }
    .ps-bank__row dd { width: 100%; justify-content: space-between; }
    .ps-bank__val { align-items: flex-start; }
    .ps-mono, .ps-bank__hint { text-align: left; }
    /* The amount and the button stay in reach while scrolling Stripe's form. */
    .ps-paybar { position: sticky; bottom: 0; z-index: 2; margin: 0 -18px -24px; padding: 12px 18px 16px; background: rgba(255,255,255,0.97); border-top: 1px solid var(--ps-line); box-shadow: 0 -8px 20px -12px rgba(15, 23, 42, 0.25); border-radius: 0 0 18px 18px; }
    .ps-summary { font-size: 14px; padding: 8px 10px; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ps, .ps-skeleton span, .ps-spinner { animation: none; }
    .ps-option, .ps-method, .ps-btn { transition: none; }
    .ps-btn--pay:hover:not(:disabled) { transform: none; }
  }

  @media (forced-colors: active) {
    .ps-option.is-selected, .ps-method.is-selected, .ps-seg label.is-selected { outline: 2px solid Highlight; }
  }
</style>
