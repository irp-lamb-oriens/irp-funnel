<script lang="ts">
  import VideoBanner from "./VideoBanner.svelte";
  import CTAButton from "./Header/CTAButton.svelte";
  import LetterByLetter from "./LetterByLetter.svelte";

  export let videoUrl: string = "https://storage.googleapis.com/videos-irp-funnels/The-Truth-About-Moving-Abroad_-What-You-Need-to-Know-Before-Taking-the-Leap.mp4";
  export let imageUrl: string = "/video-lightbox1b-480x590.jpg";
  export let imageAlt: string = "video-lightbox1b";
</script>
<div class="hero-banner">
  <video
    autoplay
    muted
    loop
    playsinline
    class="bg-video"
    src="https://www.pexels.com/download/video/7855756/"
  ></video>
  <VideoBanner
    videoUrl={videoUrl}
    videoPoster={imageUrl}
    videoAlt={imageAlt}
  >
    <div class="banner-content">
      <h6 class="banner-subtitle">
        <LetterByLetter text="Every project is led by professionals with more than 14 years of experience" initialOffset={0} />
      </h6>
      <h1 class="banner-title">
        <LetterByLetter text="Personalized international consultations delivered through well-planned, tracked, and executed projects!" initialOffset={47.9 / 100} />
      </h1>
      <h4 class="banner-services-title">
        <LetterByLetter text="International consulting services for expats, newcomers, and retirees:" initialOffset={115.92 / 100} />
      </h4>
      <ul class="banner-services-list">
        <li class="banner-service">
          <LetterByLetter text="Project Management" initialOffset={152.95 / 100} />
        </li>
        <li class="banner-service">
          <LetterByLetter text="Documentation Assistance" initialOffset={167.89 / 90} />
        </li>
        <li class="banner-service">
          <LetterByLetter text="International Advisory" initialOffset={175.90 / 80} />
        </li>
      </ul>
      <div class="button-row">
        <CTAButton trigger={true} label="Schedule Consultation" href="/consultation/" variant="primary" />
        <CTAButton label="Download Relocation Checklist" href="/free-resources/" variant="secondary" target="_blank" />
      </div>
    </div>
  </VideoBanner>
</div>

<style lang="scss">
.hero-banner {
  position: relative;
  padding: 3rem 0;
  overflow: hidden;

    &::before {
      content: "";
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(
        circle,
        rgba(0, 0, 0, 0) 0%,
        rgba(0, 0, 0, 0.4) 100%
      );
      z-index: 1;
      pointer-events: none;
    }

  .bg-video {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 0;
    object-fit: cover;
    filter: brightness(0.9);
  }

  & > :global(*) {
    position: relative;
    z-index: 2;
  }
}

.banner-content {
  max-width: 720px;
  margin: 0 auto;
  padding: 3.5rem;
  background: rgba(15, 15, 15, 0.35);
  backdrop-filter: blur(30px) saturate(150%);
  -webkit-backdrop-filter: blur(30px) saturate(150%);
  border-radius: 2.5rem;
  border: 1px solid rgba(255, 255, 255, 0.15);
  box-shadow: 
    0 40px 100px -20px rgba(0, 0, 0, 0.7),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: -20%;
    right: -20%;
    width: 60%;
    height: 60%;
    background: radial-gradient(circle, rgba(28, 207, 201, 0.15) 0%, transparent 70%);
    pointer-events: none;
    z-index: 0;
    filter: blur(40px);
  }
}

.banner-subtitle,
.banner-title,
.banner-services-title {
  text-align: inherit;
}

.banner-subtitle {
  position: relative;
  z-index: 1;
  font-size: 1rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: #1ccfc9;
  margin-bottom: 1.5rem;
}

.banner-title {
  position: relative;
  z-index: 1;
  font-size: 3rem;
  font-weight: 900;
  color: #ffffff;
  margin-bottom: 2rem;
  line-height: 1.1;
  letter-spacing: -0.03em;
  background: linear-gradient(to right, #ffffff, rgba(255, 255, 255, 0.8));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.banner-services-title {
  position: relative;
  z-index: 1;
  font-size: 1.1rem;
  font-weight: 500;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 1.5rem;
}

.banner-services-list {
  position: relative;
  z-index: 1;
  list-style: none;
  padding: 0;
  margin: 0 0 2.5rem 0;
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: flex-start;
}

.banner-service {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(5px);
  -webkit-backdrop-filter: blur(5px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #ffffff;
  font-size: 0.9rem;
  font-weight: 500;
  padding: 0.75rem 1.5rem;
  border-radius: 2rem;
  transition: all 0.3s ease;
  white-space: nowrap;
  text-align: center;

  &:hover {
    background: rgba(255, 255, 255, 0.1);
    transform: translateY(-2px) scale(1.05);
    border-color: rgba(28, 207, 201, 0.5);
  }
}

.banner-service:hover,
.banner-service:focus-visible {
  background: #d0e4fa;
  color: #17406a;
}

.button-row {
  display: flex;
  gap: 1.2rem;
  margin-top: 1.2rem;
  justify-content: flex-start;
  width: 100%;
}

@media (max-width: 1024px) {
  .banner-content {
    align-items: center;
    text-align: center;
    padding: 1.5rem 0.5rem;
  }
  .banner-title {
    font-size: 2rem;
  }
  .banner-services-list {
    justify-content: center;
  }
  .button-row {
    justify-content: center;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
}

@media (max-width: 600px) {
  .banner-content {
    padding: 1rem 0.2rem;
    border-radius: 1rem;
  }
  .banner-title {
    font-size: 1.3rem;
  }
  .banner-services-list {
    gap: 0.5rem;
  }
  .banner-service {
    font-size: 0.95rem;
    padding: 0.5rem 1rem;
  }
}
</style>
