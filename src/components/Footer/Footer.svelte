<script lang="ts">
  let mobileDestinationsOpen = false;
</script>

<style lang="scss" src="./Footer.scss"></style>

<footer class="footer-section">
  <div class="footer-inner">
    <div class="footer-row">
      <div class="footer-col">
        <h5 class="footer-heading">Navigation</h5>
        <ul class="footer-menu">
          <li><a class="footer-link" href="/">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}Home</a></li>
          <li><a class="footer-link" href="/careers">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}Careers</a></li>
          <li><a class="footer-link" href="/free-resources">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}Free Resources</a></li>
          <li><a class="footer-link" href="/news-updates">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}News</a></li>
          <li><a class="footer-link" href="/contact-us">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}Contact Us</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h5 class="footer-heading">Policies Links</h5>
        <ul class="footer-menu">
          <li><a class="footer-link" href="/legal">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}Legal</a></li>
          <li><a class="footer-link" href="/terms-of-use">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}Terms of Use</a></li>
          <li><a class="footer-link" href="/earnings-disclaimer">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}Earnings Disclaimer</a></li>
          <li><a class="footer-link" href="/terms-of-sale">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}Terms of Sale</a></li>
          <li><a class="footer-link" href="/privacy">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}Privacy Policy</a></li>
          <li><a class="footer-link" href="/cookie-policy">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}Cookie Policy</a></li>
        </ul>
      </div>
      <div class="footer-col">
        <h5 class="footer-heading">Social</h5>
        <div class="footer-social">
          <a class="footer-social-link" href="https://www.facebook.com/IntRelocationPartner/" target="_blank" rel="noopener">
            {#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}
            <img class="footer-social-img" src="/icons/facebook.png" alt="Facebook" width="40" height="40" />
            Facebook
          </a>
          <a class="footer-social-link" href="https://www.instagram.com/int.relocation.partner" target="_blank" rel="noopener">
            {#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}
            <img class="footer-social-img" src="/icons/instagram.png" alt="Instagram" width="40" height="40" />
            Instagram
          </a>
          <a class="footer-social-link" href="https://www.linkedin.com/company/internationalrelocationpartner" target="_blank" rel="noopener">
            {#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}
            <img class="footer-social-img" src="/icons/linkedin.png" alt="Linkedin" width="40" height="40" />
            Linkedin
          </a>
          <a class="footer-social-link" href="https://g.page/internationalrelocationpartner?we" target="_blank" rel="noopener">
            {#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}
            <img class="footer-social-img" src="/icons/google.png" alt="Google" width="40" height="40" />
            Google
          </a>
          <a class="footer-social-link" href="https://www.youtube.com/channel/UCDXEdyNL5XnFg72n9XjOPvw" target="_blank" rel="noopener">
            {#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}
            <img class="footer-social-img" src="/icons/youtube.png" alt="Youtube" width="40" height="40" />
            Youtube
          </a>
        </div>
      </div>
    </div>
    <div class="footer-row destinations-footer-row">
      <nav class="footer-destinations-menu">
        <ul class="footer-destinations-list">
          <li><a class="footer-destination-link" href="/costa-rica">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}<img class="footer-destination-img" src="/countries/costa-rica.png" alt="Costa Rica" />Costa Rica</a></li>
          <li><a class="footer-destination-link" href="/panama">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}<img class="footer-destination-img" src="/countries/panama.png" alt="Panama" />Panama</a></li>
          <li><a class="footer-destination-link" href="/mexico">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}<img class="footer-destination-img" src="/countries/mexico.png" alt="Mexico" />Mexico</a></li>
          <li><a class="footer-destination-link" href="/portugal">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}<img class="footer-destination-img" src="/countries/portugal.png" alt="Portugal" />Portugal</a></li>
          <li><a class="footer-destination-link" href="/spain">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}<img class="footer-destination-img" src="/countries/spain.png" alt="Spain" />Spain</a></li>
          <li><a class="footer-destination-link" href="/colombia">{#each Array(8) as _,i}<span class="footer-shadow{i+1}"></span>{/each}<img class="footer-destination-img" src="/countries/colombia.png" alt="Colombia" />Colombia</a></li>
        </ul>
      </nav>
    </div>
    <div class="footer-row copyright-row">
      <p class="footer-copyright">
        Copyright © 2025 Heredia, Costa Rica | Built by
        <a class="footer-copyright-link" href="https://aiexecutions.com/" target="_blank" rel="noopener">AI Executions</a> at <a class="footer-copyright-link" href="https://testcoder.netlify.app/" target="_blank" rel="noopener">Oriens Studios</a>
      </p>
    </div>
  </div>
</footer>
