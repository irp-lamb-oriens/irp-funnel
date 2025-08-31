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
        Moving abroad is a unique experience for everybody, with different motives, family sizes, and needs.
        Learning about you and your specific needs, allows us to give you useful advice and relevant information for you to plan your relocation project.
      </p>
      <div class="contact-button-row">
        <div class="contact-btn contact-btn--primary">
          <CTAButton label="Schedule Consultation" href="/consultation/" variant="primary" />
        </div>
        <div class="contact-btn contact-btn--secondary">
          <CTAButton label="Download Relocation Checklist" href="/free-resources/" variant="secondary-inverted" target="_blank" />
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

.location-card {
  border-radius: 8px;
  /* Removed box-shadow, background, and padding for transparent look */
  background: transparent;
  padding: 0;
  color: #222;
  color: #222;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  cursor: pointer;
  outline: none;
  border-bottom: 1px solid rgba(120,120,120,0.18);
  /* Explicit initial states for all transition properties */
  transition:
    box-shadow 0.18s cubic-bezier(0.4,0,0.2,1),
    background 0.18s cubic-bezier(0.4,0,0.2,1),
    transform 0.22s cubic-bezier(0.4,0,0.2,1);
  box-shadow: 0 1px 4px rgba(30,144,255,0.05);
  background: rgba(244,250,255,0.85);
  transform: none;
  z-index: 1;

  .location-card__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    .location-card__country {
      margin: 0;
      color: var(--color-highlight-2, #1e90ff);
      font-size: 1.1rem;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
    .location-card__arrow {
      font-size: 1.2rem;
      margin-left: 0.5rem;
      color: #888;
      /* Explicit initial state for transform and color */
      transition: transform 0.18s, color 0.18s;
      transform: none;
    }
  }

  .location-card__content {
    max-height: 0;
    overflow: hidden;
    opacity: 0;
    margin-top: 0;
    /* Explicit initial states for all transition properties */
    transition:
      opacity 0.18s,
      max-height 0.22s cubic-bezier(0.4,0,0.2,1),
      margin-top 0.18s;
    /* initial: opacity: 0; max-height: 0; margin-top: 0; */
    &--open {
      opacity: 1;
      max-height: 800px;
      margin-top: 0.7rem;
      transition:
        max-height 0.22s cubic-bezier(0.4,0,0.2,1),
        opacity 0.18s,
        margin-top 0.18s;
    }
  }

  .location-card__detail {
    display: flex;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 0.7rem;
    .location-card__img {
      width: 48px;
      height: 48px;
      object-fit: contain;
      border-radius: 6px;
      box-shadow: 0 1px 4px rgba(30,144,255,0.08);
    }
    .location-card__info {
      flex: 1 1 0;
      .location-card__label {
        color: var(--color-highlight-2, #1e90ff);
        font-size: 1.05rem;
        font-weight: 700;
        margin-bottom: 0.2rem;
      }
      .location-card__address {
        font-size: 1rem;
        color: #444;
        margin-bottom: 0.3rem;
      }
      .location-card__extra {
        font-size: 0.98rem;
        color: #555;
        margin-bottom: 0.2rem;
      }
      a {
        color: var(--color-highlight-2, #1e90ff);
        text-decoration: underline;
      }
    }
  }

  // Interactive transitions
  &:hover:not(.location-card--open),
  &:focus:not(.location-card--open) {
    box-shadow: 0 2px 12px rgba(30,144,255,0.15);
    background: rgba(244,250,255,1);
    transform: translateY(-2px) scale(1.01);
    z-index: 2;
    .location-card__arrow {
      transform: translateY(-2px) scale(1.2) rotate(-180deg);
    }
  }
  &.location-card--open {
    /* No extra box-shadow or background for open state */
    background: transparent;
    transform: translateY(2px) scale(0.99);
    z-index: 3;
    .location-card__arrow {
      transform: translateY(2px) scale(1.2) rotate(0deg);
      color: var(--color-highlight-2, #1e90ff);
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
    padding: 1.2rem 0;
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
