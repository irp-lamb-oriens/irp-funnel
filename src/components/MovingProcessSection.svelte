<script lang="ts">
  import { onMount } from "svelte";
  import CTAButton from "./Header/CTAButton.svelte";
  import { writable } from "svelte/store";
  import { fade } from "svelte/transition";

  // Data for each step
  const steps = [
    {
      icon: "/icons/phone-80-3.png",
      title: "Relocation conference call",
      rightTitle: "Relocation conference call",
      narrative: [
        "We start with a personalized relocation conference call to understand your unique needs and answer your initial questions.",
        "This is where we set the foundation for a smooth transition, ensuring you feel heard and supported from the very beginning."
      ]
    },
    {
      icon: "/icons/support.png",
      title: "Personalized Relocation Plan",
      rightTitle: "Personalized Relocation Plan",
      narrative: [
        "Based on your goals, we craft a detailed, step-by-step relocation plan tailored to your timeline, preferences, and requirements.",
        "Our team leverages years of experience and best practices to anticipate challenges and provide clear guidance."
      ]
    },
    {
      icon: "/icons/location.png",
      title: "Timeline Relocation tracking and follow up",
      rightTitle: "Timeline Relocation tracking and follow up",
      narrative: [
        "We track every milestone and keep you updated on progress, so you always know what’s next and what’s needed.",
        "Our proactive follow-up ensures nothing falls through the cracks and you stay on schedule."
      ]
    },
    {
      icon: "/icons/followup.png",
      title: "Continues support during your relocation",
      rightTitle: "Continues support during your relocation",
      narrative: [
        "Even after arrival, our support continues. We’re here to answer questions, solve issues, and help you settle in.",
        "Your peace of mind is our priority, every step of the way."
      ]
    }
  ];

  // Store for the current step index in view
  const currentStep = writable(0);

  // Unique key for animation reset
  let currentStepKey = '';
  $: currentStepKey = `${$currentStep}-${Date.now()}`;

  // For CSS animation trigger
  let animateClass = '';
  let stickyRef: HTMLElement | null = null;
  let inView = false;
  let lastStep = -1;
  $: {
    if (inView && $currentStep !== undefined && $currentStep !== lastStep) {
      animateClass = '';
      setTimeout(() => {
        animateClass = 'animate';
        lastStep = $currentStep;
      }, 10);
    }
  }
  // Intersection Observer for sticky container
  onMount(() => {
    let observer: IntersectionObserver | null = null;
    if (stickyRef) {
      observer = new window.IntersectionObserver(
        (entries) => {
          entries.forEach(entry => {
            inView = entry.isIntersecting;
            if (inView) {
              animateClass = '';
              setTimeout(() => {
                animateClass = 'animate';
                lastStep = $currentStep;
              }, 10);
            }
          });
        },
        { threshold: 0.2 }
      );
      observer.observe(stickyRef);
    }
    return () => observer && observer.disconnect();
  });

  // For staggered delay offset between cards
  let currentParagraphs: string[] = [];
  let currentWordOffsets: number[] = [];
  const baseDelay = 0.18;
  $: {
    const step = $currentStep !== undefined ? steps[$currentStep] : steps[0];
    currentParagraphs = step.narrative;
    let offset = 0;
    currentWordOffsets = currentParagraphs.map(para => {
      const count = para.split(/(\s+)/).length;
      const prev = offset;
      offset += count;
      return prev;
    });
  }

  // Array of step refs
  let stepRefs: (HTMLElement | undefined)[] = [];

  // Custom action to set ref
  function setStepRef(node: HTMLElement, idx: number) {
    stepRefs[idx] = node;
    return {
      destroy() {
        stepRefs[idx] = undefined;
      }
    };
  }

  onMount(() => {
    const observer = new window.IntersectionObserver(
      (entries) => {
        let maxRatio = 0;
        let maxIdx = 0;
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > maxRatio) {
            maxRatio = entry.intersectionRatio;
            maxIdx = stepRefs.findIndex(el => el === entry.target);
          }
        });
        if (maxRatio > 0) {
          currentStep.set(maxIdx);
        }
      },
      {
        root: null,
        rootMargin: "0px",
        threshold: Array.from({ length: 11 }, (_, i) => i / 10)
      }
    );
    stepRefs.forEach(el => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  });
</script>

<section class="moving-process-section">
  <div class="moving-process-grid">
    <!-- Left: Sticky Narrative Card(s) (desktop only) -->
    <div class="moving-process-intro-sticky" bind:this={stickyRef}>
      {#key currentStepKey}
        <div class="moving-process-card-group {animateClass}">
          {#each currentParagraphs as para, pidx}
            <div class="moving-process-card">
              <p class="moving-process-intro-text">
                {#each para.split(/(\s+)/) as word, widx}
                  <span
                    class="fade-word"
                    style="white-space: pre; transition-delay: {(currentWordOffsets[pidx] + widx + 1) * baseDelay}s"
                  >{word}</span>
                {/each}
              </p>
            </div>
          {/each}
        </div>
      {/key}
    </div>

    <!-- Center: Vertical Timeline (desktop) / Stepper (mobile) -->
    <div class="moving-process-timeline-container">
      <div class="moving-process-timeline moving-process-timeline-responsive">
        {#each steps as step, i}
          <div
            class="moving-process-step"
            use:setStepRef={i}
            aria-current={$currentStep === i ? "step" : undefined}
          >
            <div class="moving-process-icon-circle">
              <img class="moving-process-icon" src={step.icon} alt={step.title} />
            </div>
            <div class="moving-process-step-title moving-process-step-title-mobile">
              <h5 class="moving-process-step-heading">{step.rightTitle}</h5>
            </div>
            <div class="moving-process-card-group moving-process-card-group-mobile">
              {#each step.narrative as para}
                <div class="moving-process-card">
                  <p class="moving-process-intro-text">{para}</p>
                </div>
              {/each}
            </div>
          </div>
        {/each}
        <div class="moving-process-vertical-line"></div>
      </div>
    </div>

    <!-- Right: Step Titles (desktop only) -->
    <div class="moving-process-steps">
      {#each steps as step, i}
        <div class="moving-process-step-title">
          <h5 class="moving-process-step-heading">{step.rightTitle}</h5>
        </div>
      {/each}
    </div>
  </div>

  <div class="moving-process-actions">
    <div class="moving-process-btn-wrapper">
      <CTAButton label="Schedule Consultation" href="/consultation/" variant="primary" />
    </div>
    <div class="moving-process-btn-wrapper">
      <CTAButton label="Download Relocation Checklist" href="/free-resources/" variant="secondary" target="_blank" />
    </div>
  </div>
</section>

<style lang="scss">
.moving-process-section {
  background: #181c24;
  color: #fff;
  padding: 3rem 0 2rem 0;
  font-family: 'Inter', Arial, sans-serif;
}

.moving-process-grid {
  display: grid;
  grid-template-columns: 1.2fr 0.5fr 1.2fr;
  gap: 2.5rem;
  align-items: start;
  max-width: 1200px;
  margin: 0 auto;
  position: relative;
}

.moving-process-intro-sticky {
  position: sticky;
  top: 130px;
  align-self: flex-start;
  z-index: 10;
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
  min-height: 200px;
}

.moving-process-card-group {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.fade-word {
  opacity: 0;
  transition: opacity 0.6s cubic-bezier(0.4,0,0.2,1);
  display: inline-block;
}
.moving-process-card-group.animate .fade-word {
  opacity: 1;
}

.moving-process-title {
  font-size: 2.2rem;
  font-weight: 800;
  margin-bottom: 0.5rem;
  letter-spacing: -1px;
  color: #fff;
}

.moving-process-card {
  background: #23293a;
  border-radius: 10px;
  padding: 1.2rem 1.5rem;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

.moving-process-intro-text {
  font-size: 1.08rem;
  color: #e0e6f0;
  margin: 0;
  line-height: 1.6;
}

.moving-process-timeline-container {
  display: flex;
  justify-content: center;
  align-items: stretch;
  position: relative;
}

.moving-process-timeline {
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  min-height: 200vh;
  justify-content: space-between;
  width: 100%;
  gap: 8vh;
}

.moving-process-step {
  z-index: 2;
  margin: 0.5rem 0;
}

.moving-process-icon-circle {
  background: #1de9b6;
  border-radius: 50%;
  width: 68px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(29,233,182,0.18);
  border: 3px solid #fff;
}

.moving-process-icon {
  width: 38px;
  height: 38px;
  object-fit: contain;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.10));
}

.moving-process-vertical-line {
  position: absolute;
  left: 50%;
  top: 0;
  transform: translateX(-50%);
  width: 6px;
  height: 100%;
  background: linear-gradient(to bottom, #1de9b6 0%, #00bfae 100%);
  z-index: 1;
  border-radius: 3px;
  opacity: 0.7;
  pointer-events: none;
}

.moving-process-steps {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 8vh;
  min-height: 200vh;
}

.moving-process-step-title {
  display: flex;
  align-items: center;
  min-height: 68px;
}

.moving-process-step-heading {
  font-size: 1.18rem;
  font-weight: 700;
  color: #1de9b6;
  margin: 0;
  letter-spacing: -0.5px;
  text-shadow: 0 1px 4px rgba(0,0,0,0.10);
}

.moving-process-step-title-mobile,
.moving-process-card-group-mobile {
  display: none;
}

.moving-process-actions {
  display: flex;
  gap: 1.2rem;
  margin: 2.5rem auto 0 auto;
  justify-content: center;
  flex-wrap: wrap;
}

.moving-process-btn-wrapper {
  min-width: 220px;
  font-size: 1.08rem;
  font-weight: 700;
  border-radius: 6px;
  padding: 0.7rem 1.5rem;
  margin: 0.2rem 0;
  display: flex;
  justify-content: center;
}

:global(.primary-btn) {
  background: #1de9b6 !important;
  color: #181c24 !important;
  border: none;
  box-shadow: 0 2px 8px rgba(29,233,182,0.10);
  transition: background 0.15s, color 0.15s;
}
:global(.primary-btn:hover) {
  background: #00bfae !important;
  color: #fff !important;
}

:global(.secondary-btn) {
  background: #23293a !important;
  color: #1de9b6 !important;
  border: 2px solid #1de9b6 !important;
  transition: background 0.15s, color 0.15s;
}
:global(.secondary-btn:hover) {
  background: #1de9b6 !important;
  color: #181c24 !important;
}

@media (max-width: 900px) {
  .moving-process-grid {
    grid-template-columns: 1fr;
    gap: 2rem;
    max-width: 98vw;
  }
  .moving-process-intro-sticky {
    display: none;
  }
  .moving-process-steps {
    display: none;
  }
  .moving-process-timeline-responsive {
    min-height: unset;
    gap: 4vh;
    width: 100%;
  }
  .moving-process-step-title-mobile,
  .moving-process-card-group-mobile {
    display: block;
    width: 100%;
    margin-top: 0.5rem;
  }
  .moving-process-step-title-mobile {
    background: #181c24;
    color: #1de9b6;
    border-radius: 8px;
    padding: 0.7rem 1.2rem;
    margin: 0.7rem 0 0.5rem 0;
    text-align: center;
    font-size: 1.08rem;
    font-weight: 700;
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
  }
  .moving-process-step-title-mobile .moving-process-step-heading {
    color: #1de9b6;
    margin: 0;
    font-size: 1.08rem;
    font-weight: 700;
    letter-spacing: -0.5px;
    text-shadow: 0 1px 4px rgba(0,0,0,0.10);
  }
  .moving-process-step .moving-process-icon-circle {
    margin: 0 auto;
    display: flex;
    justify-content: center;
    align-items: center;
    float: none;
  }
  .moving-process-card-group-mobile {
    display: flex;
    flex-direction: column;
    gap: 1.2rem;
    margin-bottom: 2.5rem;
  }
}

@media (max-width: 600px) {
  .moving-process-section {
    padding: 1.2rem 0 1rem 0;
  }
  .moving-process-title {
    font-size: 1.3rem;
  }
  .moving-process-card {
    padding: 0.7rem 0.8rem;
  }
  .moving-process-btn-wrapper {
    min-width: 140px;
    font-size: 0.98rem;
    padding: 0.5rem 0.8rem;
  }
}
</style>
