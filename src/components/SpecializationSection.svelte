<script lang="ts">
  // No props for now, but could be made data-driven if needed
</script>

<section class="specialization">
  <div class="row">
    <div class="col col-content">
      <div class="card">
        <h4>We specialize in serving:</h4>
        <ul>
          <li>Expats Retirees</li>
          <li>Digital nomads</li>
          <li>Private individuals looking to move abroad</li>
          <li>Returning citizens to their origin country</li>
        </ul>
      </div>
      <div class="card">
        <h4>Schedule your free 10 minutes consultation call</h4>
        <p>Every relocation process is different, rules and regulations may vary depending on your immigration status, shipment description, location, and several factors. This quick call can help us review these rules and give you the proper advice depending on your specific case.</p>
      </div>
    </div>
    <div class="col col-locations">
      <div class="card">
        <h4>Moving We Offered:</h4>
        <ul>
          <li><a href="/costa-rica/">Costa Rica</a></li>
          <li><a href="/panama/">Panama</a></li>
          <li><a href="/mexico/">Mexico</a></li>
          <li><a href="/portugal/">Portugal</a></li>
          <li><a href="/spain/">Spain</a></li>
          <li><a href="/colombia/">Colombia</a></li>
        </ul>
      </div>
    </div>
  </div>
</section>

<style lang="scss">
.specialization {
  background: #fff;
  padding: 2.5rem 0;
  .card {
    background: #f4faff;
    border-radius: 8px;
    padding: 1.5rem 1.2rem;
    margin-bottom: 1.2rem;
    box-shadow: 0 1px 4px rgba(30,144,255,0.05);
    h4 {
      color: var(--color-highlight-1);
      margin-bottom: 0.7rem;
      font-size: 1.2rem;
      font-weight: 700;
    }
    ul {
      margin: 0 0 0.7rem 1.2rem;
      li {
        font-size: 1.05rem;
        margin-bottom: 0.2rem;
      }
    }
  }
}
@media (max-width: 1200px) {
  .row {
    flex-direction: column;
    padding: 0 1rem;
  }
  .col, .col-content, .col-locations {
    flex: 1 1 100%;
    min-width: 0;
    text-align: center;
  }
}
@media (max-width: 700px) {
  .specialization {
    padding: 1.2rem 0;
  }
  .card {
    padding: 0.8rem;
  }
}
</style>
