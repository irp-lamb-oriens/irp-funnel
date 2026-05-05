<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '../../components/Header/Header.svelte';
	import Footer from '../../components/Footer/Footer.svelte';
	import CountryLayout from '../../components/ui/CountryLayout.svelte';
	import './consultation.scss';
	import { goto } from '$app/navigation';

	// ── Zoho iframe REMOVED ──────────────────────────────────────────────
	// Zoho Bookings is being decommissioned. It used to embed an iframe here
	// that booked consultations through Zoho's own Google Calendar sync,
	// which was producing DUPLICATE Calendar events (one from Zoho's sync
	// and one from the funnel's `/api/create-user` webhook). All consultation
	// bookings now flow exclusively through HeroForm at /#hero-form, which
	// posts to /api/send-hero-consultation and goes through the centralized
	// idempotent booking helper on the server.
	//
	// This page now redirects users straight to the HeroForm.

	onMount(() => {
		const search = window.location.search;
		goto(`/${search}#hero-form`, { replaceState: true });
	});
</script>

<Header />

<CountryLayout
	heroSubTitle="Delivered through well planned, tracked and executed projects!"
	heroTitle="Personalized international consultation"
	heroUrl="https://images.pexels.com/photos/4569340/pexels-photo-4569340.jpeg?w=2000"
>
	<section class="consultation-info">
		<h3>
			We know you have several questions, so we prepare for you an initial consultation call with two
			main objectives:
		</h3>
		<ul>
			<li>
				Understanding your requirements. We like to know what your needs are and know what is
				important to you.
			</li>
			<li>
				Explain to you the rules and regulations that may affect your relocation process, this
				quick call can help us review these rules and advice depending on your specific case.
			</li>
		</ul>
	</section>
	<section class="consultation-iframe-section" id="iframe-wrapper">
		<p class="consultation-redirect-msg">
			Redirecting you to our consultation form…
			<br />
			If nothing happens, <a href="/#hero-form">click here</a> to book your consultation.
		</p>
	</section>
</CountryLayout>

<Footer />
