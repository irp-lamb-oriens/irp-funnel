<script lang="ts">
	import { onMount } from 'svelte';
	import Header from '../../components/Header/Header.svelte';
	import Footer from '../../components/Footer/Footer.svelte';
	import CountryLayout from '../../components/ui/CountryLayout.svelte';
	import './consultation.scss';
    import { goto } from '$app/navigation';
	const iframeUrl =
		'https://zohodev-internationalrelocationpartner39.zohobookings.com/portal-embed#/4742044000000055060';

	onMount(() => {
		setTimeout(() => {

      const search = window.location.search;
        goto(`/${search}#hero-form`);
			// const iframeWrapper = document.getElementById('iframe-wrapper');
			// if (iframeWrapper) {
			// 	iframeWrapper.scrollIntoView({ behavior: 'smooth' });
			// }
		}, 1000);
	});
</script>

<Header />

<CountryLayout heroSubTitle="Delivered through well planned, tracked and executed projects!" heroTitle="Personalized international consultation" heroUrl="https://images.pexels.com/photos/4569340/pexels-photo-4569340.jpeg?w=2000">
  <section class="consultation-info">
    <h3>We know you have several questions, so we prepare for you an initial consultation call with two main objectives:</h3>
    <ul>
      <li>Understanding your requirements. We like to know what your needs are and know what is important to you.</li>
      <li>Explain to you the rules and regulations that may affect your relocation process, this quick call can help us review these rules and advice depending on your specific case.</li>
    </ul>
  </section>
  <section class="consultation-iframe-section" id="iframe-wrapper">
    <iframe
      width="100%"
      height="750px"
      src={iframeUrl}
      frameborder="0"
      allowfullscreen
      data-testid="consultation-iframe"
    ></iframe>
    <p>
      If you have trouble with the form, please
      <a href={iframeUrl} target="_blank" rel="noopener noreferrer">click here</a>
      to open it in a new tab.
    </p>
  </section>
</CountryLayout>

<Footer />
