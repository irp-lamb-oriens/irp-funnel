<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  import store from '../store.js';
  import { getAttribution } from '../../lib/attribution.ts';

  let email = "";
  let subscribed = false;
  let submitting = false;
  let errorMsg = "";
  const year = new Date().getFullYear();

  // Previously this only console.logged and showed "Thanks" — every signup was
  // silently dropped. It now posts to the same /api/capture-data endpoint the
  // HeroForm email step uses (adds to the newsletter list; creates a CRM lead
  // only if one doesn't already exist for this email).
  async function handleSubscribe() {
    const clean = email.trim();
    if (!clean || submitting) return;
    submitting = true;
    errorMsg = "";
    try {
      const res = await fetch(`${$store.apiURL()}/api/capture-data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: clean,
          name: '',
          source: 'footer-newsletter',
          timestamp: new Date().toISOString(),
          attribution: getAttribution(),
        }),
      });
      if (!res.ok) throw new Error(`Subscribe failed: ${res.status}`);
      subscribed = true;
      email = "";
    } catch (err) {
      console.error(err);
      errorMsg = "Something went wrong. Please try again in a moment.";
    } finally {
      submitting = false;
    }
  }
</script>

<style lang="scss" src="./Footer.scss"></style>

<footer class="footer-section">
  <div class="footer-container">
    <div class="footer-top">
      <div class="footer-brand-area">
        <a href="/" class="footer-logo-link" aria-label="International Relocation Partner — home">
          <img src="/IRP-LOGO.jpg" alt="" class="footer-logo" loading="lazy" decoding="async" />
        </a>
        <p class="footer-description">
          Simplifying your international relocation journey with expert guidance and seamless logistics.
        </p>
        <div class="footer-social-links">
          <a href="https://www.facebook.com/pabloeariasc" class="social-icon-link" aria-label="Facebook (opens in a new tab)" target="_blank" rel="noopener noreferrer">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
          </a>
          <a href="https://www.instagram.com/pabloearias" class="social-icon-link" aria-label="Instagram (opens in a new tab)" target="_blank" rel="noopener noreferrer">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
          </a>
          <a href="https://www.linkedin.com/in/pabloearias/" class="social-icon-link" aria-label="LinkedIn (opens in a new tab)" target="_blank" rel="noopener noreferrer">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
          </a>
        </div>
      </div>

      <nav class="footer-links-grid" aria-label="Footer">
        <div class="footer-link-group">
          <h4 class="footer-group-title">Navigation</h4>
          <ul class="footer-links-list">
            <li><a href="/">Home</a></li>
            <li><a href="/careers">Careers</a></li>
            <!-- <li><a href="/free-resources">Resources</a></li> -->
            <li><a href="/guides">Guides</a></li>
            <li><a href="/news-updates">News</a></li>
            <li><a href="/contact-us">Contact</a></li>
          </ul>
        </div>
        <div class="footer-link-group">
          <h4 class="footer-group-title">Policies</h4>
          <ul class="footer-links-list">
            <li><a href="/legal">Legal</a></li>
            <li><a href="/terms-of-use">Terms of Use</a></li>
            <li><a href="/privacy">Privacy Policy</a></li>
            <li><a href="/cookie-policy">Cookie Policy</a></li>
          </ul>
        </div>
      </nav>

      <div class="footer-newsletter-area">
        <h4 class="footer-group-title" id="footer-newsletter-title">Stay Updated</h4>
        <p class="newsletter-text">Subscribe to get the latest relocation tips and news.</p>
        
        {#if !subscribed}
          <form 
            class="newsletter-form" 
            on:submit|preventDefault={handleSubscribe}
            aria-labelledby="footer-newsletter-title"
            transition:fade
          >
            <label for="footer-newsletter-email" class="footer-sr">Email address</label>
            <input 
              id="footer-newsletter-email"
              type="email" 
              autocomplete="email"
              placeholder="Your email address" 
              bind:value={email}
              required
              class="newsletter-input"
              aria-invalid={errorMsg ? 'true' : undefined}
              aria-describedby={errorMsg ? 'footer-newsletter-error' : undefined}
            />
            <button type="submit" class="newsletter-button" disabled={submitting} aria-busy={submitting}>
              <span>{submitting ? 'Subscribing…' : 'Subscribe'}</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </form>
          {#if errorMsg}
            <p class="newsletter-error" id="footer-newsletter-error" role="alert">{errorMsg}</p>
          {/if}
        {:else}
          <div class="subscription-success" role="status" transition:slide>
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="success-icon"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
            <span>Thanks for joining us!</span>
          </div>
        {/if}
      </div>
    </div>

    <div class="footer-destinations">
      <div class="destinations-header">
        <span class="destinations-label">Popular Destinations</span>
        <div class="destinations-line"></div>
      </div>
      <div class="destinations-grid">
        <a href="/costa-rica" class="destination-card">
          <img src="/countries/costa-rica.png" alt="" loading="lazy" decoding="async" />
          <span>Costa Rica</span>
        </a>
        <a href="/panama" class="destination-card">
          <img src="/countries/panama.png" alt="" loading="lazy" decoding="async" />
          <span>Panama</span>
        </a>
        <a href="/mexico" class="destination-card">
          <img src="/countries/mexico.png" alt="" loading="lazy" decoding="async" />
          <span>Mexico</span>
        </a>
        <a href="/portugal" class="destination-card">
          <img src="/countries/portugal.png" alt="" loading="lazy" decoding="async" />
          <span>Portugal</span>
        </a>
        <a href="/spain" class="destination-card">
          <img src="/countries/spain.png" alt="" loading="lazy" decoding="async" />
          <span>Spain</span>
        </a>
        <a href="/colombia" class="destination-card">
          <img src="/countries/colombia.png" alt="" loading="lazy" decoding="async" />
          <span>Colombia</span>
        </a>
      </div>
    </div>

    <div class="footer-bottom">
      <div class="copyright-text">
        &copy; {year} IRP - International Relocation Partners. All rights reserved.
      </div>
      <div class="footer-location">
        Heredia, Costa Rica
      </div>
      <div class="footer-credits">
        Built by <a href="https://aiexecutions.com/" target="_blank" rel="noopener">AI Executions</a> 
        at <a href="https://testcoder.netlify.app/" target="_blank" rel="noopener">Oriens Studios</a>
      </div>
    </div>
  </div>
</footer>
