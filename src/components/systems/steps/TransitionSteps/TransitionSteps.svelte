<script lang="ts">
  import store, { saveToStore } from "../../../store.ts";
  import TransitionButton from "../../buttons/TransitionButton/TransitionButton.svelte";

  export let components: any[];

  const canShow = (
    direction: -1 | 0 | 1,
    isComingFromValidStep?: (v: any) => boolean
  ) =>
    components[$store.stepsIndex + direction]?.[0]?.({
      ...$store,
      isComingFromValidStep,
    });
</script>

{#each [-1, 1] as direction}
  <TransitionButton
    active={!$store.directionsThatShouldDisappear?.includes(direction) && canShow(direction as -1 | 1)}
    direction={direction as -1 | 1}
    callback={() => {
      canShow(direction as -1 | 1, canShow(direction as -1 | 1));

      saveToStore({
        hasInteracted: true,
        stepsIndex: $store.stepsIndex + direction,
      });
    }}
  />
{/each}
