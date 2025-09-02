<script lang="ts">
  import CountryButton from './CountryButton.svelte';
  // No props for now, but could be made data-driven if needed
</script>

<section class="specialization">
  <div class="specialization-bg"></div>
  <div class="row">
    <div class="col col-content">
      <h2 class="specialization-title">We specialize in serving:</h2>
      <ul class="specialization-list specialization-list--audience">
        <li class="specialization-list-item specialization-list-item--audience">Expats Retirees</li>
        <li class="specialization-list-item specialization-list-item--audience">Digital nomads</li>
        <li class="specialization-list-item specialization-list-item--audience">Private individuals looking to move abroad</li>
        <li class="specialization-list-item specialization-list-item--audience">Returning citizens to their origin country</li>
      </ul>
      <h3 class="specialization-subtitle">Schedule your free 10 minutes consultation call</h3>
      <p class="specialization-description">Every relocation process is different, rules and regulations may vary depending on your immigration status, shipment description, location, and several factors. This quick call can help us review these rules and give you the proper advice depending on your specific case.</p>
    </div>
    <div class="col col-locations">
      <h2 class="specialization-title">Moving We Offered:</h2>
      <ul class="specialization-list specialization-list--countries">
        <li class="specialization-list-item specialization-list-item--country"><CountryButton text="Costa Rica" url="/costa-rica/" /></li>
        <li class="specialization-list-item specialization-list-item--country"><CountryButton text="Panama" url="/panama/" /></li>
        <li class="specialization-list-item specialization-list-item--country"><CountryButton text="Mexico" url="/mexico/" /></li>
        <li class="specialization-list-item specialization-list-item--country"><CountryButton text="Portugal" url="/portugal/" /></li>
        <li class="specialization-list-item specialization-list-item--country"><CountryButton text="Spain" url="/spain/" /></li>
        <li class="specialization-list-item specialization-list-item--country"><CountryButton text="Colombia" url="/colombia/" /></li>
      </ul>
    </div>
  </div>
</section>

<style lang="scss">
.specialization {
  position: relative;
  background: transparent;
  color: #fff;
  padding: 3.5rem 0 3rem 0;
  min-height: 100%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  font-family: 'Inter', 'Helvetica Neue', Arial, sans-serif;
  letter-spacing: 0.01em;
  text-align: left;
  z-index: 1;
  overflow: hidden;
}
.specialization-bg {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 0;
  background-image: url('https://images.pexels.com/photos/210243/pexels-photo-210243.jpeg?auto=compress&w=1200&q=80');
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  opacity: 1;
}
.specialization-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  background: rgba(10, 10, 20, 0.82);
  pointer-events: none;
  z-index: 1;
}
.specialization > *:not(.specialization-bg) {
  position: relative;
  z-index: 2;
}
.specialization {
  // ...existing styles...
  .row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3.5rem;
    max-width: 1100px;
    margin: 0 auto;
    padding: 0 2rem;
    align-items: flex-start;
    justify-items: start;
    text-align: left;
    @media (max-width: 900px) {
      grid-template-columns: 1fr;
      gap: 2.2rem;
      padding: 0 1rem;
    }
  }
  .col {
    width: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    align-items: flex-start;
    gap: 2.2rem;
    text-align: left;
  }
}

.specialization-title {
  font-size: clamp(1.3rem, 2.5vw + 1rem, 2.2rem);
  font-weight: 900;
  color: #fff;
  margin-bottom: 0.7rem;
  line-height: 1.1;
  letter-spacing: 0.01em;
  text-shadow: 0 2px 8px #000, 0 1px 0 #222;
  border-left: 6px solid var(--color-highlight-2);
  padding-left: 1rem;
  margin-top: 0;
  margin-bottom: 1.2rem;
  text-align: left;
}

.specialization-subtitle {
  font-size: clamp(1.05rem, 1.2vw + 0.8rem, 1.4rem);
  font-weight: 700;
  color: #e53935;
  margin-bottom: 0.5rem;
  margin-top: 1.2rem;
  letter-spacing: 0.01em;
  text-align: left;
}

.specialization-list {
  margin: 0 0 1.2rem 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-align: left;
}

.specialization-list--countries {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0;
  padding: 0;
  margin: 0 0 1.2rem 0;
  justify-items: stretch;
  align-items: stretch;
  text-align: left;
  width: 100%;
}
@media (max-width: 700px) {
  .specialization-list--countries {
    grid-template-columns: 1fr;
    gap: 0.5rem 0;
  }
}

.specialization-list-item {
  position: relative;
  font-size: clamp(1rem, 1vw + 0.8rem, 1.18rem);
  margin-bottom: 0.1rem;
  padding-left: 2.3em;
  line-height: 1.6;
  color: #fff;
  font-weight: 500;
  transition: color 0.18s;
  text-align: left;
  &:hover {
    color: var(--color-highlight-2);
  }
  a.specialization-link {
    color: #fff;
    text-decoration: underline;
    font-weight: 600;
    position: relative;
    z-index: 3;
    transition: color 0.18s;
    text-align: left;
    &:hover {
      color: var(--color-highlight-2);
      text-decoration: underline wavy 1.5px;
    }
  }
}

/* Audience list: solid red circle with white checkmark */
.specialization-list-item--audience {
  &::before {
    content: "✔";
    font-size: 1em;
    font-weight: 900;
    color: #fff;
    background: var(--color-highlight-2);
    border-radius: 50%;
    width: 1.3em;
    height: 1.3em;
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    left: 0.3em;
    top: 50%;
    transform: translateY(-50%);
    box-shadow: 0 1px 8px #e5393555;
    border: 2px solid #fff;
    z-index: 1;
  }
}

/* Country list: no bullets */
.specialization-list-item--country {
  padding-left: 0;
  margin: 0;
  &::before, &::after {
    display: none !important;
    content: none !important;
  }
  a.specialization-link {
    display: block;
    width: 100%;
    height: 100%;
    padding: 1.1em 0.5em;
    background: transparent;
    border-radius: 0;
    color: #fff;
    text-align: center;
    font-weight: 700;
    font-size: clamp(1rem, 1vw + 0.8rem, 1.18rem);
    letter-spacing: 0.01em;
    border: none;
    cursor: pointer;
    transition: color 0.18s;
    box-shadow: none;
    outline: none;
    text-decoration: none;
    position: relative;
    overflow: hidden;
    z-index: 1;
  }
  a.specialization-link::before {
    content: '';
    position: absolute;
    left: 0; top: 0; bottom: 0;
    width: 0;
    height: 100%;
    background: var(--color-highlight-2);
    z-index: -1;
    transition: width 0.32s cubic-bezier(.4,1.6,.6,.9);
    border-radius: 0;
    box-shadow:
      0 0 0 0px rgba(229,57,53,0.18),
      0 0 0 8px rgba(229,57,53,0.12),
      0 0 0 16px rgba(229,57,53,0.08),
      0 0 0 24px rgba(229,57,53,0.05);
  }
  a.specialization-link:hover::before,
  a.specialization-link:focus::before {
    transition: width 1s ease-in-out;
    width: 100%;
  }
  a.specialization-link:hover,
  a.specialization-link:focus {
    color: #fff;
    text-decoration: none;
  }
  a.specialization-link span {
    position: relative;
    z-index: 1;
  }
}

.specialization-description {
  font-size: clamp(0.95rem, 0.7vw + 0.8rem, 1.12rem);
  color: #fff;
  margin-bottom: 0.7rem;
  line-height: 1.6;
  max-width: 38em;
  opacity: 0.92;
  text-align: left;
}

.specialization-link {
  color: #fff;
  text-decoration: underline;
  transition: color 0.2s;
  font-weight: 600;
  text-align: left;
}
.specialization-link:hover {
  color: var(--color-highlight-2);
  text-decoration: underline wavy 1.5px;
}

@media (max-width: 1200px) {
  .specialization .row {
    grid-template-columns: 1fr;
    gap: 2.2rem;
    padding: 2rem;
  }
  .specialization .col,
  .specialization .col-content,
  .specialization .col-locations {
    flex: 1 1 100%;
    min-width: 0;
    text-align: left;
    align-items: flex-start;
  }
}
@media (max-width: 700px) {
  .specialization {
    padding: 2.2rem 0;
  }
  .specialization .row {
    gap: 1.2rem;
  }
  .specialization-title {
    font-size: clamp(1.1rem, 2vw + 0.7rem, 1.4rem);
    padding-left: 0.5rem;
    border-left-width: 4px;
  }
  .specialization-list-item {
    font-size: clamp(0.9rem, 1vw + 0.7rem, 1rem);
    padding-left: 1.5em;
  }
}
</style>
