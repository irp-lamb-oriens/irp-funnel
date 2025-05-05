<script lang="ts">
  import { onDestroy } from "svelte";
  import { writable, type Writable } from "svelte/store";

  type Callback = (state: any) => boolean;

  export let steps: [Callback, any][];
  export let sharedStore: Writable<any>;

  let storeValue: any = writable();

  const unsubscribe = sharedStore.subscribe((value) => {
    storeValue.set(value);
  });

  onDestroy(() => {
    unsubscribe();
  });
</script>

<div class="multi-slot-component">
  {#each steps as [callback, Component]}
    <div
      class="multi-slot-component--component-slot"
      class:active={!!callback($storeValue)}
      class:inactive={!callback($storeValue)}
    >
      <div>
        <!-- Always render the component, but toggle classes -->
        <svelte:component
          this={Component}
          canReveal={!!callback($storeValue)}
        />
      </div>
    </div>
  {/each}
</div>

<style lang="scss">
  @use "./MultiSlotComponent.scss";
</style>
