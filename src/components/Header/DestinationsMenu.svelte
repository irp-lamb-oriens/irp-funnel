<script context="module" lang="ts">
  export interface Destination {
    label: string;
    href: string;
    icon: string;
  }
</script>
<script lang="ts">
    import { onMount } from "svelte";
    import { writable } from "svelte/store";

  export let destinations: Destination[] = [];

</script>

<nav class="destinations-menu-col" aria-label="Destinations navigation">
  <ul class="destinations-menu" role="menubar">
    {#each destinations as dest (dest.href)}
      <li class="country-images-list" role="none">
        <a
          href={dest.href}
          role="menuitem"
          tabindex="0"
        >
          <img class="country-image" src={dest.icon} alt={dest.label} />
          <span class="country-label">{dest.label}</span>
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style lang="scss">
.destinations-menu-col {
  flex: 1 1 auto;
  display: flex;
  justify-content: flex-end;

  @media (max-width: 1024px) {
    justify-content: center;
  }
}
.destinations-menu {
  display: flex;
  list-style: none;
  margin: 0;
  padding: 0;
  align-items: center;

  @media (max-width: 1024px) {
    justify-content: center;
    gap: 0;
  }
}
.destinations-menu li {
  display: flex;
  align-items: center;
}
.destinations-menu a {
  color: #222;
  text-decoration: none;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.3rem 0.8rem;
  border-radius: 4px;
  transition: background 0.15s;
}
.destinations-menu a:hover {
  background: #e6f0ff;
}
.mobile-menu-toggle {
  display: none;
  background: none;
  border: none;
  margin-left: 1rem;
  cursor: pointer;
}
.mobile-menu-bar {
  display: block;
  width: 28px;
  height: 4px;
  background: #222;
  border-radius: 2px;
  position: relative;
}
.country-image {
  width: 28px;

  @media (max-width: 1024px) {
    width: 5vw;
  }
}
.country-images-list {
  width: 100%;
  overflow: hidden;
}
.country-label {
  width: 100px;
  @media (max-width: 1024px) {
    display: none;
  }
}
</style>
