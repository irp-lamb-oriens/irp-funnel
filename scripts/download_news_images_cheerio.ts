/**
 * Deno script to download news article background images using Cheerio (via esm.sh)
 * 
 * Limitations:
 * - This script only works for static HTML. It will NOT work for sites that load content via JavaScript (like the target site).
 * - For dynamic sites, use a headless browser (Puppeteer/Playwright).
 * 
 * Usage:
 *   deno run --allow-net --allow-write irp-funnel/scripts/download_news_images_cheerio.ts
 */

import cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";

const BASE_URL = "https://www.internationalrelocationpartner.com";
const NEWS_URL = BASE_URL + "/news-updates/";
const IMGS_DIR = "./IMGS";

function sanitizeFilename(name: string): string {
  return name.replace(/[\/\\?%*:|"<>]/g, "").trim().replace(/\s+/g, "_");
}

async function ensureDirExists(dir: string) {
  try {
    await Deno.mkdir(dir, { recursive: true });
  } catch (e) {
    if (e && e instanceof Deno.errors.AlreadyExists) return;
    throw e;
  }
}

function extractImageUrl(bg: string | null): string | null {
  if (!bg) return null;
  const match = bg.match(/url\((['"]?)(.*?)\1\)/);
  if (match && match[2]) return match[2];
  return null;
}

async function downloadImage(url: string, filepath: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  const arr = new Uint8Array(await res.arrayBuffer());
  await Deno.writeFile(filepath, arr);
}

async function fetchAndParse(url: string) {
  const res = await fetch(url);
  const html = await res.text();
  return cheerio.load(html);
}

async function main() {
  await ensureDirExists(IMGS_DIR);

  let pageUrl = NEWS_URL;
  let pageNum = 1;
  while (pageUrl) {
    console.log(`Processing page: ${pageUrl}`);
    const $ = await fetchAndParse(pageUrl);

    // Try the provided selector for article links
    let links: string[] = [];
    $(
      "div > div > div > div.et_pb_section.et_pb_section_1.et_section_regular > div > div > div.et_pb_module.et_pb_blog_0.blog-posts.pa-blog-equal-height.et_pb_blog_grid_wrapper.et_pb_bg_layout_light > div > div > div:nth-child(2) > div > div.alignleft > a"
    ).each((_, el) => {
      const href = $(el).attr("href");
      if (href) links.push(href.startsWith("http") ? href : BASE_URL + href);
    });

    // Fallback: all h2 > a
    if (links.length === 0) {
      $("h2 > a").each((_, el) => {
        const href = $(el).attr("href");
        if (href) links.push(href.startsWith("http") ? href : BASE_URL + href);
      });
    }

    for (const link of links) {
      try {
        const $article = await fetchAndParse(link);
        const h1 = $article("h1").first().text() || "untitled";
        const title = sanitizeFilename(h1);

        // Try to find .et_pb_with_background and get background-image from style attribute
        let bgImage: string | null = null;
        $article(".et_pb_with_background").each((_, el) => {
          const style = $article(el).attr("style");
          if (style) {
            const match = style.match(/background-image\s*:\s*([^;]+);?/);
            if (match) bgImage = match[1];
          }
        });

        const imgUrl = extractImageUrl(bgImage);
        if (!imgUrl) {
          console.log(`No image found for: ${title}`);
          continue;
        }

        const outPath = `${IMGS_DIR}/${title}.png`;
        await downloadImage(imgUrl, outPath);
        console.log(`Downloaded: ${outPath}`);
      } catch (e) {
        console.error(`Error processing ${link}:`, e);
      }
    }

    // Find the "Older Entries" pagination link
    const nextPage = $(
      "a[href*='news-updates/page/'][rel='prev'], a:contains('Older Entries')"
    )
      .filter((_, el) => $(el).text().includes("Older Entries"))
      .attr("href");

    if (nextPage && nextPage !== pageUrl) {
      pageUrl = nextPage.startsWith("http") ? nextPage : BASE_URL + nextPage;
      pageNum++;
    } else {
      pageUrl = null;
    }
  }
}

if (import.meta.main) {
  main();
}
