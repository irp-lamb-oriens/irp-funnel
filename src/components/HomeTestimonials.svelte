<script lang="ts">
  import { googleReviews } from '../lib/reviews.ts';

  // Surface the first six reviews in a responsive grid; the data lives in
  // ../lib/reviews.ts so the homepage and the tour page share one source.
  const reviews = googleReviews.slice(0, 6);
</script>

<section class="home-testimonials" aria-label="Google reviews">
  <div class="home-testimonials__head">
    <h2 class="home-testimonials__title">What Our Customers Say</h2>
    <p class="home-testimonials__sub">
      Real reviews from clients who moved their lives with us.
    </p>
  </div>

  <div class="home-testimonials__grid">
    {#each reviews as review (review.link)}
      <a
        class="review-card"
        href={review.link}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Read ${review.name}'s Google review`}
      >
        <span class="review-card__stars" aria-hidden="true">★★★★★</span>
        <blockquote class="review-card__quote">{review.quote}</blockquote>
        <footer class="review-card__meta">
          <span class="review-card__name">{review.name}</span>
          <span class="review-card__route">{review.route}</span>
        </footer>
      </a>
    {/each}
  </div>
</section>

<style lang="scss">
  .home-testimonials {
    background: #fff;
    padding: 4rem 2rem;
    color: #1a1a2e;
    font-family: var(--font-paragraph, 'Jost'), system-ui, sans-serif;
  }

  .home-testimonials__head {
    max-width: 1100px;
    margin: 0 auto 2.25rem;
    text-align: center;
  }

  .home-testimonials__title {
    font-family: var(--font-title, 'Kiona Regular', serif);
    font-size: clamp(1.7rem, 3.4vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.08;
    color: var(--color-foreground, #181818);
    margin: 0 0 0.6rem;
  }

  .home-testimonials__sub {
    font-size: 1rem;
    line-height: 1.6;
    color: #64748b;
    margin: 0;
  }

  .home-testimonials__grid {
    max-width: 1100px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.25rem;
  }

  .review-card {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    padding: 1.6rem;
    border-radius: 18px;
    background: #fff;
    border: 1px solid #e8eef5;
    box-shadow: 0 18px 40px -30px rgba(15, 23, 42, 0.45);
    color: #1a1a2e;
    text-decoration: none;
    transition: border-color 0.3s, box-shadow 0.3s;
  }

  .review-card:hover {
    border-color: rgba(2, 181, 187, 0.35);
    box-shadow: 0 26px 54px -28px rgba(15, 23, 42, 0.5);
  }

  .review-card__stars {
    color: #f59e0b;
    font-size: 0.95rem;
    letter-spacing: 0.12em;
  }

  .review-card__quote {
    margin: 0;
    font-size: 0.94rem;
    line-height: 1.6;
    color: #475569;
    flex: 1;
  }

  .review-card__meta {
    display: flex;
    flex-direction: column;
    gap: 0.1rem;
    padding-top: 0.75rem;
    border-top: 1px solid #eef2f6;
  }

  .review-card__name {
    font-family: var(--font-subtitle, 'Spartan Black', sans-serif);
    font-weight: 700;
    color: #0f172a;
    font-size: 0.9rem;
  }

  .review-card__route {
    font-size: 0.8rem;
    color: #64748b;
  }

  @media (max-width: 900px) {
    .home-testimonials__grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 700px) {
    .home-testimonials {
      padding: 2.8rem 1.25rem;
    }
  }
</style>