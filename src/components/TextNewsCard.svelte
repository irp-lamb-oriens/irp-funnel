<script lang="ts">
  export let title: string;
  export let excerpt: string;
  export let link: string;
  export let readMoreText: string = "READ MORE";
</script>

<a href={link}>
    <article class="news-item text-only">
      <div class="news-item-card">
        <span class="news-item-link">
          <div class="news-item-texts">
            <h5 class="news-item-title">{title}</h5>
            <p class="news-item-desc">{excerpt}</p>
            <span class="more-link">{readMoreText}</span>
          </div>
        </span>
      </div>
    </article>
</a>

<style lang="scss">
.news-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  background: #fff;
  box-shadow: 0 4px 24px rgba(30,144,255,0.10);
  border-radius: 16px;
  padding: 1.3rem 1.1rem 1.1rem 1.1rem;
  min-width: 0;
  max-width: 100%;
  position: relative;
  height: 100%;
  justify-content: flex-end;
  transition: transform 0.3s cubic-bezier(.22,0,.36,1), box-shadow 0.3s cubic-bezier(.22,0,.36,1);

  &:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 32px rgba(30,144,255,0.16);
  }
}

.news-item-link {
  display: block;
  width: 100%;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.news-item-title {
  font-size: 1.18rem;
  font-weight: 800;
  color: var(--color-highlight-1);
  margin-bottom: 0.3rem;
  line-height: 1.25;
  max-height: 2.7em;
  overflow: hidden;
  text-align: left;
}

.news-item-desc {
  font-size: 1.01rem;
  color: #7a7a7a;
  margin-bottom: 0.4rem;
  line-height: 1.5;
  max-height: 6.2em;
  overflow: hidden;
  text-align: left;
  opacity: 0.92;
}

.more-link {
  color: var(--color-highlight-1);
  font-weight: 700;
  text-decoration: none;
  font-size: 0.93rem;
  letter-spacing: 0.04em;
  margin-top: 0.2em;
  display: inline-block;
  align-self: flex-start;
  text-align: left;
  opacity: 0.88;
  cursor: pointer;
}
</style>
