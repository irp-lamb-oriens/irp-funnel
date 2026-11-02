<!-- LetterByLetter.svelte -->
<script lang="ts">
  /**
   * The text to animate letter by letter.
   */
  export let text = '';
  /**
   * Initial offset (in seconds) to delay the entire animation.
   * Useful for sequencing multiple containers.
   */
  export let initialOffset = 0;
  // Helper to strip HTML tags from a string
  function stripHTML(html: string): string {
    return html.replace(/<[^>]*>/g, '');
  }
  // Split text into array of words, then each word into array of letters, after stripping HTML
  $: words = stripHTML(text).split(' ').map(word => word.split(''));
  // Helper to get the global letter index for animation delay
  function globalLetterIndex(wordIdx: number, letterIdx: number): number {
    let idx = 0;
    for (let w = 0; w < wordIdx; w++) idx += words[w].length;
    return idx + letterIdx;
  }
</script>

<!-- Screen readers get the whole phrase once (visually hidden); the animated
     letters are presentation only. aria-label on a role-less <span> is not
     announced reliably, which is why the text lives in real DOM here. -->
<span class="lbl-sr">{stripHTML(text)}</span>
<span aria-hidden="true" style="display: inline-block;">
  {#each words as letters, wordIdx}
    <span class="word" style="white-space: nowrap;">
      {#each letters as letter, letterIdx}
        <span
          class="letter"
          style="animation-delay: {initialOffset + Math.log(globalLetterIndex(wordIdx, letterIdx) + 2) * 0.22}s"
          aria-hidden="true"
          >{letter}</span
        >
      {/each}
    </span>{#if wordIdx < words.length - 1} <span class="space" aria-hidden="true">&nbsp;</span>{/if}
  {/each}
</span>

<style>
.lbl-sr {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
.word {
  display: inline-block;
  white-space: nowrap;
}
.letter {
  display: inline-block;
  opacity: 0;
  transform: translateX(0.5em);
  animation: appear 0.4s cubic-bezier(0.4,0,0.2,1) forwards;
  color: inherit;
  font: inherit;
}
.space {
  display: inline-block;
  width: 0.34em;
}
@keyframes appear {
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .letter {
    animation: none;
    opacity: 1;
    transform: none;
  }
}
</style>
