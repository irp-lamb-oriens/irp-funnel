<script lang="ts">
    export let label: string;
    export let href: string | null = null;
    export let ariaLabel: string = "";
    export let className: string = "";
  
    export let variant:
      | "primary"
      | "secondary"
      | "link"
      | "primary-inverted"
      | "secondary-inverted"
      | "primary-scaled" = "primary";
  
    export let disabled: boolean = false;
    export let loading: boolean = false;
    export let fullWidth: boolean = false;
    export let target: "_blank" | "_self" | "_parent" | "_top" = "_self";
    export let rel: string = "";
  
    $: isLink = !!href && !disabled && !loading;
  
    // Mapeo de variantes a clases utilzando SOLO las variables disponibles
    // --color-background, --color-outline, --color-background, --color-background, --color-background-inversion
    $: variantClass = `cta-${variant}`;
  
    function onClick(e: MouseEvent) {
      if (!isLink) e.preventDefault();
    }
  
    function onKeydown(e: KeyboardEvent) {
      if (isLink) return;
      if (e.key === " " || e.key === "Enter") e.preventDefault();
    }
  </script>
  
  {#if isLink}
    <a
      class="cta-btn {variantClass} {className} {fullWidth ? 'is-block' : ''}"
      href={href!}
      aria-label={ariaLabel || label}
      aria-busy={loading ? "true" : "false"}
      data-disabled="false"
      target={target}
      rel={target === "_blank" ? (rel ? rel : "noopener noreferrer") : rel}
      on:click={onClick}
      on:keydown={onKeydown}
    >
      <span class="cta-btn__inner">
        <slot name="icon-left" />
        <span class="cta-btn__label">{label}</span>
        <slot name="icon-right" />
        {#if loading}<span class="cta-btn__spinner" aria-hidden="true" />{/if}
      </span>
    </a>
  {:else}
    <button
      class="cta-btn {variantClass} {className} {fullWidth ? 'is-block' : ''}"
      type="button"
      aria-label={ariaLabel || label}
      aria-busy={loading ? "true" : "false"}
      {disabled}
      data-disabled={disabled || loading ? "true" : "false"}
    >
      <span class="cta-btn__inner">
        <slot name="icon-left" />
        <span class="cta-btn__label">{label}</span>
        <slot name="icon-right" />
        {#if loading}<span class="cta-btn__spinner" aria-hidden="true" />{/if}
      </span>
    </button>
  {/if}
  
  <style>
    /* Base */
    .cta-btn {
      --radius-md: 9999px; /* si ya tienes otra var de radios, cámbiala aquí */
      --transition-fast: 150ms;
  
      display: inline-block;
      font-weight: 600;
      border-radius: var(--radius-md);
      padding: 0.75rem 1.5rem;
      text-align: center;
      transition: all var(--transition-fast);
      border: 2px solid transparent;
      cursor: pointer;
      line-height: 1;
      user-select: none;
    }
    .cta-btn:focus-visible {
      outline: 2px solid transparent;
      outline-offset: 2px;
      box-shadow:
        0 0 0 3px var(--color-background),
        0 0 0 5px var(--color-highlight-2);
    }
    .cta-btn[data-disabled="true"] {
      opacity: 0.6;
      cursor: not-allowed;
      pointer-events: none;
    }
    .cta-btn__inner {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    .cta-btn__spinner {
      inline-size: 1em;
      block-size: 1em;
      border-radius: 50%;
      border: 2px solid currentColor;
      border-right-color: transparent;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  
    .is-block { display: block; width: 100%; }
  
    /* Variantes (solo con vars disponibles) */
  
    /* PRIMARY (usa bac--color-background como color principal) */
    .cta-primary {
      /* texto inicialmente en background para el truco de "tinta" */
      background-color: var(--color-highlight-1);
      color: var(--color-background);
      /* relleno por sombra interna del color principal */
      box-shadow: inset 0 0 0 100px var(--color-highlight-1);
      transition: box-shadow .5s, color .2s, background-color .4s;
    }
    .cta-primary:hover {
      background-color: transparent;
      color: var(--color-highlight-2);
      box-shadow: inset 0 0 0 2px var(--color-highlight-2);
    }
  
    /* PRIMARY INVERTED (botón sobre fondo oscuro o secciones hero) */
    .cta-primary-inverted {
      background-color: var(--color-background);
      color: var(--color-background-inversion);
      box-shadow: inset 0 0 0 100px var(--color-background);
      transition: box-shadow .5s, color .2s, background-color .4s;
    }
    .cta-primary-inverted:hover {
      background-color: transparent;
      color: var(--color-background);
      box-shadow: inset 0 0 0 2px var(--color-background);
    }
  
    /* PRIMARY SCALED (mismo esquema que inverted pero con scale en hover) */
    .cta-primary-scaled {
      background-color: var(--color-background);
      color: var(--color-background-inversion);
      box-shadow: inset 0 0 0 100px var(--color-background);
      transition: box-shadow .5s, color .2s, background-color .4s, transform .75s;
      transition-timing-function: cubic-bezier(0.5, 0, 0.5, 1);
      transform: scale(1);
    }
    .cta-primary-scaled:hover { transform: scale(1.025); }
  
    /* SECONDARY (borde con bac--color-background para contraste; hover eleva a bac--color-background) */
    .cta-secondary {
      background-color: var(--color-background);
      color: var(--color-background-inversion);
      border-color: var(--color-background);
    }
    .cta-secondary:hover { border-color: var(--color-background); color: var(--color-background); }
  
    /* SECONDARY INVERTED (pensado para fondos con bac--color-background/2 oscuros o imágenes) */
    .cta-secondary-inverted {
      background-color: var(--color-background);
      color: var(--color-background-inversion);
      box-shadow: inset 0 0 0 100px var(--color-background);
      transition: box-shadow .5s, color .2s, background-color .4s;
    }
    .cta-secondary-inverted:hover {
      background-color: transparent;
      color: var(--color-background);
      box-shadow: inset 0 0 0 2px var(--color-background);
    }
  
    /* LINK (tono minimal; usa bac--color-background-inversion para diferenciar del primary) */
    .cta-link {
      background: none;
      border: none;
      color: var(--color-background-inversion);
      text-decoration: underline;
      padding: 0;
    }
    .cta-link:hover { opacity: 0.85; }
  </style>
  