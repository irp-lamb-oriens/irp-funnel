<script lang="ts">
	export let whatsappUrl: string;
</script>

<section class="final-cta-section">
  <div class="cta-container">
    <h2 class="section-title">Your All-Access Riviera Maya Scouting Trip</h2>
    <p class="section-subtitle">
      Everything You Need to Know: Dates, Itinerary & Logistics. Don’t miss this chance to explore your new life in Mexico with expert guidance.
    </p>

    <div class="details-grid">
      <!-- Card 1: Essential Details -->
      <div class="detail-card">
        <h3 class="card-title">Essential Details</h3>
        <ul class="card-list">
          <li class="list-item"><strong>Duration:</strong> 5 days, 5 cities</li>
          <li class="list-item"><strong>Dates:</strong> October 27th - 31st</li>
          <li class="list-item"><strong>Arrival:</strong> Arrive the Sunday before Day 1</li>
          <li class="list-item"><strong>Base Hub:</strong> All tours depart from Playa del Carmen</li>
        </ul>
      </div>

      <!-- Card 2: Daily Outline -->
      <div class="detail-card">
        <h3 class="card-title">Daily Outline</h3>
        <ul class="card-list">
          <li class="list-item"><strong>Day 1:</strong> Playa del Carmen Welcome & Seminar</li>
          <li class="list-item"><strong>Day 2:</strong> Playacar & Puerto Aventuras Tour</li>
          <li class="list-item"><strong>Day 3:</strong> Tulum & Akumal Adventure</li>
          <li class="list-item"><strong>Day 4:</strong> Cozumel Catamaran & Investment Talk</li>
          <li class="list-item"><strong>Day 5:</strong> Cancún Hotel Zone & Market Tour</li>
        </ul>
      </div>

      <!-- Card 3: Travel & Logistics -->
      <div class="detail-card">
        <h3 class="card-title">Travel & Logistics</h3>
        <ul class="card-list">
          <li class="list-item"><strong>Airports:</strong> Cancún (CUN), Tulum (TQO), Cozumel</li>
          <li class="list-item"><strong>Transfers:</strong> Pre-book via our coordinator</li>
          <li class="list-item"><strong>Hosts:</strong> Szylvia Galambosi & Pablo</li>
          <li class="list-item"><strong>Format:</strong> Learn-first scouting with mini-vacation activities</li>
          <li class="list-item"><strong>Optional Add-on:</strong> Xcaret Festival on Oct 31</li>
        </ul>
      </div>

      <!-- Card 4: Pricing & Booking -->
      <div class="detail-card">
        <h3 class="card-title">Pricing & Booking</h3>
        <ul class="card-list">
          <li class="list-item"><strong>Single Rate:</strong> $1,499</li>
          <li class="list-item"><strong>Couple's Rate:</strong> $2,699</li>
          <li class="list-item"><strong>Seminar Only (Oct 27):</strong> $10 Donation</li>
          <li class="list-item"><em>Join our opening seminar for networking with local expats!</em></li>
        </ul>
      </div>
    </div>

    <div class="urgency-block">
      <p class="urgency-text">
        Spaces for this exclusive scouting trip are strictly limited to ensure a personalized experience. Early registration is essential.
      </p>
      <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" class="cta-link">
        <button class="cta-button">Secure Your Spot Now</button>
      </a>
    </div>
  </div>
</section>

<style lang="scss">
  .final-cta-section {
    background: var(--color-background-secondary, #f4f7fa);
    padding: 5rem 2rem;
    font-family: var(--font-family-base, sans-serif);
    color: var(--color-text-primary, #333);
  }

  .cta-container {
    max-width: 1200px;
    margin: 0 auto;
    text-align: center;
  }

  .section-title {
    font-size: 2.5rem;
    font-weight: 700;
    color: var(--color-primary, #2c3e50);
    margin-bottom: 1rem;
  }

  .section-subtitle {
    font-size: 1.2rem;
    color: var(--color-text-secondary, #555);
    max-width: 800px;
    margin: 0 auto 3rem;
  }

  .details-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 2rem;
    margin-bottom: 3rem;
  }

  .detail-card {
    background: #ffffff;
    border-radius: 8px;
    padding: 2rem;
    text-align: left;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
    transition: transform 0.3s ease, box-shadow 0.3s ease;

  }

  .detail-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
  }

  .card-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--color-highlight-1, #e67e22);
    margin-bottom: 1.5rem;
    border-bottom: 2px solid var(--color-border, #eee);
    padding-bottom: 0.75rem;
  }

  .card-list {
    list-style: none;
    padding: 0;
    margin: 0;
  }

  .list-item {
    font-size: 1rem;
    line-height: 1.6;
    margin-bottom: 0.75rem;
    color: var(--color-text-secondary, #555);

  }

  .list-item strong {
    color: var(--color-text-primary, #333);
    font-weight: 600;
  }

  .urgency-block {
    background: var(--color-highlight-1, #e67e22);
    color: #fff;
    padding: 2rem;
    border-radius: 8px;
    max-width: 800px;
    margin: 0 auto;
  }

  .urgency-text {
    font-size: 1.2rem;
    font-weight: 500;
    margin: 0 0 1.5rem;
  }

  .cta-button {
    background: #fff;
    color: var(--color-highlight-1, #e67e22);
    border: none;
    padding: 1rem 2.5rem;
    font-size: 1.1rem;
    font-weight: 700;
    border-radius: 50px;
    cursor: pointer;
    transition: background-color 0.3s ease, color 0.3s ease;
    text-transform: uppercase;
  }

  .cta-link {
    text-decoration: none;
  }

  .cta-button:hover {
    background-color: var(--color-primary, #2c3e50);
    color: #fff;
  }

  /* Responsive Adjustments */
  @media (min-width: 768px) {
    .details-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 767px) {
    .final-cta-section {
      padding: 3rem 1rem;
    }

    .section-title {
      font-size: 2rem;
    }

    .section-subtitle {
      font-size: 1.1rem;
    }
  }
</style>
