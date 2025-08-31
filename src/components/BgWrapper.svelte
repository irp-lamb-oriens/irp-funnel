<script lang="ts">
  // No props needed, just a slot wrapper
</script>

<style>
:global .bg-wrapper {
  background: var(--color-background-inversion);
  min-height: 100vh;
  width: 100%;
  /* Optional: ensure it covers the viewport */
  display: flex;
  flex-direction: column;
}
</style>

<div class="bg-wrapper">
  <slot></slot>
</div>
