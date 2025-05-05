<script lang="ts">
  import { onMount, type SvelteComponent } from "svelte";
  import MultiSlotComponent from "../wrappers/MultiSlotComponent/MultiSlotComponent.svelte";
  import TransitionSteps from "./TransitionSteps/TransitionSteps.svelte";
  import store from "../../store.ts";
  import type { ComponentSteps, Store } from "../../types.ts";
  import { writable } from "svelte/store";

  export let components: ComponentSteps;
  let steps = writable<[(store: Store) => boolean, SvelteComponent][]>([]);

  onMount(() => {
    steps.set(
      components.map(([_, component], index) => {
        console.log("can u reveal", index, $store.stepsIndex === index);

        return [
          (store: Store) => {
            const canReveal = store.stepsIndex === index;
            const getAreAllPreviousValid = () => components
              .slice(0, index + 1)
              .every(([callback]) => callback(store));

            return canReveal && getAreAllPreviousValid();
          },
          component,
        ];
      })
    );
  });
</script>

<MultiSlotComponent steps={$steps} sharedStore={store} />
<TransitionSteps {components} />
