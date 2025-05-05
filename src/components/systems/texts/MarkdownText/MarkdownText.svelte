<script lang="ts">
  import { onMount } from "svelte";
  import Text from "../Text/Text.svelte";
  import type { Block, TextNode } from "../../../types.ts";

  let blocks: Block[] = [];
  let slotContainer: HTMLDivElement;
  export let canReveal = false;

  // parseInline: same as before
  function parseInline(
    text: string,
    context: "title" | "subtitle" | "paragraph" = "paragraph"
  ) {
    const segments = [];
    const regex = /(\*\*|==|--|\*)(.+?)\1/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Text before the match
      if (match.index > lastIndex) {
        segments.push({
          type: context,
          text: text.slice(lastIndex, match.index),
        });
      }
      const marker = match[1];
      const content = match[2];
      let segType: string = "";

      if (marker === "**" || marker === "==") {
        segType =
          context === "title"
            ? "title-highlight"
            : context === "subtitle"
              ? "subtitle-highlight"
              : "highlight";
      } else if (marker === "*") {
        segType =
          context === "title"
            ? "title-sub-italic"
            : context === "subtitle"
              ? "subtitle-sub-italic"
              : "sub-italic";
      } else if (marker === "--") {
        segType =
          context === "title"
            ? "title-sub-highlight-italic"
            : context === "subtitle"
              ? "subtitle-sub-highlight-italic"
              : "sub-highlight-italic";
      }
      segments.push({ type: segType, text: content });
      lastIndex = regex.lastIndex;
    }
    // Any trailing text
    if (lastIndex < text.length) {
      segments.push({
        type: context,
        text: text.slice(lastIndex),
      });
    }
    return segments;
  }

  // parseMarkdown: store segments for titles/subtitles
  function parseMarkdown(md: string) {
    const rawBlocks = md.split(/\n\s*\n/);

    (blocks as any) = rawBlocks.map((block) => {
      const trimmed = block.trim();

      // Level 2 header => title
      if (trimmed.startsWith("## ")) {
        const content = trimmed.slice(3).trim();
        return {
          header: true,
          type: "title",
          segments: parseInline(content, "title"),
        };
      }
      // Level 3 header => subtitle
      if (trimmed.startsWith("### ")) {
        const content = trimmed.slice(4).trim();
        return {
          header: true,
          type: "subtitle",
          segments: parseInline(content, "subtitle"),
        };
      }
      // Otherwise => paragraph
      return {
        header: false,
        type: "paragraph",
        segments: parseInline(trimmed, "paragraph"),
      };
    });
  }

  function processSlot() {
    if (slotContainer) {
      const slotText = slotContainer?.textContent?.trim() || "";
      parseMarkdown(slotText);
    }
  }

  onMount(() => {
    processSlot();
  });

  $: canReveal;
</script>

<!-- Hidden container for the slotted text -->
<div bind:this={slotContainer} style="display: none;">
  <slot />
</div>

<!-- Render the parsed blocks -->
<div class="markdown-text">
  {#each blocks as block}
    {#if block.header}
      <!--
        Wrap the entire title/subtitle line in a block container.
        But render each segment as inline.
      -->
      {#if block.type === "title"}
        <div class="title-block">
          {#each block.segments as TextNode[] as seg}
            <Text text={seg.text} type={seg.type} {canReveal} />
          {/each}
        </div>
      {:else if block.type === "subtitle"}
        <div class="subtitle-block">
          {#each block.segments as TextNode[] as seg}
            <Text text={seg.text} type={seg.type} {canReveal} />
          {/each}
        </div>
      {/if}
    {:else}
      <!-- Paragraph line, also inline segments -->
      <div class="paragraph-block">
        {#each block.segments as TextNode[] as seg}
          <Text text={seg.text} type={seg.type} {canReveal} />
        {/each}
      </div>
    {/if}
  {/each}
</div>

<style lang="scss">
  .markdown-text {
    user-select: none;
  }

  .title-block {
    display: block;
    margin: 1em 0;
    /* style as you like */
  }

  .subtitle-block {
    display: block;
    margin: 0.5em 0;
    /* style as you like */
  }

  .paragraph-block {
    display: block;
    margin: 0.75em 0;
    /* style as you like */
  }
</style>
