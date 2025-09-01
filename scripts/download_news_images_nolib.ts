/**
 * Deno script to download news article background images with NO external libraries.
 * Now supports extracting background-image URLs from CSS (in <style> tags or external CSS).
 * Improved: Continues processing all articles even if some images are missing, and paginates using the specific selector.
 * 
 * Usage:
 *   deno run --allow-net --allow-write irp-funnel/scripts/download_news_images_nolib.ts
 */

const BASE_URL = "https://www.internationalrelocationpartner.com";
const NEWS_URL = BASE_URL + "/news-updates/";
const IMGS_DIR = "./IMGS";

function sanitizeFilename(name) {
  return name.replace(/[\/\\?%*:|"<>]/g, "").trim().replace(/\s+/g, "_");
}

async function ensureDirExists(dir) {
  try {
    await Deno.mkdir(dir, { recursive: true });
  } catch (e) {
    if (e && e instanceof Deno.errors.AlreadyExists) return;
    throw e;
  }
}

function extractLinks(html) {
  // Very basic regex for <a href="..."> in h2
  const re = /<h2[^>]*>\s*<a\s+href="([^"]+)"/g;
  const links = [];
  let match;
  while ((match = re.exec(html))) {
    links.push(match[1].startsWith("http") ? match[1] : BASE_URL + match[1]);
  }
  return links;
}

function extractH1(html) {
  const match = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  return match ? match[1].replace(/<[^>]+>/g, "").trim() : "untitled";
}

function extractBgImageFromStyleTag(html, selector) {
  // Find all <style>...</style> blocks
  const styleBlocks = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map(m => m[1]);
  for (const css of styleBlocks) {
    const url = extractBgImageFromCss(css, selector);
    if (url) return url;
  }
  return null;
}

function extractBgImageFromCss(css, selector) {
  // Find the CSS rule for the selector
  // e.g. div.et_pb_section.et_pb_section_0_tb_body
  const re = new RegExp(`${selector}\\s*{[^}]*background-image\\s*:\\s*([^;]+);`, "i");
  const match = css.match(re);
  if (!match) return null;
  // Extract url(...)
  const urlMatch = match[1].match(/url\((['"]?)(.*?)\1\)/);
  return urlMatch ? urlMatch[2] : null;
}

function extractExternalCssLinks(html) {
  // Find all <link rel="stylesheet" href="...">
  const re = /<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/gi;
  const links = [];
  let match;
  while ((match = re.exec(html))) {
    links.push(match[1].startsWith("http") ? match[1] : BASE_URL + match[1]);
  }
  return links;
}

async function downloadImage(url, filepath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
  const arr = new Uint8Array(await res.arrayBuffer());
  await Deno.writeFile(filepath, arr);
}

function extractPaginationHref(html) {
  // Extract href from the specific selector for "Older Entries"
  // #post-138 > div > div > div > div.et_pb_section.et_pb_section_1.et_section_regular > div > div > div.et_pb_module.et_pb_blog_0.blog-posts.pa-blog-equal-height.et_pb_blog_grid_wrapper.et_pb_bg_layout_light > div > div > div:nth-child(2) > div > div.alignleft > a
  // We'll use a regex to match the first <a ... href="..."> inside .alignleft
  const re = /<div[^>]*class="[^"]*alignleft[^"]*"[^>]*>[\s\S]*?<a[^>]+href="([^"]+)"/i;
  const match = html.match(re);
  if (match) {
    return match[1].startsWith("http") ? match[1] : BASE_URL + match[1];
  }
  return null;
}

async function main() {
  await ensureDirExists(IMGS_DIR);

  let pageUrl = NEWS_URL;
  let pageNum = 1;
  while (pageUrl) {
    console.log(`Processing page: ${pageUrl}`);
    const res = await fetch(pageUrl);
    const html = await res.text();

    const links = extractLinks(html);

    for (const link of links) {
      try {
        const resA = await fetch(link);
        const htmlA = await resA.text();
        const h1 = sanitizeFilename(extractH1(htmlA));

        // Try to extract from <style> tags first
        const selector = "div.et_pb_section.et_pb_section_0_tb_body";
        let imgUrl = extractBgImageFromStyleTag(htmlA, selector);

        // If not found, try external CSS files
        if (!imgUrl) {
          const cssLinks = extractExternalCssLinks(htmlA);
          for (const cssUrl of cssLinks) {
            try {
              const cssRes = await fetch(cssUrl);
              const cssText = await cssRes.text();
              imgUrl = extractBgImageFromCss(cssText, selector);
              if (imgUrl) break;
            } catch (e) {
              // Ignore CSS fetch errors
            }
          }
        }

        if (!imgUrl) {
          console.log(`No image found for: ${h1}`);
        } else {
          const outPath = `${IMGS_DIR}/${h1}.png`;
          await downloadImage(imgUrl, outPath);
          console.log(`Downloaded: ${outPath}`);
        }
      } catch (e) {
        console.error(`Error processing ${link}:`, e);
      }
    }

    // Use the specific selector for pagination
    const nextPageHref = extractPaginationHref(html);
    if (nextPageHref && nextPageHref !== pageUrl) {
      pageUrl = nextPageHref;
      pageNum++;
    } else {
      pageUrl = null;
    }
  }
}

if (import.meta.main) {
  main();
}

/**
 * NOTE:
 * - This script is 100% library-free and works in Deno with no imports.
 * - It will NOT work for dynamic (JS-rendered) content.
 * - For dynamic content, you MUST use a browser automation tool (Puppeteer, Playwright, Selenium, etc.).
 * - Now supports extracting background-image URLs from CSS rules in <style> tags or external CSS.
 * - Pagination now uses the specific selector for the "Older Entries" button.
 * - Continues processing all articles on a page, even if some images are missing.
 */
