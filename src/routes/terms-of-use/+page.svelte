<script lang="ts">
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import CountryLayout from '../../components/ui/CountryLayout.svelte';
  import './terms-of-use.scss';
</script>

<Header />

<CountryLayout heroTitle="Terms of Use" heroUrl="https://images.pexels.com/photos/8293700/pexels-photo-8293700.jpeg?w=2000">
  <section class="terms-content">
    <p>
      These Terms of Use govern your use of this website and the services provided by International Relocation Partner. By accessing or using this website, you agree to comply with and be bound by these terms.
    </p>
    <h2>Use of Website</h2>
    <p>
      You agree to use this website only for lawful purposes and in a manner that does not infringe the rights of, restrict, or inhibit the use and enjoyment of this site by any third party.
    </p>
    <h2>Intellectual Property</h2>
    <p>
      All content, trademarks, logos, and intellectual property displayed on this website are the property of International Relocation Partner or their respective owners. Unauthorized use, reproduction, or distribution of any content is strictly prohibited.
    </p>
    <h2>Limitation of Liability</h2>
    <p>
      International Relocation Partner is not liable for any indirect, incidental, or consequential damages arising from the use of this website or the services provided.
    </p>
    <h2>Changes to Terms</h2>
    <p>
      We reserve the right to update or modify these Terms of Use at any time. Continued use of our website constitutes acceptance of the revised terms.
    </p>
    <h2>Contact</h2>
    <p>
      For any questions regarding these Terms of Use, please contact us at <a href="mailto:info@internationalrelocationpartner.net">info@internationalrelocationpartner.net</a>.
    </p>
  </section>
</CountryLayout>

<Footer />
