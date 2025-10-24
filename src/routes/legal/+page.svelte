<script lang="ts">
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import CountryLayout from '../../components/ui/CountryLayout.svelte';
  import './legal.scss';
</script>

<Header />

<CountryLayout heroTitle="Legal Notice" heroUrl="https://images.pexels.com/photos/8962381/pexels-photo-8962381.jpeg?w=2000">
  <section class="legal-content">
    <p>
      This Legal Notice governs the use of this website and the services provided by International Relocation Partner. By accessing or using this website, you agree to comply with and be bound by the terms and conditions set forth herein.
    </p>
    <h2>Disclaimer</h2>
    <p>
      The information provided on this website is for general informational purposes only and does not constitute legal, financial, or professional advice. International Relocation Partner makes no representations or warranties regarding the accuracy, completeness, or reliability of any information on this site.
    </p>
    <h2>Intellectual Property</h2>
    <p>
      All content, trademarks, logos, and intellectual property displayed on this website are the property of International Relocation Partner or their respective owners. Unauthorized use, reproduction, or distribution of any content is strictly prohibited.
    </p>
    <h2>Contact</h2>
    <p>
      For any questions regarding this Legal Notice, please contact us at <a href="mailto:info@internationalrelocationpartner.com">info@internationalrelocationpartner.com</a>.
    </p>
  </section>
</CountryLayout>

<Footer />
