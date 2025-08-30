<script lang="ts">
  // No props for now, but could be made data-driven if needed
  import CTAButton from "./Header/CTAButton.svelte";
</script>

<section class="contact-section">
  <div class="row">
    <div class="col col-contact">
      <h2>Contact Us</h2>
      <p>Moving abroad is a unique experience for everybody, with different motives, family sizes, and needs.  Learning about you and your specific needs, allows us to give you useful advice and relevant information for you to plan your relocation project. </p>
      <div class="button-row">
        <CTAButton label="Schedule Consultation" href="/consultation/" variant="primary" />
        <CTAButton label="Download Relocation Checklist" href="/free-resources/" variant="secondary" target="_blank" />
      </div>
    </div>
    <div class="col col-location">
      <h2>Location</h2>
      <div class="location-list">
        <div class="location-item">
          <h5>United States</h5>
          <div class="location-details">
            <img src="/map.png" alt="US Map" />
            <div>
              <h5>International Relocation Partner LLC</h5>
              <p>175 SW 7th Street STE 1517 - 559<br>
              MIAMI FLORIDA 33130</p>
              <p>Please email unitedstates@internationalrelocationpartner.com or schedule a consultation call with a United States expert.</p>
            </div>
          </div>
        </div>
        <div class="location-item">
          <h5>Mexico</h5>
          <div class="location-details">
            <img src="/map.png" alt="Mexico Map" />
            <div>
              <h5>International Relocation Partner</h5>
              <p>Edif New York Life<br>Paseo de la Reforma 342, Piso 26<br>Col. Juárez, Del. Cuauhtémoc<br>Ciudad de México, C.P. 06600</p>
              <p>Please email <a href="mailto:mexico@internationalrelocationpartner.com">mexico@internationalrelocationpartner.com</a> or schedule a consultation call with a Mexico expert.</p>
            </div>
          </div>
        </div>
        <div class="location-item">
          <h5>Spain</h5>
          <div class="location-details">
            <img src="/map.png" alt="Spain Map" />
            <div>
              <p>Calle Bolivia 17, 11ºB, 28016, Madrid, Spain.</p>
            </div>
          </div>
        </div>
        <div class="location-item">
          <h5>Costa Rica</h5>
          <div class="location-details">
            <img src="/map.png" alt="Costa Rica Map" />
            <div>
              <h5>Alajuela</h5>
              <p>700 metros al este del cruce del aeropuerto Juan SantaMaria, Carretera a Heredia, WF Office Building, Alajuela Province, Río Segundo, 20109</p>
              <p>Please email costarica@internationalrelocationpartner.com or schedule a consultation call with a Costa Rica expert.</p>
            </div>
          </div>
          <div class="location-details">
            <img src="/map.png" alt="Costa Rica Map" />
            <div>
              <h5>Guanacaste</h5>
              <p>A 1.5kms norte de la plaza de futbol de Villarreal. Camino a Huacas, 500 metros después de la gasolinera. Tamarindo, Guanacaste</p>
              <p>Please email costarica@internationalrelocationpartner.com or schedule a consultation call with a Costa Rica expert.</p>
            </div>
          </div>
        </div>
        <div class="location-item">
          <h5>Panamá</h5>
          <div class="location-details">
            <img src="/map.png" alt="Panama Map" />
            <div>
              <h5>Panama City</h5>
              <p>PH Grupo Pistar, Vía Simón Bolivar Oficina 239</p>
              <p>Please email panama@internationalrelocationpartner.com or schedule a consultation call with a Panama expert.</p>
            </div>
          </div>
          <div class="location-details">
            <img src="/map.png" alt="Panama Map" />
            <div>
              <h5>Boquete</h5>
              <p>Coming soom to Boquete, Chiriqui, Panama</p>
              <p>Please email panama@internationalrelocationpartner.com or schedule a consultation call with a Panama expert.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<style lang="scss">
.contact-section {
  background: #fff;
  padding: 2.5rem 0;
  .col-contact {
    flex: 1 1 50%;
    h2 {
      color: var(--color-highlight-1);
      font-size: 2rem;
      font-weight: 800;
      margin-bottom: 1.2rem;
    }
    p {
      font-size: 1.08rem;
      color: #444;
      margin-bottom: 1.2rem;
    }
  }
  .col-location {
    flex: 1 1 50%;
    h2 {
      color: var(--color-highlight-1);
      font-size: 2rem;
      font-weight: 800;
      margin-bottom: 1.2rem;
    }
    .location-list {
      display: flex;
      flex-direction: column;
      gap: 1.2rem;
      .location-item {
        background: #f4faff;
        border-radius: 8px;
        box-shadow: 0 1px 4px rgba(30,144,255,0.05);
        padding: 1rem;
        h5 {
          color: var(--color-highlight-2);
          font-size: 1.1rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        .location-details {
          display: flex;
          align-items: flex-start;
          gap: 1rem;
          img {
            width: 48px;
            height: 48px;
            object-fit: contain;
            border-radius: 6px;
          }
          div {
            flex: 1 1 0;
            p {
              font-size: 1rem;
              color: #444;
              margin-bottom: 0.3rem;
            }
          }
        }
      }
    }
  }
}
.button-row {
  display: flex;
  gap: 1rem;
  margin-top: 1.2rem;
  flex-wrap: wrap;
}
.cta-btn, .primary-btn {
  background: var(--color-highlight-1);
  color: #fff;
  display: inline-block;
  border-radius: 4px;
  padding: 0.5rem 1.2rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  color: #fff;
  cursor: pointer;
}
.primary-btn {
  background: var(--color-highlight-1);
  &:hover {
    background: var(--color-highlight-2);
  }
}
@media (max-width: 1200px) {
  .row {
    flex-direction: column;
    padding: 0 1rem;
  }
  .col, .col-contact, .col-location {
    flex: 1 1 100%;
    min-width: 0;
    text-align: center;
  }
}
@media (max-width: 700px) {
  .contact-section {
    padding: 1.2rem 0;
  }
  .location-item {
    padding: 0.8rem;
  }
  h2 {
    font-size: 1.3rem !important;
  }
}
</style>
