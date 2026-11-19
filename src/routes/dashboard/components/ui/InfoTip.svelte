<script lang="ts">
  /**
   * InfoTip — a small ⓘ that explains a metric, setting or group in plain words.
   *
   *   <InfoTip text="Revenue minus what we pay providers." label="About margin" />
   *
   * Opens on hover, on keyboard focus and on tap; Escape closes it. The text is
   * linked with aria-describedby, so a screen reader reads it with the button.
   */
  export let text: string;
  export let label = 'More information';
  export let placement: 'top' | 'bottom' = 'top';

  const id = `irp-tip-${Math.random().toString(36).slice(2, 9)}`;
  let open = false;

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      open = false;
      e.stopPropagation();
    }
  }
</script>

<span class="irp-infotip" class:is-open={open} data-placement={placement}>
  <button
    type="button"
    class="irp-infotip__btn"
    aria-label={label}
    aria-describedby={id}
    aria-expanded={open}
    on:click|stopPropagation={() => (open = !open)}
    on:keydown={onKey}
    on:blur={() => (open = false)}
  >
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5" />
      <path d="M8 7.2v4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" />
      <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
    </svg>
  </button>
  <span {id} role="tooltip" class="irp-infotip__bubble">{text}</span>
</span>
