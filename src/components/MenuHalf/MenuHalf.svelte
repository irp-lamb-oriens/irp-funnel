<script lang="ts">
  import { saveToStore } from "../store.ts";
  import X from "../X/X.svelte";

  export let isChecked = false; // Export isChecked as a prop, default to false
</script>

<div class="menu-half {isChecked ? 'open' : 'closed'}">
  <nav>
    <ul class="menu-half--list">
      <li class="menu-half--list-item home">
        <a
          class="menu-half--sub-anchor menu-half--anchor"
          onclick={() => {
            isChecked = false;
            saveToStore({ stepsIndex: 0, directionsThatShouldDisappear: [] });
          }}>Home</a
        >
      </li>
      <li class="menu-half--list-item home">
        <a
          class="menu-half--sub-anchor menu-half--anchor"
          onclick={() => {
            isChecked = false;
            saveToStore({ stepsIndex: 7 });
          }}>Config</a
        >
      </li>
      <li class="menu-half--list-item home">
        <a
          class="menu-half--sub-anchor menu-half--anchor"
          onclick={() => {
            isChecked = false;

            saveToStore({ stepsIndex: 8 });
          }}>News Sources</a
        >
      </li>
      <li class="menu-half--list-item home">
        <a
          class="menu-half--sub-anchor menu-half--anchor"
          onclick={() => {
            isChecked = false;

            saveToStore({ stepsIndex: 9 });
          }}>Users</a
        >
      </li>
      <li>
        <a
          class="menu-half--anchor menu-half--logout"
          onclick={() => {
            isChecked = false;
          }}>Log Out</a
        >
      </li>
    </ul>
  </nav>
</div>

<div class="menu-half-x">
  <X {isChecked} trigger={(ic) => (isChecked = !ic)} />
</div>

<style lang="scss">
  @use "./MenuHalf.scss";
</style>
