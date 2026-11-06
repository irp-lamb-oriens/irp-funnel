<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '../../components/Header/Header.svelte';
	import Footer from '../../components/Footer/Footer.svelte';
	import CountryLayout from '../../components/ui/CountryLayout.svelte';
	import { locations } from '../../lib/data/offices.ts';
	import './contact-us.scss';

	// Same office data as the home page's "Our offices" (lib/data/offices.ts).
	const META: Record<string, { code: string; zone: string; city: string }> = {
		'United States': { code: 'US', zone: 'America/New_York', city: 'Miami' },
		Mexico: { code: 'MX', zone: 'America/Mexico_City', city: 'Mexico City' },
		'Costa Rica': { code: 'CR', zone: 'America/Costa_Rica', city: 'Alajuela' },
		Panamá: { code: 'PA', zone: 'America/Panama', city: 'Panama City' },
		Spain: { code: 'ES', zone: 'Europe/Madrid', city: 'Madrid' }
	};
	const GENERAL = 'info@internationalrelocationpartner.com';

	const offices = locations.map((loc) => ({
		country: loc.country,
		meta: META[loc.country],
		email: loc.details.find((d) => d.email)?.email ?? '',
		places: loc.details.map((d) => ({
			name: d.label || META[loc.country]?.city || loc.country,
			lines: d.address.split(/<br\s*\/?>/i).map((l) => l.trim()).filter(Boolean),
			soon: /^coming soon/i.test(d.address)
		}))
	}));

	const mapsHref = (lines: string[], country: string) =>
		`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([...lines, country].join(', '))}`;

	let times: Record<string, string> = {};
	function tick() {
		const now = new Date();
		const next: Record<string, string> = {};
		for (const o of offices) {
			if (!o.meta) continue;
			try {
				next[o.country] = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: o.meta.zone }).format(now);
			} catch {
				/* unknown zone: no clock */
			}
		}
		times = next;
	}
	onMount(() => {
		tick();
		const id = window.setInterval(tick, 30000);
		return () => window.clearInterval(id);
	});
</script>

<Header />

<CountryLayout
	heroTitle="Contact Us"
	heroEyebrow="Contact"
	heroSubTitle="Offices in the United States, Mexico, Costa Rica, Panama and Spain."
	heroUrl="https://images.pexels.com/photos/3935702/pexels-photo-3935702.jpeg?w=2000"
	ctaSecondary={{ label: 'Read our guides', href: '/guides' }}
>
	<div class="ct">
		<section class="ct-intro" aria-labelledby="ct-intro-title">
			<p class="ct-eyebrow">Get in touch</p>
			<h2 id="ct-intro-title">Write to the office for your destination</h2>
			<p class="ct-lede">
				Every project is led by professionals with more than 14 years of experience. For anything else, write to
				<a href="mailto:{GENERAL}">{GENERAL}</a>.
			</p>
		</section>

		<ul class="ct-grid" role="list" aria-label="Our offices">
			{#each offices as o (o.country)}
				<li class="ct-country">
					<div class="ct-country__head">
						{#if o.meta}<span class="ct-code" aria-hidden="true">{o.meta.code}</span>{/if}
						<div>
							<h3>{o.country}</h3>
							{#if times[o.country]}<p class="ct-time"><span class="ct-dot" aria-hidden="true"></span>{times[o.country]} local time</p>{/if}
						</div>
					</div>

					{#if o.email}
						<a class="ct-email" href="mailto:{o.email}">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg>
							<span>{o.email.split('@')[0]}@<wbr />{o.email.split('@')[1]}</span>
						</a>
					{/if}

					{#each o.places as p}
						<div class="ct-office">
							<p class="ct-office__name">
								{p.name}{#if p.soon}<span class="ct-soon">Coming soon</span>{/if}
							</p>
							{#if !p.soon}
								<address>
									{#each p.lines as line}<span>{line}</span>{/each}
								</address>
								<a class="ct-link" href={mapsHref(p.lines, o.country)} target="_blank" rel="noopener noreferrer">
									Open in Maps<span class="ct-sr"> ({p.name}, {o.country}, opens in a new tab)</span>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M9 7h8v8" /></svg>
								</a>
							{/if}
						</div>
					{/each}

				</li>
			{/each}
		</ul>
	</div>
</CountryLayout>

<Footer />
