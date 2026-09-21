/**
 * reviews.ts — Shared Google review data for client testimonials.
 * ---------------------------------------------------------------------------
 * Single source of truth for the review cards shown on the homepage and the
 * relocation-tours page. Kept in lib so any surface (homepage, tour, quote
 * builder) renders the same customer voice without drifting out of sync.
 */

export interface Review {
  name: string;
  route: string;
  quote: string;
  link: string;
}

export const googleReviews: Review[] = [
  {
    name: 'Teresa Health',
    route: 'Dallas, Texas → Costa Rica',
    quote:
      'IRP has been amazing. We had questions and anxiety about shipping overseas. Everyone was kind and informative, and they answered every question from the start. Everything arrived in perfect condition.',
    link: 'https://share.google/0a6xZdtS4QdGtPZrH',
  },
  {
    name: 'Cathy Hilborn',
    route: 'International move to Costa Rica',
    quote:
      'Pablo and his team were professional, knowledgeable, and incredibly patient. He even made a long trip to personally obtain our temporary vehicle plate so we could get on the road as soon as we arrived.',
    link: 'https://share.google/RBtpbRj51cJEwTWCn',
  },
  {
    name: 'John Daly',
    route: 'Costa Rica → Boquete, Panama',
    quote:
      'A seamless process from pickup in Atenas through customs clearance and delivery. They use AI to video your boxes and build the packing list. Packed and unpacked with care.',
    link: 'https://share.google/faQbqam5bG87ZlgZZ',
  },
  {
    name: 'Jeanne Fuqua',
    route: 'Indianapolis, Indiana → Portimão, Portugal',
    quote:
      'Our household items were packed with care, with punctual arrival times and courteous team members. Outstanding communication and clear explanations on import fees and taxes.',
    link: 'https://share.google/i3tnBKcxBcihOoJm8',
  },
  {
    name: 'Angela Hryniuk',
    route: 'Australia → Guanacaste, Costa Rica',
    quote:
      'From the day the truck wrapped our things until the last box was unloaded, communication was excellent. They handled our goods with care and were upfront with all costs.',
    link: 'https://share.google/YVjrs9L4hkstr6Yr5',
  },
  {
    name: 'Debbie Keller',
    route: 'Costa Rica → Boquete, Panama',
    quote:
      'This was our second move with this company. The moving crew is so helpful, and this move was just as smooth as the last one.',
    link: 'https://share.google/6VzDIRwHo5VlJpRR5',
  },
  {
    name: 'Anita',
    route: 'Relocation assistance',
    quote:
      'Your information was invaluable. I truly appreciated the perspectives you offered, and I would recommend you to anyone in need of relocation assistance.',
    link: 'https://share.google/YCdyFNmWQ0TSR2Wg1',
  },
  {
    name: 'Christine George Wray',
    route: 'International move',
    quote:
      'Extremely well-coordinated and organized. Everyone was polite, efficient, and knowledgeable. Marjorie, our coordinator, was a gem.',
    link: 'https://share.google/6XLxrgPipcCYn0BIg',
  },
  {
    name: 'Blake Sturcke',
    route: 'United States → Costa Rica',
    quote:
      'Once we connected with Pablo and his team, we were sure we had found a great group. Our household goods and our car arrived exactly as we had last seen them.',
    link: 'https://share.google/JSpDa8WQvg2RbdR6D',
  },
];