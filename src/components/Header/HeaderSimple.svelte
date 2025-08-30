<script lang="ts">
    import { writable } from "svelte/store";
  import MenuHalf from "../MenuHalf/MenuHalf.svelte";
  import store, { saveToStore, isScrollingDown } from "../store.ts"; // Import isScrollingDown
  import SVG from "../SVG/SVG.svelte";
  import ThemeChanger from "../ThemeChanger/ThemeChanger.svelte";

  let menuOpen = false;
  let headerVisible = writable(true); // Regular boolean variable

  // Logic: Show only if authenticated AND not scrolling down (using store value)
  $: headerVisible.set($store.isAuthCodeValid && !$isScrollingDown);

</script>

<header class="nav-header">
  <nav class="nav" style:top={$headerVisible ? '0' : '-87px'}>
    <div class="menu {menuOpen ? 'open' : ''}">
      <section class="menu-section left">
        <a
          class="menu-item hide-on-mobile"
          onclick={() => {
            saveToStore({ stepsIndex: 7 });
          }}>Config</a
        >
        <a
          class="menu-item hide-on-mobile"
          onclick={() => {
            saveToStore({ stepsIndex: 8 });
          }}>News Sources</a
        >
        <a
          class="menu-item hide-on-mobile"
          onclick={() => {
            saveToStore({ stepsIndex: 9 });
          }}>Users</a
        >
        <section class="menu-x hide-on-desktop interactive">
          <ThemeChanger visible={true} />
        </section>
      </section>
      <section class="menu-section center">
        <a
          onclick={() => {
            saveToStore({ stepsIndex: 0, directionsThatShouldDisappear: [] });
          }}
        >
          <SVG src="./icons/AIBA.svg" />
        </a>
      </section>
      <section class="menu-section right">
        <div class="menu-x hide-on-desktop interactive">
          <MenuHalf bind:isChecked={menuOpen} />
        </div>
        <section class="menu-x hide-on-mobile interactive">
          <a
            class="menu-half--anchor menu-half--logout"
            onclick={() => {  
            }}>Log Out</a
          >
        </section>

        <section class="menu-x hide-on-mobile interactive">
          <ThemeChanger visible={true} />
        </section>
      </section>
    </div>
  </nav>
</header>

<style lang="scss">
  @use "Header.scss";
</style>
