<script lang="ts">
  export let href: string = "/";
  export let src: string = "/IRP-LOGO.jpg";
  export let alt: string = "IRP Logo";
  export let width: number = 200;
  export let height: number = 82;
  export let className: string = "logo-img";
</script>

<a href={href} class="logo-link" aria-label="Home">
  <img
    src={src}
    alt={alt}
    width={width}
    height={height}
    class={className}
    loading="eager"
    decoding="async"
  />
</a>

<style lang="scss">
.logo-link {
  display: flex;
  align-items: center;
  text-decoration: none;
}
.logo-img {
  display: block;
  height: 62px;
  object-fit: cover;
}
</style>
