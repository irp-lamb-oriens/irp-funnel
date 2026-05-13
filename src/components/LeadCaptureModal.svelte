<script lang="ts">
  import { createEventDispatcher, onMount } from "svelte";
  import { fade, scale } from "svelte/transition";
  import Email from "./systems/inputs/Email/Email.svelte";
  import SubmitButton from "./systems/buttons/SubmitButton/SubmitButton.svelte";
  import store from "./store.js";

  export let show = false;
  export let destinationCountry = "";

  const dispatch = createEventDispatcher();
  
  let emailValue = "";
  let isEmailValid = false;
  let isLoading = false;
  let emailInputRef: HTMLInputElement;

  function handleEmailChange(newValue: string) {
    // Only update validity flag. bind:value handles the raw string.
    isEmailValid = newValue !== "";
  }

  async function handleSubmit() {
    if (!isEmailValid || !emailValue.trim()) return;
    
    isLoading = true;
    try {
      const apiURL = $store.apiURL();
      const response = await fetch(`${apiURL}/api/capture-data`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailValue.trim(),
          name: "Guide Reader",
          topCountries: destinationCountry ? [destinationCountry, "Unknown", "Unknown"] : ["Unknown", "Unknown", "Unknown"],
          funnelType: "country-guide-gate",
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        localStorage.setItem("userEmail", emailValue.trim());
        show = false;
        dispatch("success");
      } else {
        console.error("Failed to capture email:", await response.text());
      }
    } catch (err) {
      console.error("Error submitting email:", err);
    } finally {
      isLoading = false;
    }
  }
</script>

{#if show}
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <div class="modal-backdrop" transition:fade={{ duration: 200 }} on:click={() => { /* prevent closing by clicking outside if required */ }}>
    <div class="modal-content" transition:scale={{ duration: 300, start: 0.95 }} on:click|stopPropagation>
      <div class="modal-header">
        <div class="icon-wrapper">
          <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lock-icon"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
        </div>
        <h2>Unlock Full Access</h2>
      </div>
      
      <p class="modal-desc">
        Enter your email to instantly read the full relocation guide for {destinationCountry || 'this destination'}. We will also send a copy directly to your inbox so you have it for your records.
      </p>

      <div class="form-wrapper">
        <Email 
          bind:value={emailValue} 
          onChange={handleEmailChange} 
          onEnter={handleSubmit} 
          bind:inputElement={emailInputRef} 
          label="Your Best Email"
          placeholder="email@example.com"
        />
        
        <div class="btn-wrapper">
          <SubmitButton
            label="Read Guide Now"
            callback={handleSubmit}
            loading={isLoading}
            disabled={!isEmailValid}
          />
        </div>
      </div>
      
      <p class="disclaimer">We respect your privacy. No spam.</p>
    </div>
  </div>
{/if}

<style lang="scss">
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 99999;
    padding: 1rem;
  }

  .modal-content {
    background: #1a1a1a;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 24px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    width: 100%;
    max-width: 460px;
    padding: 2.5rem;
    text-align: center;
    color: #fff;
    position: relative;
    overflow: hidden;
    
    &::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 4px;
      background: linear-gradient(90deg, var(--color-highlight-2), var(--color-highlight-1));
    }
  }

  .modal-header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.5rem;
    
    .icon-wrapper {
      width: 64px;
      height: 64px;
      background: rgba(255, 255, 255, 0.05);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-highlight-2);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    h2 {
      font-size: 1.8rem;
      font-weight: 800;
      margin: 0;
      font-family: var(--font-title);
      letter-spacing: -0.02em;
    }
  }

  .modal-desc {
    color: #a3a3a3;
    font-size: 1.05rem;
    line-height: 1.5;
    margin-bottom: 2rem;
  }

  .form-wrapper {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .btn-wrapper {
    display: flex;
    justify-content: center;
    width: 100%;
  }

  .disclaimer {
    margin-top: 1.5rem;
    font-size: 0.8rem;
    color: #666;
  }
</style>