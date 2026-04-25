# Evo System Architecture & Developer Guide

Evo is our full-stack, evolutionary UI split-testing and sales attribution engine. It automatically assigns users to variants (UI copy, chatbot personas, email templates, or pricing), tracks their exposures and interactions, and mathematically ties those frontend experiences directly to backend CRM revenue. 

When a variant performs statistically significantly better than the baseline, the "Traffic Cop" automatically assigns it 90% of new traffic.

## Core Concepts

- **Component:** The logical feature being tested (e.g., `HeroForm`, `ChatbotPersona`, `EmailDripSubject`).
- **Variant:** The specific flavor of the component (e.g., `v1-baseline`, `v2-urgent-copy`).
- **Exposure:** The moment a user *sees* or *loads* a variant (e.g., component mounts, email is opened).
- **Interaction:** The moment a user *engages* with a variant (e.g., clicks the CTA, sends a chat message, clicks an email link).
- **Attribution:** The system retroactively links an anonymous `visitorId` to a known `email` when the user submits a form. If that user ever schedules and pays for a consultation, Evo credits every variant they were exposed to *prior* to paying with that revenue.

---

## 1. How to Register a New Component & Variant

Variants must be registered in **both** the client and the server so the dashboard can render labels and the Traffic Cop knows what's valid.

### Step A: Client-Side Registry
Open `irp-funnel/src/lib/evo/config.ts`. Add your component to the `EVO_COMPONENTS` record:

```typescript
  MyNewButton: {
    key: 'MyNewButton',
    variants: [
      {
        key: 'v1-baseline',
        label: 'Blue Button',
        hypothesis: 'Current production blue button.',
      },
      {
        key: 'v2-red',
        label: 'Red Button',
        hypothesis: 'Red implies urgency, hoping for higher CTR.',
      },
    ],
  },
```

### Step B: Server-Side Registry
Open `irp-funnel-server/API/evo/registry.ts`. Add the exact same configuration to `EVO_REGISTRY`.
*(Note: When the server restarts, `syncRegistry()` will automatically push these to Firestore so the Dashboard can see them).*

---

## 2. How to Instrument a Component in Svelte

Once registered, you use the Evo client library to assign a variant to the user and track their behavior. Evo handles fetching the Multi-Armed Bandit (MAB) weights from the server and ensuring sticky assignments.

Open your `.svelte` component:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { useVariant, trackExposure, trackInteraction } from '../lib/evo/index.ts';

  const EVO_COMPONENT = 'MyNewButton';
  
  // 1. Get the variant assignment. 
  // If this is the user's first time, Evo asks the Traffic Cop for weights.
  // If they've been here before, Evo remembers their sticky assignment.
  const myVariant = useVariant(EVO_COMPONENT);

  onMount(() => {
    // 2. Track Exposure. Fire this ONLY when the component is actually visible on screen.
    trackExposure(EVO_COMPONENT, myVariant, { optionalMeta: 'info' });
  });

  function handleClick() {
    // 3. Track Interaction. 
    trackInteraction(EVO_COMPONENT, myVariant, 'btn_click', { timeSpent: 42 });
    
    // ... proceed with business logic
  }
</script>

<!-- 4. Render conditionally based on the variant -->
{#if myVariant === 'v1-baseline'}
  <button class="bg-blue" on:click={handleClick}>Submit</button>
{:else if myVariant === 'v2-red'}
  <button class="bg-red" on:click={handleClick}>Act Now</button>
{/if}
```

### The Identity Handoff (Crucial)
For sales attribution to work, Evo must learn who the anonymous visitor is. Whenever your app captures an email address (e.g. in the Hero Form or Chatbot), you **must** call `identify()`:

```typescript
import { identify } from '../lib/evo/index.ts';

// When user submits their email:
identify("user@example.com");
```

---

## 3. How to A/B Test Chatbot Personas

Because the Chatbot is powered by the server-side `ThinkingAgent`, Evo must pass the variant assignment from the client *into* the backend API call.

1. **Client Side (`Chatbot.svelte`):**
   ```typescript
   const personaVariant = useVariant('ChatbotPersona');
   trackExposure('ChatbotPersona', personaVariant);
   
   // Pass it in the payload to the server
   await fetch('/api/chatbot/message', {
     body: JSON.stringify({ message, evoPersonaVariant: personaVariant })
   });
   ```

2. **Server Side (`chatbotRouter.ts`):**
   ```typescript
   const evoPersonaVariant = req.body.evoPersonaVariant;
   let evoPersonaHint = "";
   if (evoPersonaVariant === "v2-closer") {
     evoPersonaHint = "Aggressive Closer Persona: Push hard for the calendar booking.";
   }
   
   // Inject into Thinking Agent
   await runThinkingAgent(..., evoPersonaHint);
   ```

---

## 4. How to A/B Test Email Drip Campaigns

Emails don't run Svelte, so Evo handles variant assignment dynamically as the emails are queued.

1. The `emailQueue.ts` worker asks the Traffic Cop for the latest MAB weights.
2. It assigns an `evoSubjectVariant` and `evoBodyVariant` to the pending email document.
3. When `processEmailQueue.ts` runs, it evaluates the variants and injects tracking pixels.

To track opens and clicks inside emails, Evo exposes two REST endpoints. `processEmailQueue` injects these automatically:

- **Open Tracking (Pixel):** 
  `<img src="https://api.com/api/evo/track/pixel?e=user@mail.com&c=EmailDripSubject&v=v2-urgent" width="1" height="1" />`
- **Click Tracking (Link wrapper):** 
  `<a href="https://api.com/api/evo/track/link?url=https://target.com&e=user@mail.com&c=EmailDripBody&v=v2-story">Click here</a>`

---

## 5. How to A/B Test Pricing

Dynamic pricing tests both conversion rate AND total revenue elasticity. 

1. Create a `ConsultationPrice` component in the registry (`v1-baseline-250`, `v2-discount-199`).
2. Client-side, call `useVariant('ConsultationPrice')`.
3. Pass that variant to the CRM API endpoint (`/api/send-hero-consultation`).
4. The server's `consultationRouter.ts` translates the variant into a real USD integer and saves it to the CRM payload as `quotedPriceUsd`.
5. The Evo Dashboard automatically sorts by the `revenueUsd` column, showing you if the $199 discount variant makes up for the lower margin by converting 3x as many leads.

---

## 6. How the Traffic Cop (MAB) Works

You do not need to manually turn off losing variants. The system is self-healing.

1. The client requests weights from `/api/evo/weights`.
2. The server (`trafficCop.ts`) looks at the last 90 days of attribution data.
3. It models the conversion rate of every variant using **Thompson Sampling** (a Beta distribution of Visitors vs Paid Conversions).
4. If it detects a **Confirmed Winner** (p-value < .01 and n >= 300), it hard-codes that variant to receive **90%** of all traffic. 
5. The remaining variants split the remaining 10% of traffic to ensure continuous exploration (in case seasonality or market conditions change the winning dynamic).
6. **Cohort Degradation:** If a user pays, but later asks for a refund (entering the `refunded` or `cancelled` CRM stage), their revenue is dynamically deducted from that variant's scorecard, ensuring we don't optimize for variants that trick users into buying but result in high churn.
