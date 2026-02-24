<script lang="ts">
    import { goto } from "$app/navigation";
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
  
    export let callback: Function | null = null;
    export let disabled: boolean = false;
    export let loading: boolean = false;
    export let fullWidth: boolean = false;
    export let target: "_blank" | "_self" | "_parent" | "_top" = "_self";
    export let rel: string = "";
    export let trigger: boolean = false;
  
    $: isLink = !!href && !disabled && !loading;
  
    // Mapeo de variantes a clases utilzando SOLO las variables disponibles
    // --color-background, --color-outline, --color-background, --color-background, --color-background-inversion
    $: variantClass = `cta-${variant}`;
  
    function onClick(e: MouseEvent) {
      if (trigger) {
        e.preventDefault();
        const search = window.location.search;
        goto(`/${search}#hero-form`);
      }
      callback?.();
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
      on:keydown={onKeydown}
      on:click={onClick}
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
      on:click={onClick}
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
      --radius-full: 9999px;
      --transition-modern: all 0.4s cubic-bezier(0.23, 1, 0.32, 1);
      --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
      --shadow-md: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
  
      display: inline-block;
      font-weight: 600;
      border-radius: var(--radius-full);
      padding: 0.85rem 1.75rem;
      text-align: center;
      transition: var(--transition-modern);
      border: 2px solid transparent;
      cursor: pointer;
      line-height: 1.2;
      user-select: none;
      position: relative;
      overflow: hidden;
      letter-spacing: 0.02em;
      box-shadow: var(--shadow-sm);
      transform: translateZ(0); /* Hardware acceleration */
      text-decoration: none;
    }
  
    /* Modern Glint Effect */
    .cta-btn::before {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(
        120deg,
        transparent,
        rgba(255, 255, 255, 0.15),
        transparent
      );
      transition: all 0.6s;
      z-index: 1;
    }
  
    .cta-btn:hover::before {
      left: 100%;
    }
  
    .cta-btn:hover {
      transform: translateY(-2px) scale(1.01);
      box-shadow: var(--shadow-md);
    }
  
    .cta-btn:active {
      transform: translateY(0) scale(0.98);
      box-shadow: var(--shadow-sm);
      transition: all 0.1s ease;
    }
  
    .cta-btn:focus-visible {
      outline: none;
      box-shadow:
        0 0 0 2px var(--color-background),
        0 0 0 4px var(--color-highlight-2),
        var(--shadow-md);
    }
  
    .cta-btn[data-disabled="true"] {
      opacity: 0.5;
      cursor: not-allowed;
      pointer-events: none;
      filter: grayscale(0.5);
      transform: none !important;
      box-shadow: none !important;
    }
  
    .cta-btn__inner {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 0.6rem;
      position: relative;
      z-index: 2;
      pointer-events: none;
    }
  
    .cta-btn__spinner {
      inline-size: 1.1em;
      block-size: 1.1em;
      border-radius: 50%;
      border: 2px solid currentColor;
      border-right-color: transparent;
      animation: spin 0.6s cubic-bezier(0.5, 0.1, 0.4, 0.9) infinite;
    }
  
    @keyframes spin { to { transform: rotate(360deg); } }
  
    .is-block { display: flex; width: 100%; justify-content: center; }
  
    /* Variantes */
  
    /* PRIMARY */
    .cta-primary {
      background-color: var(--color-highlight-1);
      color: var(--color-background);
      box-shadow: inset 0 0 0 100px var(--color-highlight-1), var(--shadow-sm);
    }
    .cta-primary:hover {
      background-color: transparent;
      color: var(--color-highlight-2);
      box-shadow: inset 0 0 0 2px var(--color-highlight-2), var(--shadow-md);
    }
  
    /* PRIMARY INVERTED */
    .cta-primary-inverted {
      background-color: var(--color-background);
      color: var(--color-background-inversion);
      box-shadow: inset 0 0 0 100px var(--color-background), var(--shadow-sm);
    }
    .cta-primary-inverted:hover {
      background-color: transparent;
      color: var(--color-background);
      box-shadow: inset 0 0 0 2px var(--color-background), var(--shadow-md);
    }
    .cta-primary-inverted::before {
      background: linear-gradient(
        120deg,
        transparent,
        rgba(255, 255, 255, 0.2),
        transparent
      );
    }
  
    /* PRIMARY SCALED */
    .cta-primary-scaled {
      background-color: var(--color-background);
      color: var(--color-background-inversion);
      box-shadow: inset 0 0 0 100px var(--color-background), var(--shadow-sm);
    }
    .cta-primary-scaled:hover {
      transform: translateY(-3px) scale(1.035);
      box-shadow: var(--shadow-lg);
    }
    .cta-primary-scaled:hover::before {
      transition: all 0.8s cubic-bezier(0.23, 1, 0.32, 1);
    }
  
    /* SECONDARY */
    .cta-secondary {
      background-color: var(--color-highlight-2);
      color: var(--color-background);
      border-color: var(--color-highlight-2);
    }
    .cta-secondary:hover {
      color: var(--color-highlight-2);
      background-color: transparent;
    }
    .cta-secondary::before {
      background: linear-gradient(
        120deg,
        transparent,
        rgba(255, 255, 255, 0.25),
        transparent
      );
    }
  
    /* SECONDARY INVERTED */
    .cta-secondary-inverted {
      background-color: var(--color-background);
      color: var(--color-background-inversion);
      box-shadow: inset 0 0 0 100px var(--color-background), var(--shadow-sm);
    }
    .cta-secondary-inverted:hover {
      background-color: transparent;
      color: var(--color-background);
      box-shadow: inset 0 0 0 2px var(--color-background), var(--shadow-md);
    }
    .cta-secondary-inverted::before {
      background: linear-gradient(
        120deg,
        transparent,
        rgba(255, 255, 255, 0.2),
        transparent
      );
    }
  
    /* LINK */
    .cta-link {
      background: none;
      border: none;
      color: var(--color-background-inversion);
      padding: 0.2rem 0;
      box-shadow: none;
      font-weight: 500;
      overflow: visible;
    }
    .cta-link::before { display: none; }
    .cta-link::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 1px;
      background-color: currentColor;
      transform: scaleX(0.3);
      transform-origin: left;
      transition: var(--transition-modern);
      opacity: 0.7;
    }
    .cta-link:hover {
      transform: translateX(4px);
      box-shadow: none;
      opacity: 1;
    }
    .cta-link:hover::after {
      transform: scaleX(1);
      opacity: 1;
    }
    .cta-link:active {
      transform: translateX(2px) scale(0.98);
    }
  </style>