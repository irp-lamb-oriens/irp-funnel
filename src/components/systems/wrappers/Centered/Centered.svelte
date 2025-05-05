<div class="centered">
  <div>
    <slot />
  </div>
</div>

<style lang="scss">
  .centered {
    display: grid;
    place-items: center;
    justify-content: center;
    height: 100%;
    width: min(640px, 100%);
    padding: 0 25px;
    margin: auto;
    height: 100vh;
  }
</style>
