<script lang="ts">
  import { fade, slide } from 'svelte/transition';
  
  let email = "";
  let subscribed = false;
  
  async function handleSubscribe() {
    if (!email) return;
    // Implementation for subscription can be added here
    console.log("Subscribing email:", email);
    subscribed = true;
    setTimeout(() => {
      subscribed = false;
      email = "";
    }, 3000);
  }
</script>

<style lang="scss" src="./Footer.scss"></style>

<footer class="footer-section">
  <div class="footer-container">
    <div class="footer-top">
      <div class="footer-brand-area">
        <a href="/" class="footer-logo-link">
          <img src="/IRP-LOGO.jpg" alt="IRP Logo" class="footer-logo" />
        </a>
        <p class="footer-description">
          Simplifying your international relocation journey with expert guidance and seamless logistics.
        </p>
        <div class="footer-social-links">
          <a href="https://www.facebook.com/pabloeariasc" class="social-icon-link" aria-label="Facebook">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"></path></svg>
          </a>
          <a href="https://www.instagram.com/pabloearias" class="social-icon-link" aria-label="Instagram">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
          </a>
          <a href="https://www.linkedin.com/in/pabloearias/" class="social-icon-link" aria-label="LinkedIn">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
          </a>
        </div>
      </div>

      <div class="footer-links-grid">
        <div class="footer-link-group">
          <h4 class="footer-group-title">Navigation</h4>
          <ul class="footer-links-list">
            <li><a href="/">Home</a></li>
            <li><a href="/careers">Careers</a></li>
            <li><a href="/free-resources">Free Resources</a></li>
            <li><a href="/news-updates">News</a></li>
            <li><a href="/contact-us">Contact Us</a></li>
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
      </div>

      <div class="footer-newsletter-area">
        <h4 class="footer-group-title">Stay Updated</h4>
        <p class="newsletter-text">Subscribe to get the latest relocation tips and news.</p>
        
        {#if !subscribed}
          <form 
            class="newsletter-form" 
            on:submit|preventDefault={handleSubscribe}
            transition:fade
          >
            <input 
              type="email" 
              placeholder="Your email address" 
              bind:value={email}
              required
              class="newsletter-input"
            />
            <button type="submit" class="newsletter-button">
              <span>Subscribe</span>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </form>
        {:else}
          <div class="subscription-success" transition:slide>
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
          <img src="/countries/costa-rica.png" alt="Costa Rica" />
          <span>Costa Rica</span>
        </a>
        <a href="/panama" class="destination-card">
          <img src="/countries/panama.png" alt="Panama" />
          <span>Panama</span>
        </a>
        <a href="/mexico" class="destination-card">
          <img src="/countries/mexico.png" alt="Mexico" />
          <span>Mexico</span>
        </a>
        <a href="/portugal" class="destination-card">
          <img src="/countries/portugal.png" alt="Portugal" />
          <span>Portugal</span>
        </a>
        <a href="/spain" class="destination-card">
          <img src="/countries/spain.png" alt="Spain" />
          <span>Spain</span>
        </a>
        <a href="/colombia" class="destination-card">
          <img src="/countries/colombia.png" alt="Colombia" />
          <span>Colombia</span>
        </a>
      </div>
    </div>

    <div class="footer-bottom">
      <div class="copyright-text">
        &copy; 2025 IRP - International Relocation Partners. All rights reserved.
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
