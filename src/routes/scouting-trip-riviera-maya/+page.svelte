<script lang="ts">
	import Header from '../../components/Header/Header.svelte';
	import Footer from '../../components/Footer/Footer.svelte';
	import MovingProcessSection from '../../components/MovingProcessSection.svelte';
	import VideoScouting from '../../components/scouting/VideoScouting.svelte';
	import FinalCTA from '../../components/scouting/FinalCTA.svelte';
	import HeroScouting from '../../components/scouting/HeroScouting.svelte';

	const phoneNumber = '+529842387264';
	const message = encodeURIComponent(
		"Hello! I'm interested in the Riviera Maya Scout Trip and would like to reserve a spot. Can you please provide more details?"
	);
	const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;

	const scoutingSteps = [
		{
			title: 'Discover the Riviera Maya',
			rightTitle: 'Is the Riviera Maya for You?',
      narrative: [
        'The Riviera Maya is a top destination for expats, but is it right for you? We cover the essentials to help you decide.',
        'Learn about the lifestyle, cost of living, and what to expect when you move to Mexico’s Caribbean coast.'
      ],
      videoUrl: 'https://www.pexels.com/download/video/29297347/'
    },
    {
      title: 'Visas and Residency',
      rightTitle: 'Navigating Legal Requirements',
      narrative: [
        'Understanding the legal requirements is the first step to a successful move. We break down the visa and residency process.',
        'From temporary to permanent residency, we’ll guide you through the paperwork and what to expect.'
      ],
      videoUrl: 'https://www.pexels.com/download/video/7206060/'
    },
    {
      title: 'Finding Your Home',
      rightTitle: 'Housing and Real Estate',
      narrative: [
        'From beachfront condos to jungle retreats, we explore the housing market in the Riviera Maya.',
        'Learn about renting vs. buying, property ownership laws for foreigners, and the best neighborhoods for expats.'
      ],
      videoUrl: 'https://www.pexels.com/download/video/17952680/'
    },
    {
      title: 'Daily Life and Culture',
      rightTitle: 'Integrating into the Community',
      narrative: [
        'What is daily life really like in the Riviera Maya? We cover everything from healthcare and schools to safety and culture.',
        'Get tips on how to integrate into the local community and make the most of your new life in Mexico.'
      ],
      videoUrl: 'https://www.pexels.com/download/video/16435102/'
    }
  ];
</script>

<main id="main-content">
  <HeroScouting />
	<div class="chat-section">
		<div class="chat-wrapper">
			<p class="chat-text">chat with our relocation expert, Szilvia Galambosi / Pablo Arias</p>
			<a href={whatsappUrl} target="_blank" rel="noopener noreferrer" class="cta-btn whatsapp-button">
				<span class="cta-btn__inner">
					<span class="icon-wrapper">
						<img src="/icons/phone-80-3.png" alt="WhatsApp Icon" class="icon" />
					</span>
					<span class="cta-btn__label">WhatsApp Us</span>
				</span>
			</a>
		</div>
	</div>
	<VideoScouting />
	<FinalCTA {whatsappUrl} />
</main>

<style>
  .chat-wrapper {
    max-width: 1200px;
    margin: auto;
    padding: 0 2rem;
  }

  .chat-section {
    background-color: white;
    text-align: center;
  }
  .chat-text {
    margin: 0;
    font-size: 1.2rem;
    font-weight: bold;
  }
  .icon-wrapper {
    width: 24px;
    transition: width 0.4s cubic-bezier(0.6, 0, 0.4, 1);
    overflow: hidden;
  }
  .whatsapp-button:hover .icon-wrapper {
    width: 0;
    opacity: 0;
  }
  .icon {
    width: 24px;
    height: 24px;
    display: block;
  }
  /* Base */
  .cta-btn {
    --radius-md: 9999px; /* si ya tienes otra var de radios, cámbiala aquí */
    --transition-fast: 150ms;

    display: inline-block;
    font-weight: 600;
    border-radius: var(--radius-md);
    padding: 0.75rem 1.5rem;
    text-align: center;
    transition: all var(--transition-fast);
    border: 2px solid transparent;
    cursor: pointer;
    line-height: 1;
    user-select: none;
  }
  .cta-btn:focus-visible {
    outline: 2px solid transparent;
    outline-offset: 2px;
    box-shadow:
      0 0 0 3px var(--color-background),
      0 0 0 5px var(--color-highlight-2);
  }
  .cta-btn[data-disabled='true'] {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none;
  }
  .cta-btn__inner {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    justify-content: center;
  }
  .whatsapp-button {
    background-color: #25d366;
    color: white;
    box-shadow: inset 0 0 0 100px #25d366;
    transition:
      box-shadow 0.5s,
      color 0.2s,
      background-color 0.4s;
    width: 180px;
    margin: 1rem 0;
  }
  .whatsapp-button:hover {
    background-color: transparent;
    color: #25d366;
    box-shadow: inset 0 0 0 2px #25d366;
  }
</style>
