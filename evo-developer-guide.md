# Evo — Developer Guide

Evo is IRP's experiment system. The site, the chatbot and the drip emails each show one of two variants of a component (copy, colour, greeting, persona, subject, body). Evo records which variant each visitor was **assigned**, what they did next, and joins that to leads and won deals so the dashboard can say which variant works.

Design spec: `irp-funnel-server/docs/designs/evo-lab.md`. This guide covers what a developer needs day to day.

## Core concepts

| Term | Meaning |
|---|---|
| **Experiment / component** | One tested UI unit (`HeroForm`, `ChatbotPersona`, `EmailDripSubject` …). |
| **Variant (arm)** | One version of it (`v1-baseline`, `v3-urgent-copy`). One is the declared **control**. |
| **Assignment** | The moment a visitor is placed in an arm. Logged once as an `assignment` event with `meta.evo = { source, p }`. This is the denominator of every rate. |
| **Exposure** | The visitor saw the variant (one per component × variant × page view). |
| **Interaction** | The visitor did something (`cta_click`, `email_submit`, `first_user_message`, `email_click` …). The subtype names are the step metrics. |
| **Allocation** | Fixed traffic split per experiment (equal by default). No adaptive bandit while traffic is low (spec §5.8, §6.9). |

## 1. Register or change an experiment

The **server registry is the source of truth**: `irp-funnel-server/API/evo/registry.ts` (`EVO_REGISTRY`). Each entry declares:

```ts
MyButton: {
  componentKey: "MyButton",
  title: "Hero button text",
  surface: "web",                 // web | chat | email
  control: "v1-baseline",
  primaryMetric: "step:cta_click", // what decides the test
  guardrails: ["lead"],           // what must not get worse
  status: "running",
  startedAt: "2026-12-01T06:00:00.000Z", // assignments before this are ignored
  variants: [
    { key: "v1-baseline", label: "Blue", hypothesis: "Current production." },
    { key: "v2-red", label: "Red", hypothesis: "Red reads as urgent." },
  ],
},
```

Then mirror the keys, labels, `retiredIn` and `allocation` in the browser config `irp-funnel/src/lib/evo/config.ts` (`EVO_COMPONENTS`), and run:

```sh
cd irp-funnel-server && deno run -A scripts/test-evo-registry-parity.ts
```

It fails if the two drift, if the control is not an active arm, or if an experiment does not have exactly two active arms.

Rules:
- **Never rename a variant key.** Retire it (`retiredIn: "<reason or commit>"`) and add a new one. Visitors holding a retired arm are reassigned automatically (logged with `reassignedFrom`).
- **Changing `primaryMetric` requires a new `startedAt`.** Deciding on a different metric halfway through a test is a forking path.
- **Keep two arms** unless traffic grows: a third arm roughly doubles the time to a decision at IRP's volume.
- **Ending a test** is a code change: retire the losing arm(s) and set `status: "ended"`.

## 2. Instrument a Svelte component

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { useVariant, trackExposure, trackInteraction } from '../lib/evo/index.ts';

  const EVO_COMPONENT = 'MyButton';
  // Sticky, synchronous: drawn from the bundled allocation on first use and
  // logged once as an `assignment` event with its probability and the
  // page's pre-treatment context (device, language, landing source …).
  const variant = useVariant(EVO_COMPONENT);

  onMount(() => trackExposure(EVO_COMPONENT, variant));

  function handleClick() {
    trackInteraction(EVO_COMPONENT, variant, 'cta_click');
  }
</script>

{#if variant === 'v2-red'}
  <button class="bg-red" on:click={handleClick}>Act now</button>
{:else}
  <button class="bg-blue" on:click={handleClick}>Submit</button>
{/if}
```

Or wrap markup in `<EvoVariant component="MyButton" let:variant>` from the same index.

Call `useVariant` **before** the component renders (top of the script), so the visitor's first render already shows their arm.

### Identity

When the app learns the visitor's email (hero form, chatbot), call `identify(email)`. It links the anonymous `visitorId` to the email. The response carries the person's existing arms from other devices, and the client adopts them for components it has not assigned yet, so a returning person keeps their variant.

Leads are joined to visitors mainly through `consultations.attribution.visitorIds`, which `lib/attribution.ts` already sends on every capture and booking. Keep sending `attribution: getAttribution()` on any new lead path.

## 3. Chatbot persona

The client passes its assigned persona with each message (`evoPersonaVariant` in the `/api/chatbot/message` body), and `chatbotRouter.ts` injects the persona hint into the agent prompt. Add new personas in the registry, the client config and the hint switch in `chatbotRouter.ts`.

## 4. Email drip experiments

- An email experiment declares `appliesTo: ['nurture_feedback']` (the queue item types it changes). Only those types get a variant, its content and tracking. Every other type stores `null`.
- Assignment is **sticky per consultation**. On the first applicable enqueue, `helper/emailQueue.ts` draws once, stores `consultations/{id}.evoDrip = { subject, body, assignedAt, p }`, logs one `assignment` event per experiment (visitorId `email-<sha256>`), and reuses it for every later email.
- Variant content is applied in `jobs/processEmailQueue.ts` (`getEmailContent` for the body, the subject switch for the subject).
- Tracking: one pixel per email and **one** signed hop per link. URLs carry the queue item id (`q`) and email type (`t`), never the email address:

  ```
  /api/evo/track/pixel?q=<queueItemId>&t=<type>&s=<sig>
  /api/evo/track/link?q=<queueItemId>&t=<type>&url=<target>&s=<sig>
  ```

  The server resolves `q` to the queue item, so the variant comes from our own record. A pixel logs `email_open`; a click logs `email_click`. Opens are inflated by Apple Mail Privacy Protection, so they are never a primary metric.

Environment:

| Var | Effect |
|---|---|
| `EVO_TRACK_SECRET` | HMAC key for `s`. When set, events with a missing or invalid signature are not recorded. |
| `EVO_TRACK_ENFORCE=on` | Unsigned links redirect only to allow-listed hosts (else the site home). Leave off for ~30 days after deploy so links in already-sent emails keep working, and audit the Firestore-stored templates' link hosts first. |
| `EVO_TRACK_ALLOWED_HOSTS` | Extra comma-separated hosts for the allow-list (`API/evo/trackSign.ts`). |

Links in emails sent before this change (`e/c/v` URLs) still redirect, but no longer record events.

## 5. Pricing experiments

Not live. A price test would follow the chatbot pattern: the client sends its assigned variant with the booking request, and the server maps it to the price. It must declare a guardrail on won deals, because a cheaper price can raise conversions while lowering revenue.

## 6. Allocation (the "Traffic Cop")

`GET /api/evo/weights` returns each running experiment's **fixed** allocation plus a `_meta` key (`{ computedAt, mode }`) that readers skip. The browser does **not** wait for this endpoint: it draws from the allocation bundled in `config.ts`.

The legacy adaptive bandit (Thompson sampling on paid conversions, auto 90 % takeover) is kept only behind `EVO_BANDIT=on` and must not be re-enabled without the rework in spec §6.9. Re-enabling it while experiments run would also make their results unreadable.

## 7. Dev switcher and test traffic

`EvoDevSwitcher` (dev builds only) calls `forceVariant`. Forced components are recorded (`source: 'forced'`, `meta.evo.forced`) and excluded from analysis. Events from dev builds or localhost carry `meta.ctx.env = 'dev'` and are excluded too. Remove `E2E_Test_Comp_*` components with `scripts/cleanup-e2e-components.ts` after e2e runs.

## 8. Checks

```sh
cd irp-funnel-server
deno run -A scripts/test-evo-registry-parity.ts   # registry client/server parity
deno run -A scripts/test-evo-tracking.ts          # signing, redirects, ingest, allocation
deno run -A scripts/evo-data-probe.ts             # READ-ONLY: is data arriving? (production)
```
