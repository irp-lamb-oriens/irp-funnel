<script lang="ts">
  import { onMount } from "svelte";
  import store, {
    getFromStore,
    populateToStore,
    saveAllKeysToSaveInLocalStorage,
    saveToStore,
    setStorageFromKeysToSave,
  } from "../../../store.ts";
  import Steps from "../Steps.svelte";

  export let components;

  const goNext = (currentIndex: number) => () => {
    if (
      !$store.hasInteracted &&
      $store.stepsIndex < currentIndex &&
      $store.stepsIndex + 1 === currentIndex
    ) {
      saveToStore({
        stepsIndex: Math.min($store.stepsIndex + 1, components.length),
      });
    }
  };

  function setInitialNonInteractiveSlidesAutomaticSlideTime() {
    const timings: number[] = [];
    let timing = 0;

    timings.forEach((waitDuration, index) => {
      if (index < $store.stepsIndex) return;

      timing += waitDuration;

      const wait = timing;
      console.log("index", index, $store.stepsIndex, timing, waitDuration);

      setTimeout(goNext(index + 1), wait);
    });
  }

  onMount(() => {
    setStorageFromKeysToSave();
    setInitialNonInteractiveSlidesAutomaticSlideTime();
    saveAllKeysToSaveInLocalStorage();
  });
</script>

<Steps {components} />
