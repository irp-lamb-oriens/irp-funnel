<script lang="ts">
	import Header from '../../components/Header/Header.svelte';
	import Footer from '../../components/Footer/Footer.svelte';
	import CountryLayout from '../../components/ui/CountryLayout.svelte';
	import './contact-us.scss';
	const iframeUrl =
		'https://zohodev-internationalrelocationpartner39.zohobookings.com/portal-embed#/4742044000000055060';
</script>

<Header />

<CountryLayout heroTitle="Contact Us" heroUrl="https://images.pexels.com/photos/3935702/pexels-photo-3935702.jpeg?w=2000">
  <section class="contact-location">
    <h2>Our Location</h2>
    <p>Every project is led by professionals with more than 14 years of experience</p>
    <div class="location-grid">
      <div class="location-col">
        <h3>United States</h3>
        <div class="location-blurb">
          <img src="/icons/map.png" alt="Map" width="60" height="60" />
          <div>
            <h5>International Relocation Partner LLC</h5>
            <p>175 SW 7th Street STE 1517 – 559<br />MIAMI FLORIDA 33130</p>
          </div>
        </div>
        <h3>Panamá</h3>
        <div class="location-blurb">
          <img src="/icons/map.png" alt="Map" width="60" height="60" />
          <div>
            <h5>Panama City</h5>
            <p>PH Grupo Pistar, Vía Simón Bolivar Oficina 239</p>
          </div>
        </div>
        <div class="location-blurb">
          <img src="/icons/map.png" alt="Map" width="60" height="60" />
          <div>
            <h5>Boquete</h5>
            <p>Coming soom to Boquete, Chiriqui,<br />Panama</p>
          </div>
        </div>
      </div>
      <div class="location-col">
        <h3>Costa Rica</h3>
        <div class="location-blurb">
          <img src="/icons/map.png" alt="Map" width="60" height="60" />
          <div>
            <h5>Alajuela</h5>
            <p>700 metros al este del cruce del aeropuerto Juan SantaMaria, Carretera a Heredia, WF Office Building, Alajuela Province, Río Segundo, 20109</p>
          </div>
        </div>
        <div class="location-blurb">
          <img src="/icons/map.png" alt="Map" width="60" height="60" />
          <div>
            <h5>Guanacaste</h5>
            <p>A 1.5kms norte de la plaza de futbol de Villarreal. Camino a Huacas, 500 metros después de la gasolinera. Tamarindo, Guanacaste</p>
          </div>
        </div>
      </div>
      <div class="location-col">
        <h3>Spain</h3>
        <div class="location-blurb">
          <img src="/icons/map.png" alt="Map" width="60" height="60" />
          <div>
            <p>Calle Bolivia 17, 11ºB, 28016, Madrid, Spain.</p>
          </div>
        </div>
      </div>
    </div>
  </section>
  <section class="consultation-section">
    <h2>Request Your Free Relocation Consultation</h2>
    <p>Moving abroad is a unique experience for everybody, with different motives, family sizes, and needs. Learning about you and your specific needs, allows us to give you useful advice and relevant information for you to plan your relocation project.</p>
    <div class="consultation-iframe">
      <iframe
        loading="lazy"
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
    </div>
  </section>
</CountryLayout>

<Footer />
