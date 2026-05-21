<!--
  EmailTypeSelect.svelte
  ───────────────────────────────────────────────────────────────────────────
  A generic <select> component that renders its options from the server-driven
  `emailTypes` store — never from a hardcoded list.

  The store is pre-seeded with the static EMAIL_TYPES fallback so the dropdown
  works immediately on first render; it refreshes automatically whenever the
  store is updated (i.e. after `fetchEmailTypes()` resolves on init).

  Supports two display modes:
    grouped=false (default)  — flat <option> list
    grouped=true             — <optgroup> per category (Sales / Ops / Follow-up)

  Props
  ─────
    value       (bind:value) — the currently selected email type key, or ''
    disabled    — disable the entire select while an action is in-flight
    grouped     — whether to render category <optgroup> separators
    placeholder — text of the blank first option (default: "Choose email type…")
-->
<script lang="ts">
  import { emailTypes } from '../store.ts';

  export let value: string = '';
  export let disabled: boolean = false;
  export let grouped: boolean = false;
  export let placeholder: string = 'Choose email type…';

  const CATEGORY_LABELS: Record<string, string> = {
    sales:    '✉️ Sales',
    ops:      '📦 Ops',
    followup: '👋 Follow-up',
  };
</script>

{#if grouped}
  <select bind:value {disabled} class="email-type-select">
    <option value="">{placeholder}</option>
    {#each ['sales', 'ops', 'followup'] as cat}
      {@const typed = $emailTypes.filter(t => t.category === cat)}
      {#if typed.length > 0}
        <optgroup label={CATEGORY_LABELS[cat] ?? cat}>
          {#each typed as et}
            <option value={et.value}>{et.label}</option>
          {/each}
        </optgroup>
      {/if}
    {/each}
    <!-- Uncategorised (older static entries without a category field) -->
    {#if $emailTypes.filter(t => !t.category).length > 0}
      <optgroup label="Other">
        {#each $emailTypes.filter(t => !t.category) as et}
          <option value={et.value}>{et.label}</option>
        {/each}
      </optgroup>
    {/if}
  </select>
{:else}
  <select bind:value {disabled} class="email-type-select">
    <option value="">{placeholder}</option>
    {#each $emailTypes as et}
      <option value={et.value}>{et.label}</option>
    {/each}
  </select>
{/if}

<style lang="scss">
  .email-type-select {
    /* Inherits styling from the parent context (detail-emails__select etc.)
       — no opinion on visual style here. Pass a class prop if needed. */
    width: 100%;
    font-family: inherit;
  }
</style>
