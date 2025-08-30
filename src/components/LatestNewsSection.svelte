<script lang="ts">
  // No props for now, but could be made data-driven if needed
</script>

<section class="latest-news">
  <div class="row">
    <div class="col">
      <h2>Latest News</h2>
      <div class="news-grid">
        <article class="news-item">
          <a href="/what-ive-learned-from-helping-people-move-abroad/">
            <img src="https://www.internationalrelocationpartner.com/wp-content/uploads/2025/02/What-Ive-Learned-From-Helping-People-Move-Abroad--400x250.jpg" alt="What I’ve Learned From Helping People Move Abroad" width="400" height="250" />
            <h5>What I’ve Learned From Helping People Move Abroad</h5>
          </a>
          <p>Moving abroad is an exciting yet complex process that involves both logistical and emotional challenges. From navigating bureaucracy and cultural adjustments to settling into a...</p>
          <a href="/what-ive-learned-from-helping-people-move-abroad/" class="more-link">read more</a>
        </article>
        <article class="news-item">
          <a href="/how-to-import-a-car-to-panama/">
            <img src="https://www.internationalrelocationpartner.com/wp-content/uploads/2025/02/How-ti-Import-a-Car-to-Panama-400x250.jpg" alt="How to Import a Car to Panama" width="400" height="250" />
            <h5>How to Import a Car to Panama</h5>
          </a>
          <p>Moving to Panama and considering bringing your car with you? While importing a vehicle can be a great way to maintain familiarity, it requires careful planning and adherence to...</p>
          <a href="/how-to-import-a-car-to-panama/" class="more-link">read more</a>
        </article>
        <article class="news-item">
          <a href="/documents-you-need-to-move-to-spain/">
            <img src="https://www.internationalrelocationpartner.com/wp-content/uploads/2025/02/Docuents-You-Need-to-Move-to-Spain-400x250.jpg" alt="Documents You Need To Move To Spain" width="400" height="250" />
            <h5>Documents You Need To Move To Spain</h5>
          </a>
          <p>Planning your move to Spain is an exciting time filled with new opportunities and experiences, but it also comes with a fair share of paperwork. Whether you’re relocating for...</p>
          <a href="/documents-you-need-to-move-to-spain/" class="more-link">read more</a>
        </article>
      </div>
      <div class="button-row">
        <a class="secondary-btn" href="/news-updates/">View All Blog</a>
      </div>
    </div>
  </div>
</section>

<style lang="scss">
.latest-news {
  background: #fff;
  padding: 2.5rem 0;
  h2 {
    color: var(--color-highlight-1);
    font-size: 2rem;
    font-weight: 800;
    margin-bottom: 1.2rem;
  }
  .news-grid {
    display: flex;
    gap: 2rem;
    flex-wrap: wrap;
    margin-bottom: 1.5rem;
    .news-item {
      background: #f4faff;
      border-radius: 8px;
      box-shadow: 0 1px 4px rgba(30,144,255,0.05);
      padding: 1rem;
      flex: 1 1 30%;
      min-width: 260px;
      max-width: 400px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      img {
        border-radius: 6px;
        width: 100%;
        height: auto;
        margin-bottom: 0.7rem;
      }
      h5 {
        font-size: 1.1rem;
        font-weight: 700;
        color: var(--color-highlight-1);
        margin-bottom: 0.5rem;
      }
      p {
        font-size: 1rem;
        color: #444;
        margin-bottom: 0.5rem;
      }
      .more-link {
        color: var(--color-highlight-1);
        font-weight: 600;
        text-decoration: underline;
        font-size: 0.98rem;
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
.secondary-btn {
  background: #fff;
  color: var(--color-highlight-1);
  border: 2px solid var(--color-highlight-1);
  display: inline-block;
  border-radius: 4px;
  padding: 0.5rem 1.2rem;
  font-weight: 600;
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
  cursor: pointer;
  &:hover {
    background: #e6f2ff;
  }
}
@media (max-width: 1200px) {
  .row {
    flex-direction: column;
    padding: 0 1rem;
  }
  .col {
    flex: 1 1 100%;
    min-width: 0;
    text-align: center;
  }
  .news-grid {
    flex-direction: column;
    align-items: center;
  }
}
@media (max-width: 700px) {
  .latest-news {
    padding: 1.2rem 0;
  }
  .news-item {
    padding: 0.8rem;
  }
  h2 {
    font-size: 1.3rem !important;
  }
}
</style>
