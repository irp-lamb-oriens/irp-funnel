<script lang="ts">
  import CTAButton from "./Header/CTAButton.svelte";
  import LocationCard from "./LocationCard.svelte";

  interface LocationDetail {
    label: string;
    address: string;
    email?: string;
    emailHref?: string;
    extra?: string;
    imgAlt: string;
  }

  interface LocationCard {
    country: string;
    details: LocationDetail[];
  }

  const locations: LocationCard[] = [
    {
      country: "United States",
      details: [
        {
          label: "International Relocation Partner LLC",
          address: "175 SW 7th Street STE 1517 - 559<br>MIAMI FLORIDA 33130",
          email: "unitedstates@internationalrelocationpartner.com",
          imgAlt: "US Map",
          extra: "Please email unitedstates@internationalrelocationpartner.com or schedule a consultation call with a United States expert."
        }
      ]
    },
    {
      country: "Mexico",
      details: [
        {
          label: "International Relocation Partner",
          address: "Edif New York Life<br>Paseo de la Reforma 342, Piso 26<br>Col. Juárez, Del. Cuauhtémoc<br>Ciudad de México, C.P. 06600",
          email: "mexico@internationalrelocationpartner.com",
          imgAlt: "Mexico Map",
          emailHref: "mailto:mexico@internationalrelocationpartner.com",
          extra: "Please email <a href=\"mailto:mexico@internationalrelocationpartner.com\">mexico@internationalrelocationpartner.com</a> or schedule a consultation call with a Mexico expert."
        }
      ]
    },
    {
      country: "Spain",
      details: [
        {
          label: "",
          address: "Calle Bolivia 17, 11ºB, 28016, Madrid, Spain.",
          imgAlt: "Spain Map"
        }
      ]
    },
    {
      country: "Costa Rica",
      details: [
        {
          label: "Alajuela",
          address: "700 metros al este del cruce del aeropuerto Juan SantaMaria, Carretera a Heredia, WF Office Building, Alajuela Province, Río Segundo, 20109",
          email: "costarica@internationalrelocationpartner.com",
          imgAlt: "Costa Rica Map",
          extra: "Please email costarica@internationalrelocationpartner.com or schedule a consultation call with a Costa Rica expert."
        },
        {
          label: "Guanacaste",
          address: "A 1.5kms norte de la plaza de futbol de Villarreal. Camino a Huacas, 500 metros después de la gasolinera. Tamarindo, Guanacaste",
          email: "costarica@internationalrelocationpartner.com",
          imgAlt: "Costa Rica Map",
          extra: "Please email costarica@internationalrelocationpartner.com or schedule a consultation call with a Costa Rica expert."
        }
      ]
    },
    {
      country: "Panamá",
      details: [
        {
          label: "Panama City",
          address: "PH Grupo Pistar, Vía Simón Bolivar Oficina 239",
          email: "panama@internationalrelocationpartner.com",
          imgAlt: "Panama Map",
          extra: "Please email panama@internationalrelocationpartner.com or schedule a consultation call with a Panama expert."
        },
        {
          label: "Boquete",
          address: "Coming soom to Boquete, Chiriqui, Panama",
          email: "panama@internationalrelocationpartner.com",
          imgAlt: "Panama Map",
          extra: "Please email panama@internationalrelocationpartner.com or schedule a consultation call with a Panama expert."
        }
      ]
    }
  ];

  let openIndex: number | null = null;

  function toggleCard(idx: number) {
    openIndex = openIndex === idx ? null : idx;
  }
</script>

<section class="contact-section">
  <div class="contact-bg-overlay"></div>
  <div class="contact-row">
    <div class="contact-col contact-col--info">
      <h2 class="contact-title">Contact Us</h2>
      <p class="contact-description">
        Living abroad is a unique experience for everybody, with different motives, family sizes, and needs.
        Learning about you and your specific needs, allows us to give you useful advice and relevant information for you to plan your international project.
      </p>
      <div class="contact-button-row">
        <div class="contact-btn contact-btn--primary">
          <CTAButton trigger={true} label="Schedule Consultation" href="/consultation/" variant="primary" />
        </div>
        <div class="contact-btn contact-btn--secondary">
          <CTAButton label="Download Consulting Checklist" href="/free-resources/" variant="secondary-inverted" target="_blank" />
        </div>
      </div>
    </div>
    <div class="contact-col contact-col--locations">
      <h2 class="contact-title">Location</h2>
      <div class="location-cards-container">
        <div class="location-grid">
          {#each locations as loc, idx}
            <LocationCard
              country={loc.country}
              details={loc.details}
              open={openIndex === idx}
              onToggle={() => toggleCard(idx)}
              tabIndex={0}
            />
          {/each}
        </div>
      </div>
    </div>
  </div>
</section>

<style lang="scss">
.contact-section {
  position: relative;
  color: #fff;
  overflow: hidden;
  background-image: url('https://images.pexels.com/photos/21014/pexels-photo.jpg?w=2000');
  background-size: cover;
  background-attachment: fixed;
  background-position: center;

  .contact-bg-overlay {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    background: rgba(20, 20, 20, 0.7);
    z-index: 1;
    pointer-events: none;
  }

  .contact-row {
    position: relative;
    z-index: 2;
    display: flex;
    gap: 2rem;
    align-items: flex-start;
    justify-content: center;
  }

  .contact-col {
    flex: 1 1 50%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    padding: 2rem 1.5rem;
    backdrop-filter: blur(2px);
    width: 100%;

    &--info {
      .contact-title {
        color: #fff;
        font-size: 2rem;
        font-weight: 800;
        margin-bottom: 1.2rem;
      }
      .contact-description {
        font-size: 1.08rem;
        color: #e0e0e0;
        margin-bottom: 1.2rem;
      }
      .contact-button-row {
        display: flex;
        gap: 1rem;
        margin-top: 1.2rem;
        flex-wrap: wrap;
        z-index: 2;
        .contact-btn {
          &--primary, &--secondary {
            min-width: 180px;
            text-align: center;
          }
        }
      }
    }

    &--locations {
      .contact-title {
        color: #fff;
        font-size: 2rem;
        font-weight: 800;
        margin-bottom: 1.2rem;
      }
      .location-cards-container {
        margin-top: 0.5rem;
        margin-bottom: 0.5rem;
        .location-grid {
          display: flex;
          flex-direction: column;
          gap: 1.2rem;
          margin-top: 0;
        }
      }
    }
  }
}


/* Remove border from last card */
.location-card:last-child {
  border-bottom: none;
}

@media (max-width: 1200px) {
  .contact-row {
    flex-direction: column;
    padding: 0;
  }
  .contact-col, .contact-col--info, .contact-col--locations {
    flex: 1 1 100%;
    min-width: 0;
    text-align: center;
    align-items: center;
  }
  .location-cards-container {
    width: 100%;
  }
  .location-grid {
    flex-direction: column;
    gap: 1.2rem;
  }
}

@media (max-width: 700px) {
  .contact-section {
    padding: 2.2rem 0;
  }
  .location-cards-container {
    /* No extra padding */
  }
  .location-grid {
    flex-direction: column;
    gap: 1.2rem;
  }
  .location-card {
    padding: 0.8rem;
  }
  .contact-title {
    font-size: 1.3rem !important;
  }
}
</style>
