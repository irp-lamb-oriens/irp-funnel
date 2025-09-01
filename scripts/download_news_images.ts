/// <reference lib="deno.ns" />
// Deno script to download background images from news articles

/**
 * Steps:
 * 1. Fetch main news page
 * 2. For each h2 > a, visit the link
 * 3. On each page, extract h1 innerText and .et_pb_with_background background-image
 * 4. If background-image contains url(), extract the image URL
 * 5. Download the image to /IMGS, naming it as h1 innerText.png
 * 6. Create /IMGS if it doesn't exist
 * 7. Skip if no image
 */

import { DOMParser, Element } from "https://deno.land/x/deno_dom/deno-dom-wasm.ts";

const BASE_URL = "https://www.internationalrelocationpartner.com";
const NEWS_URL = BASE_URL + "/news-updates/";
const IMGS_DIR = "./IMGS";

async function ensureDirExists(dir: string) {
  try {
    await Deno.mkdir(dir, { recursive: true });
  } catch (e) {
    if (e && e instanceof Deno.errors.AlreadyExists) return;
    throw e;
  }
}

function sanitizeFilename(name: string): string {
  // Remove invalid filename characters, trim, and replace spaces with underscores
  return name.replace(/[\/\\?%*:|"<>]/g, "").trim().replace(/\s+/g, "_");
}

function extractImageUrl(bg: string | null): string | null {
  if (!bg) return null;
  // Match url("...") or url('...') or url(...)
  const match = bg.match(/url\((['"]?)(.*?)\1\)/);
  if (match && match[2]) {
    return match[2];
  }
  return null;
}

async function fetchDocument(url: string) {
  const res = await fetch(url);
  const html = await res.text();
  return new DOMParser().parseFromString(html, "text/html");
}

async function main() {
  await ensureDirExists(IMGS_DIR);

  const doc = await fetchDocument(NEWS_URL);
  if (!doc) {
    console.error("Failed to parse main news page.");
    return;
  }

  const links = Array.from(doc.querySelectorAll("h2 > a")) as Element[];
  for (const a of links) {
    const href = a.getAttribute("href");
    if (!href) continue;
    const url = href.startsWith("http") ? href : BASE_URL + href;

    try {
      const page = await fetchDocument(url);
      if (!page) continue;

      const h1 = page.querySelector("h1");
      if (!h1) continue;
      const title = sanitizeFilename(h1.textContent || "untitled");

      const bgElem = page.querySelector(".et_pb_with_background") as Element | null;
      if (!bgElem) continue;

      const style = bgElem.getAttribute("style");
      let bgImage: string | null = null;
      if (style) {
        // Try to extract background-image from inline style
        const match = style.match(/background-image\s*:\s*([^;]+);?/);
        if (match) bgImage = match[1];
      }
      // If not in style, try computed style (not available in static HTML, so skip)

      const imgUrl = extractImageUrl(bgImage);
      if (!imgUrl) continue;

      // Download image
      const imgRes = await fetch(imgUrl);
      if (!imgRes.ok) continue;
      const imgArray = new Uint8Array(await imgRes.arrayBuffer());
      const outPath = `${IMGS_DIR}/${title}.png`;
      await Deno.writeFile(outPath, imgArray);
      console.log(`Downloaded: ${outPath}`);
    } catch (e) {
      console.error(`Error processing ${href}:`, e);
    }
  }
}

if (import.meta.main) {
  main();
}
