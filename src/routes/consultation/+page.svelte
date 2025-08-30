<script lang="ts">
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import CountryLayout from '../../components/ui/CountryLayout.svelte';
  import './consultation.scss';
</script>

<Header />

<CountryLayout heroSubTitle="Delivered through well planned, tracked and executed projects!" heroTitle="Personalized relocation assistance" heroUrl="https://images.pexels.com/photos/4569340/pexels-photo-4569340.jpeg?w=2000">
  <section class="consultation-info">
    <h3>We know you have several questions, so we prepare for you an initial consultation call with two main objectives:</h3>
    <ul>
      <li>Understanding your requirements. We like to know what your needs are and know what is important to you.</li>
      <li>Explain to you the rules and regulations that may affect your shipment process, this quick call can help us review these rules and advice depending on your specific case.</li>
    </ul>
  </section>
  <section class="consultation-iframe-section">
    <iframe width="100%" height="750px"
      src="https://zohodev-internationalrelocationpartner39.zohobookings.com/portal-embed#/4742044000000055060"
      frameborder="0" allowfullscreen></iframe>
  </section>
</CountryLayout>

<Footer />
