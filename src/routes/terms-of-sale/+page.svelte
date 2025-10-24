<script lang="ts">
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import CountryLayout from '../../components/ui/CountryLayout.svelte';
  import './terms-of-sale.scss';
</script>

<Header />

<CountryLayout heroTitle="Terms of Sale" heroUrl="https://images.pexels.com/photos/7414284/pexels-photo-7414284.jpeg?w=2000">
  <section class="terms-sale-content">
    <p>
      These Terms of Sale govern the purchase of products and services from International Relocation Partner. By placing an order, you agree to these terms.
    </p>
    <h2>Orders and Payment</h2>
    <p>
      All orders are subject to acceptance and availability. Payment must be made in full before products or services are delivered.
    </p>
    <h2>Refunds and Cancellations</h2>
    <p>
      Refunds and cancellations are subject to our refund policy. Please contact us for details regarding your specific order.
    </p>
    <h2>Limitation of Liability</h2>
    <p>
      International Relocation Partner is not liable for any indirect, incidental, or consequential damages arising from the purchase or use of our products or services.
    </p>
    <h2>Changes to Terms</h2>
    <p>
      We reserve the right to update or modify these Terms of Sale at any time. Continued use of our services constitutes acceptance of the revised terms.
    </p>
  </section>
</CountryLayout>

<Footer />
