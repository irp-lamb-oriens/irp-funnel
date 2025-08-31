<script lang="ts">
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import CountryLayout from '../../components/ui/CountryLayout.svelte';
    import CountryContentWrapper from '../../components/ui/CountryContentWrapper.svelte';
</script>

<Header />

<CountryLayout heroTitle="Privacy Policy" heroUrl="https://images.pexels.com/photos/955395/pexels-photo-955395.jpeg?w=2000">
  <CountryContentWrapper>
    <div class="tldr">
      <h3>TL;DR (The Short Version)</h3>
      <p>
        To give you a personalized quote or plan, we need to ask you some questions. We collect the details you provide (like your contact info, budget, and needs) to create your results and allow our team to follow up with you. We don't sell your data to third-party marketers. You can ask for your data or have it deleted at any time.
      </p>
    </div>
  
    <h2>1. Our Commitment to Your Privacy</h2>
    <p>
      This Privacy Policy explains how we collect, use, and handle your information when you use our marketing funnel and associated services ("Service"). We are committed to transparency and protecting your data. This policy, along with our <a href="/terms">Terms of Service</a>, governs your use of our Service.
    </p>
  
    <h2>2. Information We Collect and Why</h2>
    <p>
      Our goal is to provide you with a personalized, relevant offer or consultation. To do that, we need to collect information about your needs and preferences. Here’s a transparent look at what we collect and why:
    </p>
    <div class="data-table-container">
      <table>
        <thead>
          <tr>
            <th>What We Collect</th>
            <th>Why We Collect It (Purpose of Use)</th>
            <th>Your Rights & Controls</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Contact & Identity Information</strong> (e.g., name, email, age)</td>
            <td>To identify you, send you your results, and allow our team to contact you for your consultation or to provide your quote.</td>
            <td>Required to use the service. You can request a copy or deletion of this data.</td>
          </tr>
          <tr>
            <td><strong>Project & Preference Data</strong> (e.g., budget, property type, square footage, reasons for moving)</td>
            <td>This is the core information we use to build your personalized results, plan, or quote.</td>
            <td>Required to generate results. You can choose not to provide this information, but we won't be able to provide a personalized outcome.</td>
          </tr>
          <tr>
            <td><strong>Technical & Usage Data</strong> (e.g., UTM parameters from ads, video watch time, IP address)</td>
            <td>To understand which marketing campaigns are effective, improve our funnel's performance, and prevent fraud.</td>
            <td>We do not use this for user profiling. You can opt-out of non-essential analytics cookies.</td>
          </tr>
        </tbody>
      </table>
    </div>
  
    <h2>3. How We Use and Share Your Information</h2>
    <p>
      The information you provide is used to deliver the service you requested. This means:
    </p>
    <ul>
      <li><strong>Generating Your Results:</strong> We process your inputs to create the personalized output of the funnel.</li>
      <li><strong>Follow-Up Communication:</strong> Our sales or consultation team will use your contact information to get in touch with you regarding your results, as is the stated purpose of the funnel.</li>
      <li><strong>Service Providers:</strong> We may share information with trusted service providers (sub-processors) who help us operate our service, such as CRM platforms (for managing client interactions) and cloud hosting providers. They are contractually bound to protect your data.</li>
    </ul>
    <p>
      <strong>We do not sell or rent your personal data to unrelated third-party marketers.</strong>
    </p>
  
    <h2>4. Your Rights and How to Exercise Them</h2>
    <p>
      You have rights over your personal data. Depending on your region, these may include the right to access, correct, or delete your information. To exercise these rights, please contact our Data Protection Officer at <a href="mailto:info@internationalrelocationpartner.com">info@internationalrelocationpartner.com</a>.
    </p>
  
    <h2>5. Data Security & Retention</h2>
    <p>
      We use industry-standard security measures to protect your data. We retain your data for as long as it is needed to provide you with our services or as required for our business operations and legal obligations.
    </p>
    
    <h2>6. Consent</h2>
    <p>
      By submitting your information through our funnel, you are providing explicit consent for us to collect, process, and use your data for the purposes outlined in this policy and our Terms of Service, including being contacted by our team.
    </p>
  
    <h2>7. Changes & Contact</h2>
    <p>
      We may update this policy from time to time. If you have any questions, please contact us at <a href="mailto:info@internationalrelocationpartner.com">info@internationalrelocationpartner.com</a>.
    </p>
  </CountryContentWrapper>
</CountryLayout>

<style>
  .data-table-container {
    overflow-x: auto;
    margin-bottom: 1.5rem;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;
  }
  th, td {
    text-align: left;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e2e8f0;
  }
  th {
    background-color: #f7fafc;
    font-weight: 600;
  }
  tbody tr:last-child td {
    border-bottom: none;
  }
</style>

<Footer />
