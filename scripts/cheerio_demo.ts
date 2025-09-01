/**
 * Minimal Cheerio usage in Deno via esm.sh
 * 
 * Run with:
 *   deno run --allow-net irp-funnel/scripts/cheerio_demo.ts
 */

import cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const url = "https://example.com"; // Replace with your target URL

const res = await fetch(url);
const html = await res.text();

const $ = cheerio.load(html);

// Example: print all h1 texts
$("h1").each((_, el) => {
  console.log($(el).text());
});

/**
 * Note:
 * - Cheerio only parses static HTML. It cannot execute JavaScript or see dynamically loaded content.
 * - For sites that load content via JS (like https://www.internationalrelocationpartner.com/news-updates/), Cheerio will not see the articles.
 * - For dynamic sites, use a headless browser (Puppeteer/Playwright) instead.
 */
