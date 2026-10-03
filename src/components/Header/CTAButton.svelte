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
        {#if loading}
          <div class="ultra-modern-loader">
            <div class="magnetic-orb">
              <div class="inner-core"></div>
              <div class="pulse-ring"></div>
            </div>
            <div class="neon-trail"></div>
          </div>
        {/if}
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
        {#if loading}
          <div class="ultra-modern-loader">
            <div class="magnetic-orb">
              <div class="inner-core"></div>
              <div class="pulse-ring"></div>
            </div>
            <div class="neon-trail"></div>
          </div>
        {/if}
      </span>
    </button>
  {/if}
  
  <style lang="scss">
    /* Base */
    .cta-btn {
      --radius-full: 9999px;
      --transition-modern: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
      --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
      --shadow-md: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
      --shadow-lg: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      --glow-color: rgba(255, 255, 255, 0);
  
      overflow: hidden;
      display: inline-block;
      font-weight: 600;
      border-radius: var(--radius-full);
      padding: 0.85rem 1.75rem;
      text-align: center;
      transition: var(--transition-modern);
      border: 1px solid rgba(255, 255, 255, 0.1);
      cursor: pointer;
      line-height: 1.2;
      user-select: none;
      position: relative;
      overflow: visible; // Allow glow to spill out
      letter-spacing: 0.02em;
      box-shadow: var(--shadow-sm);
      transform: translateZ(0);
      text-decoration: none;

      &::before {
        content: '';
        position: absolute;
        inset: -2px;
        border-radius: var(--radius-full);
        padding: 2px;
        background: conic-gradient(from 0deg, var(--color-highlight-2, #fff), transparent, var(--color-highlight-2, #fff));
        -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        opacity: 0;
        transition: opacity 0.3s ease;
      }
    }
  
    /* Modern Glint Effect */
    .cta-btn::after {
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
  
    .cta-btn:hover::after {
      left: 100%;
    }
  
    .cta-btn:hover {
      transform: scale(1.02);
      box-shadow: 
        var(--shadow-lg),
        0 0 30px var(--glow-color);
      border-color: rgba(255, 255, 255, 0.3);

      &::before {
        opacity: 1;
        animation: borderRotate 2s linear infinite;
      }
    }

    @keyframes borderRotate {
      from { filter: hue-rotate(0deg); }
      to { filter: hue-rotate(360deg); }
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
      overflow: hidden;
    }
  
    .ultra-modern-loader {
      display: inline-flex;
      position: relative;
      align-items: center;
      justify-content: center;
      width: 1.2rem;
      height: 1.2rem;
      margin-left: 0.2rem;

      .magnetic-orb {
        position: relative;
        width: 6px;
        height: 6px;
        background: currentColor;
        border-radius: 50%;
        z-index: 2;
        
        .inner-core {
          position: absolute;
          inset: 1px;
          background: var(--color-background);
          border-radius: 50%;
          animation: corePulse 0.8s ease-in-out infinite alternate;
        }

        .pulse-ring {
          position: absolute;
          inset: -6px;
          border: 1px solid currentColor;
          opacity: 0.3;
          border-radius: 50%;
          animation: ringPulse 1.5s cubic-bezier(0.23, 1, 0.32, 1) infinite;
        }
      }

      .neon-trail {
        position: absolute;
        inset: -2px;
        border-radius: 50%;
        border: 1.5px solid transparent;
        border-top: 1.5px solid currentColor;
        animation: ultraSpin 0.6s linear infinite;
      }
    }

    @keyframes ultraSpin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes corePulse {
      from { transform: scale(0.7); opacity: 0.5; }
      to { transform: scale(1); opacity: 1; }
    }

    @keyframes ringPulse {
      0% { transform: scale(0.5); opacity: 1; }
      100% { transform: scale(1.5); opacity: 0; }
    }
  
    .is-block { display: flex; width: 100%; justify-content: center; }
  
    /* Variantes */
  
    /* PRIMARY */
    .cta-primary {
      background: linear-gradient(135deg, #c62326 0%, #8f191b 100%);
      color: #fff;
      box-shadow:
        0 4px 14px 0 rgba(0, 0, 0, 0.2),
        0 0 0 1px rgba(255, 255, 255, 0.1) inset;
      overflow: hidden;
      --glow-color: rgba(198, 35, 38, 0.4);
      border: none;
    }
    .cta-primary:hover {
      box-shadow:
        0 8px 25px 0 rgba(0, 0, 0, 0.3),
        0 0 0 1px rgba(255, 255, 255, 0.2) inset,
        0 0 20px var(--glow-color);
      background: linear-gradient(135deg, #a01a1d 0%, #c62326 100%);
    }

    /* PRIMARY INVERTED */
    .cta-primary-inverted {
      background-color: var(--color-background);
      color: var(--color-background-inversion);
      box-shadow: inset 0 0 0 100px var(--color-background), var(--shadow-sm);
      overflow: hidden;
      --glow-color: rgba(255, 255, 255, 0.2);
    }
    .cta-primary-inverted:hover {
      background-color: transparent;
      color: var(--color-background);
      box-shadow: inset 0 0 0 2px var(--color-background), var(--shadow-md), 0 0 30px rgba(255, 255, 255, 0.4);
    }
  
    /* PRIMARY SCALED */
    .cta-primary-scaled {
      background-color: var(--color-background);
      color: var(--color-background-inversion);
      box-shadow: inset 0 0 0 100px var(--color-background), var(--shadow-sm);
      overflow: hidden;
      --glow-color: rgba(255, 255, 255, 0.3);
    }
    .cta-primary-scaled:hover {
      transform: translateY(-3px) scale(1.035);
      box-shadow: var(--shadow-lg), 0 0 40px var(--glow-color);
    }
  
    /* SECONDARY */
    .cta-secondary {
      background-color: var(--color-highlight-2);
      color: var(--color-background);
      border-color: var(--color-highlight-2);
      overflow: hidden;
      --glow-color: rgba(var(--color-highlight-2-rgb), 0.5);
    }
    .cta-secondary:hover {
      color: var(--color-highlight-2);
      background-color: transparent;
      box-shadow: var(--shadow-md), 0 0 30px rgba(var(--color-highlight-2-rgb), 0.6);
    }
  
    /* SECONDARY INVERTED */
    .cta-secondary-inverted {
      background-color: var(--color-background);
      color: var(--color-background-inversion);
      box-shadow: inset 0 0 0 100px var(--color-background), var(--shadow-sm);
      overflow: hidden;
      --glow-color: rgba(255, 255, 255, 0.2);
    }
    .cta-secondary-inverted:hover {
      background-color: transparent;
      color: var(--color-background);
      box-shadow: inset 0 0 0 2px var(--color-background), var(--shadow-md), 0 0 30px rgba(255, 255, 255, 0.4);
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
    .cta-link::before, .cta-link::after { display: none; }
    .cta-link:hover {
      transform: translateX(4px);
      box-shadow: none;
      opacity: 1;
    }
    .cta-link:active {
      transform: translateX(2px) scale(0.98);
    }
  </style>
