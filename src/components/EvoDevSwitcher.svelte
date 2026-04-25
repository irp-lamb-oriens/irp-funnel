<!--
  EvoDevSwitcher.svelte
  ────────────────────────────────────────────────────────────────────────────
  A development-only utility that renders a floating action button in the
  bottom-right corner. When clicked, it displays a beautiful dropdown grouped
  by component, allowing developers to manually override their sticky variant
  assignment and immediately see the result.
  
  This component is NOT rendered in production.
-->
<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { EVO_COMPONENTS } from '../lib/evo/config.ts';
  import { getAssignments, setAssignment } from '../lib/evo/identity.ts';

  let isOpen = false;
  let currentAssignments: Record<string, string> = {};

  onMount(() => {
    if (browser) {
      currentAssignments = getAssignments();
    }
  });

  function toggle() {
    isOpen = !isOpen;
    if (isOpen && browser) {
      // Refresh in case they changed during the session
      currentAssignments = getAssignments();
    }
  }

  import { forceVariant } from '../lib/evo/client.ts';

  function selectVariant(componentKey: string, variantKey: string) {
    if (browser) {
      forceVariant(componentKey, variantKey);
      currentAssignments = getAssignments();
    }
  }

  // Define categories for UI grouping
  const categories = [
    {
      id: 'forms',
      title: 'Hero Forms & UI',
      components: ['HeroForm', 'HeroFormColor']
    },
    {
      id: 'chatbot',
      title: 'Chatbot & Agents',
      components: ['Chatbot', 'ChatbotPersona']
    },
    {
      id: 'emails',
      title: 'Email Drip Campaigns',
      components: ['EmailDripSubject', 'EmailDripBody']
    }
  ];

  // Initialize expanded state for categories
  let expandedCategories: Record<string, boolean> = {
    forms: true,
    chatbot: true,
    emails: true
  };

  function toggleCategory(categoryId: string) {
    expandedCategories[categoryId] = !expandedCategories[categoryId];
  }

  // Get components for the UI
  const componentsList = Object.values(EVO_COMPONENTS);
</script>

<div class="evo-dev-switcher">
  <!-- Floating Action Button -->
  <button class="evo-fab" on:click={toggle} aria-label="Evo Split-Testing Switcher" class:is-active={isOpen}>
    <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
      <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
      <line x1="12" y1="22.08" x2="12" y2="12"></line>
    </svg>
    <span class="evo-fab__badge">{componentsList.length}</span>
  </button>

  <!-- Dropdown Menu -->
  {#if isOpen}
    <div class="evo-dropdown">
      <div class="evo-dropdown__header">
        <h3>Evo Variant Switcher</h3>
        <p>Local dev only. Click a variant to force assignment and reload.</p>
      </div>
      
      <div class="evo-dropdown__body">
        {#each categories as category}
          <div class="evo-category-group">
            <button 
              class="evo-category-header" 
              on:click={() => toggleCategory(category.id)}
            >
              <h3>{category.title}</h3>
              <svg 
                class="evo-chevron" 
                class:is-expanded={expandedCategories[category.id]} 
                viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>

            {#if expandedCategories[category.id]}
              <div class="evo-category-content">
                {#each category.components as componentKey}
                  {#if EVO_COMPONENTS[componentKey]}
                    <div class="evo-component-group">
                      <h4 class="evo-component-title">
                        <span class="evo-component-name">{componentKey}</span>
                      </h4>
                      <div class="evo-variant-list">
                        {#each EVO_COMPONENTS[componentKey].variants as variant}
                          <button 
                            class="evo-variant-btn" 
                            class:is-selected={currentAssignments[componentKey] === variant.key}
                            on:click={() => selectVariant(componentKey, variant.key)}
                          >
                            <div class="evo-variant-info">
                              <span class="evo-variant-key">{variant.key}</span>
                              {#if variant.label}
                                <span class="evo-variant-label">{variant.label}</span>
                              {/if}
                            </div>
                            {#if currentAssignments[componentKey] === variant.key}
                              <span class="evo-check">
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                              </span>
                            {/if}
                          </button>
                        {/each}
                      </div>
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/each}

        <!-- Catch-all for uncategorized components -->
        {#each componentsList.filter(c => !categories.some(cat => cat.components.includes(c.key))) as component}
          <div class="evo-component-group">
            <h4 class="evo-component-title">
              <span class="evo-component-name">{component.key}</span>
            </h4>
            <div class="evo-variant-list">
              {#each component.variants as variant}
                <button 
                  class="evo-variant-btn" 
                  class:is-selected={currentAssignments[component.key] === variant.key}
                  on:click={() => selectVariant(component.key, variant.key)}
                >
                  <div class="evo-variant-info">
                    <span class="evo-variant-key">{variant.key}</span>
                    {#if variant.label}
                      <span class="evo-variant-label">{variant.label}</span>
                    {/if}
                  </div>
                  {#if currentAssignments[component.key] === variant.key}
                    <span class="evo-check">
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>
    
    <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
    <div class="evo-backdrop" on:click={toggle}></div>
  {/if}
</div>

<style lang="scss">
  .evo-dev-switcher {
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 999999; /* Insanely high to always be on top */
    font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  }

  .evo-fab {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: linear-gradient(135deg, #6366f1, #8b5cf6);
    color: white;
    border: none;
    box-shadow: 0 10px 25px -5px rgba(99, 102, 241, 0.5), 0 8px 10px -6px rgba(99, 102, 241, 0.4);
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    position: relative;
    z-index: 2;
  }

  .evo-fab:hover {
    transform: translateY(-4px) scale(1.05);
    box-shadow: 0 14px 30px -5px rgba(99, 102, 241, 0.6), 0 10px 15px -6px rgba(99, 102, 241, 0.5);
  }

  .evo-fab.is-active {
    transform: rotate(90deg);
    background: #1e293b;
    box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
    .evo-fab__badge {
      transform: rotate(-90deg);
    }
  }

  .evo-fab__badge {
    position: absolute;
    top: -4px;
    right: -4px;
    background: #ef4444;
    color: white;
    font-size: 10px;
    font-weight: 800;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 2px solid #0f172a;
  }

  .evo-backdrop {
    position: fixed;
    inset: 0;
    z-index: 0;
    /* Invisible backdrop just to catch clicks outside the dropdown */
  }

  .evo-dropdown {
    position: absolute;
    bottom: 72px;
    right: 0;
    width: 380px;
    max-height: calc(100vh - 120px);
    background: rgba(15, 23, 42, 0.95);
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 1;
    animation: evoSlideUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    transform-origin: bottom right;
  }

  @keyframes evoSlideUp {
    from { opacity: 0; transform: scale(0.9) translateY(20px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .evo-dropdown__header {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(2, 6, 23, 0.5);
  }

  .evo-dropdown__header h3 {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 700;
    color: #f8fafc;
    letter-spacing: -0.01em;
  }

  .evo-dropdown__header p {
    margin: 0;
    font-size: 12px;
    color: #94a3b8;
    line-height: 1.4;
  }

  .evo-dropdown__body {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    /* Custom scrollbar for dark theme */
    scrollbar-width: thin;
    scrollbar-color: rgba(255, 255, 255, 0.2) transparent;
  }
  .evo-dropdown__body::-webkit-scrollbar {
    width: 6px;
  }
  .evo-dropdown__body::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.2);
    border-radius: 3px;
  }

  .evo-category-group {
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  }
  .evo-category-group:last-child {
    border-bottom: none;
  }

  .evo-category-header {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px;
    background: transparent;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
  }
  .evo-category-header:hover {
    background: rgba(255, 255, 255, 0.03);
  }
  .evo-category-header h3 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: #e2e8f0;
  }
  .evo-chevron {
    width: 16px;
    height: 16px;
    color: #94a3b8;
    transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .evo-chevron.is-expanded {
    transform: rotate(180deg);
  }

  .evo-category-content {
    padding: 0 16px 16px;
    display: flex;
    flex-direction: column;
    gap: 20px;
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(-4px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .evo-component-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .evo-component-title {
    margin: 0;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #cbd5e1;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .evo-component-name {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-weight: 600;
    color: #818cf8;
    background: rgba(99, 102, 241, 0.1);
    padding: 2px 6px;
    border-radius: 4px;
  }

  .evo-variant-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    overflow: hidden;
  }

  .evo-variant-btn {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 12px 16px;
    background: transparent;
    border: none;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    cursor: pointer;
    text-align: left;
    transition: all 0.2s ease;
  }
  
  .evo-variant-btn:last-child {
    border-bottom: none;
  }

  .evo-variant-btn:hover {
    background: rgba(255, 255, 255, 0.05);
  }

  .evo-variant-btn.is-selected {
    background: rgba(16, 185, 129, 0.1);
  }

  .evo-variant-info {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .evo-variant-key {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 13px;
    font-weight: 500;
    color: #e2e8f0;
  }

  .is-selected .evo-variant-key {
    color: #34d399;
  }

  .evo-variant-label {
    font-size: 12px;
    color: #94a3b8;
  }

  .evo-check {
    color: #10b981;
    display: flex;
    align-items: center;
    justify-content: center;
  }
</style>
