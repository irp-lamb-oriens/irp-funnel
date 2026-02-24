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
  left: 50%;
  bottom: -4px;
  height: 1px;
  width: 0;
  background: linear-gradient(90deg, transparent, #fff, transparent);
  border-radius: 9999px;
  pointer-events: none;
  opacity: 0;
  transform: translateX(-50%);
  transition:
    width 0.5s cubic-bezier(0.23, 1, 0.32, 1),
    opacity 0.3s cubic-bezier(0.23, 1, 0.32, 1);
  z-index: 1;
}

.animated-underline-content.is-active::after {
  width: 100%;
  opacity: 1;
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
