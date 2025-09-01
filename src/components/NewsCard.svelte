<script lang="ts">
  export let imageSrc: string;
  export let imageAlt: string;
  export let title: string;
  export let excerpt: string;
  export let link: string;
  export let readMoreText: string = "READ MORE";
</script>

<a href={link}>
    <article class="news-item">
      <div class="news-item-image-wrapper">
        <img class="news-item-image" src={imageSrc} alt={imageAlt} />
      </div>
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
// Main section styling for card only (no section or grid styles)
.news-item {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  background: transparent;
  box-shadow: none;
  border-radius: 0;
  padding: 0;
  min-width: 0;
  max-width: 100%;
  position: relative;
  height: 100%;
  justify-content: flex-end;
  .news-item-image-wrapper {
    position: relative;
    width: 100%;
    min-height: 220px;
    height: 220px;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    z-index: 1;
    background: #eaf1f7;
    border-radius: 18px;
    overflow: visible;
    transition: height 1.1s cubic-bezier(.22,0,.36,1), min-height 1.1s cubic-bezier(.22,0,.36,1);
  }
  .news-item-image {
    position: absolute;
    left: 50%;
    top: 0;
    width: 92%;
    height: 220px;
    transform: translate(-50%, -50%) scale(1);
    object-fit: cover;
    object-position: 50% 50%;
    border-radius: 18px;
    box-shadow: 0 2px 16px rgba(30,144,255,0.08);
    z-index: 1;
    transition:
      height 1.1s cubic-bezier(.22,0,.36,1),
      transform 1.1s cubic-bezier(.22,0,.36,1),
      object-position 1.1s cubic-bezier(.22,0,.36,1);
    will-change: height, transform, object-position;
  }
  .news-item-card {
    position: absolute;
    left: 50%;
    top: calc(60% + 3rem);
    transform: translate(-50%, -50%) scale(1);
    width: 78%;
    min-width: 0;
    background: #fff;
    border-radius: 16px;
    box-shadow: 0 4px 24px rgba(30,144,255,0.10);
    padding: 1.3rem 1.1rem 1.1rem 1.1rem;
    min-height: 170px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-start;
    z-index: 2;
    transition:
      box-shadow 0.7s cubic-bezier(.22,0,.36,1),
      transform 1.1s cubic-bezier(.22,0,.36,1),
      top 1.1s cubic-bezier(.22,0,.36,1);
    will-change: transform, box-shadow, top;
  }

  &:hover .news-item-image-wrapper {
    min-height: 340px;
    height: 340px;
    transition: height 1.1s cubic-bezier(.22,0,.36,1), min-height 1.1s cubic-bezier(.22,0,.36,1);
  }
  &:hover .news-item-image {
    height: 340px;
    transform: translateX(-50%) scale(1.08);
    object-position: 50% 40%;
    transition:
      height 1.1s cubic-bezier(.22,0,.36,1) 0.04s,
      transform 1.1s cubic-bezier(.22,0,.36,1) 0.04s,
      object-position 1.1s cubic-bezier(.22,0,.36,1) 0.04s;
  }
  &:hover .news-item-card {
    top: calc(50% + 3rem);
    transform: translate(-50%, -50%) scale(1.04);
    box-shadow: 0 8px 32px rgba(30,144,255,0.16);
    transition:
      top 1.1s cubic-bezier(.22,0,.36,1),
      transform 1.1s cubic-bezier(.22,0,.36,1) 0.09s,
      box-shadow 1.1s cubic-bezier(.22,0,.36,1) 0.09s;
  }
  .news-item-image-wrapper {
    transition: height 1.1s cubic-bezier(.22,0,.36,1) 0.09s, min-height 1.1s cubic-bezier(.22,0,.36,1) 0.09s;
  }
  .news-item-image {
    transition:
      height 1.1s cubic-bezier(.22,0,.36,1) 0.09s,
      transform 1.1s cubic-bezier(.22,0,.36,1) 0.09s,
      object-position 1.1s cubic-bezier(.22,0,.36,1) 0.09s;
  }
  .news-item-card {
    transition:
      transform 1.1s cubic-bezier(.22,0,.36,1) 0.04s,
      box-shadow 1.1s cubic-bezier(.22,0,.36,1) 0.04s,
      top 1s;
  }
}

.news-item-link {
  display: block;
  width: 100%;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}
.news-item-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: 50% 50%;
  display: block;
  border-radius: 14px 14px 0 0;
  transition:
    transform 0.95s cubic-bezier(.22,0,.36,1),
    object-position 0.95s cubic-bezier(.22,0,.36,1);
}
.news-item-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--color-highlight-1);
  margin-bottom: 0.5rem;
  transition:
    transform 0.45s cubic-bezier(0.77,0,0.175,1),
    color 0.45s cubic-bezier(0.77,0,0.175,1);
}
.news-item-texts {
  display: flex;
  flex-direction: column;
  gap: 0.3em;
  width: 100%;
  align-items: flex-start;
  justify-content: flex-end;
  min-height: 120px;
  transition: max-height 1.1s cubic-bezier(.22,0,.36,1);
  will-change: transform, opacity, max-height;
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
  transition:
    transform 0.95s cubic-bezier(.22,0,.36,1) 0.04s,
    opacity 0.95s cubic-bezier(.22,0,.36,1) 0.04s;
  will-change: transform, opacity;
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
  transition:
    transform 1.1s cubic-bezier(.22,0,.36,1) 0.09s,
    opacity 1.1s cubic-bezier(.22,0,.36,1) 0.09s;
  will-change: transform, opacity;
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
  transition:
    transform 1.25s cubic-bezier(.22,0,.36,1) 0.13s,
    opacity 1.25s cubic-bezier(.22,0,.36,1) 0.13s;
  will-change: transform, opacity;
  cursor: pointer;
}
</style>
