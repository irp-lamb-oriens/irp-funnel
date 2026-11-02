<script lang="ts">
  /**
   * /evo-lab-preview — dev only (see +page.ts). Mounts EvoView with a seeded
   * synthetic cube. `?scenario=` picks the state to look at:
   *   healthy (default) · empty · low (low data) · srm
   */
  import '../dashboard/dashboard.scss';
  import EvoView from '../dashboard/components/evo/EvoView.svelte';
  import { syntheticEvo } from '../dashboard/components/evo/engine/synthetic.ts';

  const scenario = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('scenario') ?? 'healthy' : 'healthy';
  const now = '2026-11-30T18:00:00.000Z';
  const fixture = (() => {
    if (scenario === 'empty') {
      const f = syntheticEvo({ days: 1, perDay: 0, now });
      f.cube.health.totals = { events: 0, postStartEvents: 0, legacyEvents: 0 };
      return f;
    }
    if (scenario === 'low') return syntheticEvo({ seed: 5, days: 12, perDay: 20, now });
    if (scenario === 'srm') return syntheticEvo({ seed: 4, days: 60, perDay: 40, srmShare: 0.57, now });
    return syntheticEvo({
      seed: 9, days: 120, perDay: 45, now, baseLead: 0.05, interaction: 0.6,
      experiments: [
        { key: 'HeroForm', primary: 'step:cta_click', clickLift: 0.25 },
        { key: 'Chatbot', surface: 'chat', primary: 'step:cta_click' },
        { key: 'HeroFormColor', primary: 'lead', leadLift: 0.1 },
      ],
    });
  })();
  // Friendlier titles for the preview.
  const TITLES: Record<string, string> = { HeroForm: 'Hero CTA copy', Chatbot: 'Chatbot greeting', HeroFormColor: 'Hero CTA colour' };
  for (const d of fixture.cube.experiments) d.title = TITLES[d.componentKey] ?? d.title;
</script>

<svelte:head><title>Evo Lab preview (dev)</title></svelte:head>
<div style="background:#fafbfc; min-height:100vh">
  <EvoView {fixture} />
</div>
