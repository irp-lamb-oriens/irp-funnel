<script lang="ts">
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import CountryLayout from '../../components/ui/CountryLayout.svelte';
  import CTAButton from '../../components/Header/CTAButton.svelte';
  import './free-resources.scss';

  // Utility to trigger download of a file
  function downloadFile(url: string, filename?: string) {
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || '');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
</script>

<Header />

<CountryLayout heroTitle="Free Resources" heroUrl="https://images.pexels.com/photos/4569340/pexels-photo-4569340.jpeg?w=2000">
  <section class="free-resources-checklist free-resource-card">
    <div class="row free-resource-card__row">
      <div class="col col-content free-resource-card__content">
        <h2 class="free-resource-card__title">DO IT YOURSELF Moving Checklist Guide</h2>
        <h5 class="free-resource-card__subtitle">Moving abroad has a series of steps that we need to diligently follow to guarantee a successful and easy relocation journey, that is why we had made this helpful guide for you!</h5>
        <CTAButton
          label="Download DIY Relocation Checklist"
          variant="primary"
          callback={() => downloadFile('/Do-It-Yourself-Moving-Checklist.pdf')}
        />
      </div>
      <div class="col col-image free-resource-card__image">
        <button
          type="button"
          class="download-link free-resource-card__download-btn"
          aria-label="Download Do It Yourself Relocation checklist"
          on:click={() => downloadFile('/Do-It-Yourself-Moving-Checklist.pdf')}
          style="background:none;border:none;padding:0;cursor:pointer;"
        >
          <img class="free-resource-card__img" src="/Do-It-Yourself-Relocation-checklist.jpg" alt="Do It Yourself Relocation checklist" width="480" />
        </button>
      </div>
    </div>
  </section>
  <section class="free-resources-advice free-resource-card">
    <div class="row free-resource-card__row">
      <div class="col col-image free-resource-card__image">
        <img class="free-resource-card__img" src="/Pablo-smiling.png" alt="Pablo smiling" width="480" />
      </div>
      <div class="col col-content free-resource-card__content">
        <h2 class="free-resource-card__title">Want Relocation Advice Personalized to YOUR Situation?</h2>
        <h4 class="free-resource-card__subtitle">We know you have several questions, so we prepare for you an initial consultation call with two main objectives:</h4>
        <ul class="free-resource-card__list">
          <li class="free-resource-card__list-item">Understanding your requirements. We like to know what your needs are and know what is important to you.</li>
          <li class="free-resource-card__list-item">Explain to you the rules and regulations that may affect your shipment process, this quick call can help us review these rules and advice depending on your specific case.</li>
        </ul>
        <CTAButton label="Schedule Consultation" href="/consultation" variant="primary" />
      </div>
    </div>
  </section>
  <section class="free-resources-packers free-resource-card">
    <div class="row free-resource-card__row">
      <div class="col col-image free-resource-card__image">
        <button
          type="button"
          class="download-link free-resource-card__download-btn"
          aria-label="Download Hiring Professional Packers checklist"
          on:click={() => downloadFile('/Hiring-Profesional-Packers-CHECK-LIST.pdf')}
          style="background:none;border:none;padding:0;cursor:pointer;"
        >
          <img class="free-resource-card__img" src="/Hiring-Professional-Packers-2.png" alt="Hiring Professional Packers" width="320" />
        </button>
      </div>
      <div class="col col-content free-resource-card__content">
        <h2 class="free-resource-card__title">Hiring Packers Checklist</h2>
        <h5 class="free-resource-card__subtitle">Moving abroad has a numbers of steps that we need to diligently follow to ensure a smooth and successful journey. Take a look at this checklist and start your relocation journey with the right foot. </h5>
        <CTAButton
          label="Download Hiring Packers Checklist"
          variant="primary"
          callback={() => {
            downloadFile('/Hiring-Profesional-Packers-CHECK-LIST.pdf')
          }}
        />
      </div>
    </div>
  </section>
  <section class="free-resources-ebook free-resource-card">
    <div class="row free-resource-card__row">
      <div class="col col-content free-resource-card__content">
        <h2 class="free-resource-card__title">Move Overseas with Ease</h2>
        <h5 class="free-resource-card__subtitle">by Deborah Dahab Free Ebook</h5>
        <p class="free-resource-card__desc">We understand how stressful and complicated just thinking about moving abroad could be, we want to let our customers know, that there is nothing to be afraid of, as long as you have the information needed to make a well-informed decision.</p>
        <p class="free-resource-card__desc">We want to help out not only to our ex-pat community but also whoever is thinking of moving abroad and starting a new adventure, so if you are looking for tips and ideas on how to live your best life abroad this free Ebook, by Deborah Dahab, Expat Coach, is for you.</p>
        <p class="free-resource-card__desc">Check it out:<br /><span class="free-resource-card__author">By Sandra</span></p>
        <CTAButton
          label="Download Move overseas with ease ebook"
          variant="primary"
          callback={() => downloadFile('/Move-overseas-with-ease-ebook-DeborahDahab-May21.pdf')}
        />
      </div>
      <div class="col col-image free-resource-card__image">
        <button
          type="button"
          class="download-link free-resource-card__download-btn"
          aria-label="Download Move overseas with ease ebook"
          on:click={() => downloadFile('/Move-overseas-with-ease-ebook-DeborahDahab-May21.pdf')}
          style="background:none;border:none;padding:0;cursor:pointer;"
        >
          <img class="free-resource-card__img" src="/Move-overseas-with-ease-ebook-DeborahDahab-May21_Page_01-791x1024.jpg" alt="Move overseas with ease ebook" width="320" />
        </button>
      </div>
    </div>
  </section>
</CountryLayout>

<Footer />
