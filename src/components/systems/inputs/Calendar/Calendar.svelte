<!--
  Calendar.svelte — Hero-form availability picker.
  ──────────────────────────────────────────────────────────────────────────────
  This is the thin bridge that wires the shared AvailabilityPicker component
  into the hero booking form's formStore. All slot-fetching and calendar
  rendering logic now lives in AvailabilityPicker.svelte; this file only
  provides the formStore bridge so the hero form continues to work unchanged.

  Backward-compatible: nothing in the hero form or its submit handlers needs
  to change. The visible output is identical.
-->
<script lang="ts">
  import { get } from 'svelte/store';
  import { formState, updateField } from './formStore.js';
  import store from '../../../store.ts';
  import AvailabilityPicker from '../AvailabilityPicker/AvailabilityPicker.svelte';

  /** Bridge: AvailabilityPicker fires the selected ISO → we push it into formStore. */
  function handleSelect(iso: string) {
    updateField(iso ? [iso] : [], 'scheduling');
  }

  $: apiBase = get(store).apiURL?.() ?? '';
  $: preselected = ($formState as any)?.scheduling?.[0] ?? '';
</script>

<AvailabilityPicker
  {apiBase}
  {preselected}
  theme="dark"
  onSelect={handleSelect}
/>
