<script lang="ts">
  import Header from '../../components/Header/Header.svelte';
  import Footer from '../../components/Footer/Footer.svelte';
  import CountryLayout from '../../components/ui/CountryLayout.svelte';
  import NewsCard from '../../components/NewsCard.svelte';
  import './news-updates.scss';
</script>

<Header />

<CountryLayout heroTitle="News" heroUrl="https://images.pexels.com/photos/10464468/pexels-photo-10464468.jpeg?w=2000">
  <section class="news-list">
    <div class="news-grid">
      <!-- Blog Post 1 -->
      <NewsCard
  imageSrc="https://www.internationalrelocationpartner.com/wp-content/uploads/2025/02/What-Ive-Learned-From-Helping-People-Move-Abroad--400x250.jpg"
  imageAlt="What I’ve Learned From Helping People Move Abroad"
  title="What I’ve Learned From Helping People Move Abroad"
  excerpt="Moving abroad is an exciting yet complex process that involves both logistical and emotional challenges. From navigating bureaucracy and cultural adjustments to settling into a new environment,..."
  link="/what-ive-learned-from-helping-people-move-abroad/"
  readMoreText="read more"
/>
      <!-- Blog Post 2 -->
      <NewsCard
  imageSrc="https://www.internationalrelocationpartner.com/wp-content/uploads/2025/01/alicia-christin-gerald-bV7WI-AeiTA-unsplash-400x250.jpg"
  imageAlt="The 7 Things You Should Do After You Have Moved Abroad"
  title="The 7 Things You Should Do After You Have Moved Abroad"
  excerpt="Moving abroad is an exhilarating experience but comes with its fair share of challenges. Once you’ve landed in your new home, the initial days and weeks are crucial for setting the tone for your..."
  link="/the-7-things-you-should-do-after-you-have-moved-abroad/"
  readMoreText="read more"
/>
      <!-- Blog Post 3 -->
      <NewsCard
  imageSrc="https://www.internationalrelocationpartner.com/wp-content/uploads/2025/02/markus-spiske-RWTUrJf7I5w-unsplash-400x250.jpg"
  imageAlt="What Are The Hidden Costs of Moving Abroad?"
  title="What Are The Hidden Costs of Moving Abroad?"
  excerpt="The excitement of relocating to a new country often comes with dreams of new adventures, cultural experiences, and a fresh start. However, while many expats plan for obvious expenses like flights,..."
  link="/what-are-the-hidden-costs-of-moving-abroad/"
  readMoreText="read more"
/>
      <!-- Blog Post 4 -->
      <NewsCard
  imageSrc="https://www.internationalrelocationpartner.com/wp-content/uploads/2025/02/How-ti-Import-a-Car-to-Panama-400x250.jpg"
  imageAlt="How to Import a Car to Panama"
  title="How to Import a Car to Panama"
  excerpt="Moving to Panama and considering bringing your car with you? While importing a vehicle can be a great way to maintain familiarity, it requires careful planning and adherence to local regulations. In..."
  link="/how-to-import-a-car-to-panama/"
  readMoreText="read more"
/>
      <!-- Blog Post 5 -->
      <NewsCard
  imageSrc="https://www.internationalrelocationpartner.com/wp-content/uploads/2025/02/Import-a-Car-to-Panama-400x250.jpg"
  imageAlt="Everything You Need to Know About Importing a Car to Panama"
  title="Everything You Need to Know About Importing a Car to Panama"
  excerpt="Moving to a new country often involves deciding what to do about your vehicle. For many, importing a car to Panama can be a practical choice, especially if you have a vehicle you love or need for..."
  link="/everything-you-need-to-know-about-importing-a-car-to-panama/"
  readMoreText="read more"
/>
      <!-- Blog Post 6 -->
      <NewsCard
  imageSrc="https://www.internationalrelocationpartner.com/wp-content/uploads/2025/01/alex-knight-j4uuKnN43_M-unsplash-400x250.jpg"
  imageAlt="Moving Electronics Abroad: What You Need to Know"
  title="Moving Electronics Abroad: What You Need to Know"
  excerpt="Moving abroad comes with its fair share of challenges, and transporting your electronics safely is one of them. From laptops and gaming consoles to kitchen appliances and smart home devices, your..."
  link="/moving-electronics-abroad-what-you-need-to-know/"
  readMoreText="read more"
/>
      <!-- Blog Post 7 -->
      <NewsCard
  imageSrc="https://www.internationalrelocationpartner.com/wp-content/uploads/2025/02/Docuents-You-Need-to-Move-to-Spain-400x250.jpg"
  imageAlt="Documents You Need To Move To Spain"
  title="Documents You Need To Move To Spain"
  excerpt="Planning your move to Spain is an exciting time filled with new opportunities and experiences, but it also comes with a fair share of paperwork. Whether you’re relocating for work, retirement, or..."
  link="/documents-you-need-to-move-to-spain/"
  readMoreText="read more"
/>
      <!-- Blog Post 8 -->
      <NewsCard
  imageSrc="https://www.internationalrelocationpartner.com/wp-content/uploads/2025/02/Prohibited-Items-For-Moving-to-Portugal-400x250.jpg"
  imageAlt="10 Prohibited Items When You Move to Portugal"
  title="10 Prohibited Items When You Move to Portugal"
  excerpt="Moving to Portugal is an exciting journey filled with new opportunities and cultural experiences. However, like any international move, there are rules and regulations to follow when it comes to..."
  link="/10-prohibited-items-when-you-move-to-portugal/"
  readMoreText="read more"
/>
      <!-- Blog Post 9 -->
      <NewsCard
  imageSrc="https://www.internationalrelocationpartner.com/wp-content/uploads/2025/01/eva-darron-oCdVtGFeDC0-unsplash-400x250.jpg"
  imageAlt="How to Build a Support Network When Moving Alone"
  title="How to Build a Support Network When Moving Alone"
  excerpt="Moving abroad is an exciting adventure filled with opportunities for personal growth, exploration, and new experiences. However, if you’re making the move solo, it’s natural to feel a little..."
  link="/how-to-build-a-support-network-when-moving-alone/"
  readMoreText="read more"
/>
    </div>
    <div class="pagination">
      <a href="/news-updates/page/2/?et_blog">« Older Entries</a>
    </div>
  </section>
</CountryLayout>

<Footer />
