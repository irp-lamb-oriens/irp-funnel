/**
 * Node.js script using Puppeteer to get dynamic HTML, then Cheerio to parse and extract news article images.
 * 
 * Usage:
 *   1. npm install puppeteer cheerio node-fetch
 *   2. node irp-funnel/scripts/download_news_images_puppeteer_cheerio.js
 */

const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://www.internationalrelocationpartner.com';
const NEWS_URL = BASE_URL + '/news-updates/';
const IMGS_DIR = path.join(__dirname, '../../IMGS');

function sanitizeFilename(name) {
  return name.replace(/[\/\\?%*:|"<>]/g, '').trim().replace(/\s+/g, '_');
}

async function ensureDirExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

async function downloadImage(url, filepath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  const arr = await res.buffer();
  fs.writeFileSync(filepath, arr);
}

function extractImageUrl(bg) {
  if (!bg) return null;
  const match = bg.match(/url\((['"]?)(.*?)\1\)/);
  if (match && match[2]) return match[2];
  return null;
}

async function main() {
  await ensureDirExists(IMGS_DIR);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  let pageUrl = NEWS_URL;
  let pageNum = 1;
  while (pageUrl) {
    console.log(`Processing page: ${pageUrl}`);
    await page.goto(pageUrl, { waitUntil: 'networkidle2' });

    // Wait for articles to render
    await page.waitForTimeout(2000);

    // Get the full HTML after JS has rendered
    const html = await page.content();
    const $ = cheerio.load(html);

    // Try the provided selector for article links
    let links = [];
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
        const article = await browser.newPage();
        await article.goto(link, { waitUntil: 'networkidle2' });
        await article.waitForTimeout(2000);
        const articleHtml = await article.content();
        const $article = cheerio.load(articleHtml);

        const h1 = $article("h1").first().text() || "untitled";
        const title = sanitizeFilename(h1);

        // Try to find .et_pb_with_background and get background-image from style attribute
        let bgImage = null;
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
          await article.close();
          continue;
        }

        const outPath = path.join(IMGS_DIR, `${title}.png`);
        await downloadImage(imgUrl, outPath);
        console.log(`Downloaded: ${outPath}`);
        await article.close();
      } catch (e) {
        console.error(`Error processing ${link}:`, e);
      }
    }

    // Find the "Older Entries" pagination link
    let nextPage = null;
    $("a").each((_, el) => {
      const text = $(el).text();
      if (text.includes("Older Entries")) {
        const href = $(el).attr("href");
        if (href && href !== pageUrl) {
          nextPage = href.startsWith("http") ? href : BASE_URL + href;
        }
      }
    });

    if (nextPage && nextPage !== pageUrl) {
      pageUrl = nextPage;
      pageNum++;
    } else {
      pageUrl = null;
    }
  }

  await browser.close();
}

main();
