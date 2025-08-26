<script lang="ts">
  import { topCountries } from "./store.ts";
  import Page from "../../wrappers/Page/Page.svelte";
  import SubmitButton from "../../buttons/SubmitButton/SubmitButton.svelte";
  import MarkdownText from "../../texts/MarkdownText/MarkdownText.svelte";
  import { incrementStepsIndex } from "../../../store.ts";
  import Country from "../../inputs/Country/Country.svelte";

  // reactive validity: all chosen
  $: isValid = $topCountries.every(
    (c) => typeof c === "string" && c.trim().length > 0
  );

  function handleInput(index: number, newValue: string) {
    topCountries.update((countries) => {
      const next = Array.isArray(countries) ? [...countries] : [];
      // ensure the array has enough slots
      for (let i = 0; i <= index; i++) if (typeof next[i] !== "string") next[i] = "";
      next[index] = newValue ?? "";
      return next;
    });
  }

  export let canReveal = false;

  function handleNext() {
    if (isValid) incrementStepsIndex();
  }
</script>

<Page>
  <div class="stage-content">
    <MarkdownText {canReveal}>
      ## Top country you are considering to move abroad
    </MarkdownText>

    <div class="stepper" aria-live="polite" aria-atomic="true">
      {#if isValid}All set{/if}
    </div>

    <div class="countries" role="group" aria-label="Top countries">
      <!-- 1. Always show the first -->
      <Country
        label={$topCountries[0] ?? "Country"}
        onSelect={(v: string | null) => handleInput(0, v ?? "")}
      />
    </div>

    <SubmitButton label="Next" callback={handleNext} disabled={!isValid} />
  </div>
</Page>

<style>
  .stage-content {
    display: grid;
    padding: 0 20px;
    margin: auto;
  }

  .stepper {
    font-size: 0.95rem;
    line-height: 1.2;
    margin-top: 0.25rem;
    color: var(--color-background);
  }

  .countries {
    display: grid;
    /* Auto-fit into 1–3 columns; as steps unlock, layout adapts naturally */
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    padding: 2rem 0;
    gap: 1rem;
  }

  /* Optional polish if <Country> renders native inputs */
  input, select {
    width: 100%;
    padding: 8px;
    margin-top: 4px;
    margin-bottom: 12px;
    border: 1px solid #ccc;
    border-radius: 4px;
  }
</style>
