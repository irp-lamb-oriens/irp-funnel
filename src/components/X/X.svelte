<script lang="ts">
  export let trigger: (isChecked: boolean) => void;
  export let isChecked: boolean = false;
  let inputElement: Element;
</script>

<input
  on:click={() => {
    const triggerValue = trigger(isChecked);

    if (triggerValue === undefined) {
      isChecked = !isChecked;

      return;
    }

    isChecked = !!triggerValue;
  }}
  bind:this={inputElement}
  class="x {isChecked}"
  checked={isChecked}
  type="checkbox"
/>

<style lang="scss">
  @use './X.scss';
</style>
