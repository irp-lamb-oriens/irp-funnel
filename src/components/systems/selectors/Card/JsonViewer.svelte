<script lang="ts">
  import Date from "../../buttons/Date/Date.svelte";
  import camelCaseToCapitalized from "../../helpers/camelCaseToCapitalized.ts";
  import Number from "../../inputs/Number/Number.svelte";
  import PlainText from "../../inputs/PlainText/PlainText.svelte";
  import MarkdownText from "../../texts/MarkdownText/MarkdownText.svelte";
  import Switch from "../Switch/Switch.svelte";

  export let data: any;

  import JsonViewer from "./JsonViewer.svelte";

  export let canReveal = false;

  function isDate(val: any): boolean {
    return val instanceof Date;
  }
</script>

<div class="json-viewer">
  {#if typeof data === "object" && data !== null}
    {#if Array.isArray(data)}
      <ul class="json-array">
        {#each data as item, index}
          <li>
            <span class="json-index">
              <MarkdownText {canReveal}>
                **{index}**
              </MarkdownText>
            </span>
            <!-- Recursively render each array item using svelte:component -->
            <svelte:component this={JsonViewer} data={item} />
          </li>
        {/each}
      </ul>
    {:else}
      <div class="json-object">
        {#each Object.entries(data) as [key, value]}
          <div class="json-property">
            <span class="json-key">
              <MarkdownText {canReveal}>
                {camelCaseToCapitalized(key)}
              </MarkdownText>
            </span>
            <!-- Recursively render each property value using svelte:component -->
            <svelte:component this={JsonViewer} data={value} />
          </div>
        {/each}
      </div>
    {/if}
  {:else if typeof data === "number"}
    <span class="json-number">
      <Number value={String(data)} />
    </span>
  {:else if typeof data === "string"}
    <span class="json-string">
      <PlainText value={data} />
    </span>
  {:else if typeof data === "boolean"}
    <span class="json-boolean">
      <Switch toggled={data} />
    </span>
  {:else if isDate(data)}
    <Date value={data.toLocaleString()} />
  {:else if data === null}
    <span class="json-null">null</span>
  {:else}
    <span class="json-unknown">{String(data)}</span>
  {/if}
</div>

<style lang="scss">
  .json-viewer {
    font-family: monospace;
    color: var(--color-foreground);
    margin-bottom: 2rem;
  }
  .json-object {
    margin-left: 0rem;
    border-left: 2px solid var(--color-background);
    padding-left: 1rem;
  }
  .json-array {
    margin-left: 1rem;
    list-style: none;
    padding-left: 0;
  }
  .json-property {
    margin-bottom: 0.25rem;
    display: grid;
    grid-gap: 1rem;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  }
  .json-key {
    font-weight: bold;
    color: var(--color-foreground);
  }
  .json-number {
    color: #4caf50;
  }
  .json-string {
    color: #f44336;
  }
  .json-boolean {
    color: #2196f3;
  }
  .json-date {
    color: #ff9800;
  }
  .json-null {
    color: red;
    font-style: italic;
  }
  .json-unknown {
    color: #e91e63;
  }
</style>
