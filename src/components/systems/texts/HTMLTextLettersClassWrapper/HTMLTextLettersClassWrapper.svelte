<script lang="ts">
    import { onMount } from "svelte";
    import { get, writable } from "svelte/store";

    export let HTMLText: string;
    const innerText = writable<string>();
    export const transitionSpeed: number = .5;

    onMount(() => {
        const GhostHTML = document.createElement("DIV");

        setTimeout(() => {
                innerText.set(`<span>${HTMLText}</span>`);

                GhostHTML.innerHTML = $innerText;

                const allElements = GhostHTML.querySelectorAll("*");
                // Filter elements that do not have child elements
                const lastLevelChildren: Element[] = Array.from(allElements).filter(el => el.children.length === 0);

                ;[...lastLevelChildren].forEach((child, i) => {
                    const childrenWrappedOuterHTMLs = (child as HTMLElement).innerText.split(" ").map((letter, j) => {
                        const letterWrapper = document.createElement("span");

                        letterWrapper.className = "wrapper-letter";
                        letterWrapper.style.transitionDelay = `${Math.log((i + 1) * (j + 1)) * transitionSpeed}s`;
                        // letterWrapper.style.transitionDelay = `${(i + 1) * (j + 1) / transitionSpeed}s`;
                        // letterWrapper.style.transitionDelay = `${transitionSpeed}s`;
                        letterWrapper.innerText = letter;

                        return letterWrapper.outerHTML;
                    }).join(" ");

                    child.innerHTML = "";
                    child.innerHTML = childrenWrappedOuterHTMLs;
                });

                innerText.set(GhostHTML.innerHTML);
                // console.log("$innerText", $innerText);
        }, 1000);
    });
</script>

{@html $innerText || ""}

<style lang="scss">
  @use "HTMLTextLettersClassWrapper.scss";
</style>
