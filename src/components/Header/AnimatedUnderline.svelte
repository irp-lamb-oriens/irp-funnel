<script lang="ts">
  export let selected: boolean = false;
  export let hovered: boolean = false;
</script>

<style>
.animated-underline-container {
  position: relative;
  display: inline-block;
}

.animated-underline-content {
  position: relative;
  display: inline-block;
  cursor: pointer;
}

.animated-underline-content::after {
  content: "";
  position: absolute;
  left: 0;
  bottom: 0;
  height: 2px;
  width: 0;
  background: currentColor;
  border-radius: 1px;
  pointer-events: none;
  opacity: 0;
  transition:
    width 0.32s cubic-bezier(0.7,0,0.3,1),
    opacity 0.18s cubic-bezier(0.7,0,0.3,1);
  z-index: 1;
}

.animated-underline-content.is-active::after {
  width: 100%;
  opacity: 1;
  transition:
    width 0.32s cubic-bezier(0.7,0,0.3,1),
    opacity 0.18s cubic-bezier(0.7,0,0.3,1);
}
</style>

<div class="animated-underline-container">
  <span
    class="animated-underline-content {selected || hovered ? 'is-active' : ''}"
    aria-current={selected ? "page" : undefined}
  >
    <slot />
  </span>
</div>
