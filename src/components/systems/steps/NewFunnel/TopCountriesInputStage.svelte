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
      ## Top 3 Countries to Visit
    </MarkdownText>

    <div class="stepper" aria-live="polite" aria-atomic="true">
      {#if !$topCountries[0] || !$topCountries[0].trim()}Step 1 of 3{/if}
      {#if $topCountries[0]?.trim() && (!$topCountries[1] || !$topCountries[1].trim())}Step 2 of 3{/if}
      {#if $topCountries[0]?.trim() && $topCountries[1]?.trim() && (!$topCountries[2] || !$topCountries[2].trim())}Step 3 of 3{/if}
      {#if isValid}All set{/if}
    </div>

    <div class="countries" role="group" aria-label="Top countries">
      <!-- 1. Always show the first -->
      <Country
        label={$topCountries[0] ?? "Country 1"}
        onSelect={(v: string | null) => handleInput(0, v ?? "")}
      />

      <!-- 2. Show the second only after the first is chosen -->
      {#if $topCountries[0]?.trim()}
        <Country
          label={$topCountries[1] ?? "Country 2"}
          onSelect={(v: string | null) => handleInput(1, v ?? "")}
        />
      {/if}

      <!-- 3. Show the third only after the first two are chosen -->
      {#if $topCountries[0]?.trim() && $topCountries[1]?.trim()}
        <Country
          label={$topCountries[2] ?? "Country 3"}
          onSelect={(v: string | null) => handleInput(2, v ?? "")}
        />
      {/if}
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
    color: #666;
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
