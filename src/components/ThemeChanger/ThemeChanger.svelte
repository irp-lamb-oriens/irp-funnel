<script lang="ts">
  import { onMount } from "svelte";
  import { complementaryColor, foregroundColor, isDarkTheme, themeIndex } from "./theme-store.ts";

  // Check localStorage for theme preference
  onMount(() => {
    const storedTheme = localStorage.getItem("theme");
    if (storedTheme) {
      isDarkTheme.set(storedTheme === "dark");
    }
    updateTheme();

    foregroundColor.subscribe(() => {
      updateTheme();
    });

    complementaryColor.subscribe(() => {
      updateTheme();
    });
  });

  const toggleTheme = () => {
    isDarkTheme.set(!$isDarkTheme);
    localStorage.setItem("theme", $isDarkTheme ? "dark" : "light");
    updateTheme();
  };

  function setThemeCSSVar(varName: string, values: string[]) {
    document.documentElement.style.setProperty(
      `--${varName}`,
      $isDarkTheme ? values[0] : values[1]
    );
    document.documentElement.style.setProperty(
      `--${varName}-inversion`,
      $isDarkTheme ? values[1] : values[0]
    );
  }

  const updateTheme = () => {
    themeIndex.set(+$isDarkTheme);
    setThemeCSSVar("color-background", ["#fff", "#181818"]);
    setThemeCSSVar("color-background-opaque", ["#fff8", "#18181888"]);
    setThemeCSSVar("color-background-very-opaque", ["#ffffff0f", "#1818180f"]);
    setThemeCSSVar("color-foreground-opaque", [$complementaryColor + "88", $foregroundColor + "88"]);
    setThemeCSSVar("color-foreground-very-opaque", [$foregroundColor + "0f", $foregroundColor + "0f"]);
    setThemeCSSVar("color-foreground", [$complementaryColor, $foregroundColor]);
    setThemeCSSVar("color-foreground-inversion", [$complementaryColor, "#fff"]);
    setThemeCSSVar("color-outline", ["#181818", "#fff"]);
    setThemeCSSVar("color-untamed", ["#000", "#f5f5f5"]);
    setThemeCSSVar("color-tamed", ["#262626", "#d2d2d2"]);
    setThemeCSSVar("bg-filter", [
      "contrast(85%) brightness(25%)",
      "contrast(15%) brightness(200%)",
    ]);
    setThemeCSSVar("contrast", ["contrast(.9)", "contrast(.9)"]);
    setThemeCSSVar("contrast-inversion", ["contrast(1.2)", "contrast(.9)"]);
    setThemeCSSVar("color-variable", [
      "var(--color-background-inversion)",
      "var(--color-background)",
    ]);
    setThemeCSSVar("theme", ["dark", "light"]);
    setThemeCSSVar("color-x-gradient", [
      "linear-gradient(90deg, rgba(24, 23, 23, 1) 0%, rgba(20, 20, 20, 1) 22%, rgba(0, 0, 0, 1) 100%)",
      "linear-gradient(90deg, rgba(248, 248, 248, 1) 0%, rgba(245, 244, 244, 1) 11%, rgba(227, 227, 227, 1) 100%)",
    ]);
    setThemeCSSVar("color-x-gradient-opaque", [
      "linear-gradient(180deg, rgba(24, 23, 23, 0.1) 0%, rgba(20, 20, 20, .5) 22%, rgba(0, 0, 0, .7) 100%)",
      "linear-gradient(180deg, rgba(248, 248, 248, 0.1) 0%, rgba(245, 244, 244, .5) 11%, rgba(227, 227, 227, .7) 100%)",
    ]);
  };

  export let visible: boolean;

  let canSet = false;

  onMount(() => {
    canSet = true;
  });

  $: isDarkTheme.subscribe(() => {
    if (canSet) updateTheme();
  });
</script>

{#if visible}
  <div class="theme-changer">
    <button
      aria-label="Change theme from dark to light"
      class="theme-toggle {$isDarkTheme ? 'dark' : 'light'}"
      on:click={toggleTheme}
    >
      <div class="icon"></div>
    </button>
  </div>
{/if}

<style lang="scss">
  @use "./ThemeChanger.scss";
</style>
