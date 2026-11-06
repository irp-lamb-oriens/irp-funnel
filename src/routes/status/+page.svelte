<script lang="ts">
  import { goto } from '$app/navigation';
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import '../status/[id]/status.scss'; // Reuse the ultra-modern styling

  let emailInput = '';

  function handleSubmit() {
    if (!emailInput || !emailInput.includes('@')) return;
    
    // Reshape email to document ID format
    // e.g., oriens@aiban.news -> oriens_aiban_news
    const projectId = emailInput.toLowerCase().trim().replace(/[@.]/g, "_");
    
    // Redirect to the specific project status page
    goto(`/status/${projectId}`);
  }
</script>

<svelte:head>
  <title>Check Project Status | IRP</title>
  <meta name="robots" content="noindex, nofollow" />
</svelte:head>

<Header />

<div class="client-portal">
  <div class="cp-auth-wall">
    <div class="cp-auth-wall__layout">
    <aside class="cp-auth-wall__brand" aria-label="About the portal">
      <p class="cp-auth-wall__eyebrow">International Relocation Partner</p>
      <p class="cp-auth-wall__headline">Track your move.</p>
      <p class="cp-auth-wall__lede">Use the email on your relocation file. We will send you a code to open your portal: your status, your proposal and your charges.</p>
    </aside>
    <div class="cp-auth-wall__card">
      <span class="cp-auth-wall__icon" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></span>
      <h1 class="cp-auth-wall__title">Track Your Move</h1>
      <p class="cp-auth-wall__subtitle">Enter your email to find your project</p>

      <form on:submit|preventDefault={handleSubmit} class="cp-auth-wall__form">
        <div class="cp-auth-wall__input-group">
          <label for="search-email">Email Address</label>
          <input
            id="search-email"
            type="email"
            bind:value={emailInput}
            placeholder="your.email@example.com"
            required
            class="cp-auth-wall__input"
            autocomplete="email"
            autocapitalize="none"
          />
        </div>
        <button type="submit" class="cp-auth-wall__btn" disabled={!emailInput.trim() || !emailInput.includes('@')}>
          Find Project
        </button>
      </form>
      
      <div class="cp-auth-wall__security-note">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>
        <span style="text-align: left;">Your progress is securely tracked. You will receive an authorization code on the next screen to access your data.</span>
      </div>
    </div>
    </div>
  </div>
</div>

<Footer />
