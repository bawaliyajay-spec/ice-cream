import { join } from "node:path";
import * as cheerio from "cheerio";
import {
  cleanCategory,
  ensureProductImage,
  fetchJson,
  fetchText,
  findExisting,
  loadExistingProducts,
  mapSheetalCategory,
  parseMrp,
  resolvePaths,
  slugify,
  sleep,
  type ExistingProduct,
  type ScrapedProduct,
} from "./scrape-utils";

const FOODWORLD = "https://sheetalfoodworld.com/products/";
const FOODWORLD_API = "https://sheetalfoodworld.com/wp-json/wp/v2/sheetal_product";
const FOODWORLD_MEDIA = "https://sheetalfoodworld.com/wp-json/wp/v2/media";
const CLASSIC = "https://www.sheetalicecream.com";

interface Draft {
  name: string;
  category: string;
  description: string;
  price: number | null;
  imageUrl: string;
  sourceUrl: string;
  bestseller?: boolean;
}

interface WpMedia {
  id: number;
  source_url: string;
  media_details?: {
    width?: number;
    height?: number;
    sizes?: Record<string, { source_url?: string; width?: number; height?: number }>;
  };
}

interface WpProduct {
  id: number;
  title: { rendered: string };
  link: string;
  featured_media: number;
  acf?: {
    product_short_description?: string;
    product_mrp?: string;
    product_badge?: string;
  };
  class_list?: string[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>;
  };
}

/** Classic Sheetal category pages with real product cards (name + description + image). */
const CLASSIC_CATEGORY_PAGES: Array<{ category: string; urls: string[] }> = [
  {
    category: "Candies, Dollies & Bars",
    urls: [`${CLASSIC}/ice-candy/`, `${CLASSIC}/chocobar/`, `${CLASSIC}/dolly/`],
  },
  { category: "Cones", urls: [`${CLASSIC}/cones/`] },
  {
    category: "Cups",
    urls: [
      `${CLASSIC}/cups/`,
      `${CLASSIC}/big-cup-100ml/`,
      `${CLASSIC}/big-cup-80ml/`,
      `${CLASSIC}/small-cup-sheetal-ice-cream/`,
      `${CLASSIC}/naturals/`,
      `${CLASSIC}/ripple-special-ice-cream/`,
    ],
  },
  {
    category: "Kulfi",
    urls: [`${CLASSIC}/kulfi/`, `${CLASSIC}/premium-kulfi/`],
  },
  {
    category: "Novelties",
    urls: [`${CLASSIC}/novelties/`, `${CLASSIC}/kids-special-ice-cream/`],
  },
  { category: "Cakes & Pastries", urls: [`${CLASSIC}/cakes-pastries/`] },
  {
    category: "Take Home",
    urls: [`${CLASSIC}/take-home/`, `${CLASSIC}/party-pack/`, `${CLASSIC}/tub-ice-cream/`],
  },
  { category: "Sugar Free", urls: [`${CLASSIC}/sugar-free/`] },
  { category: "Gully Gola", urls: [`${CLASSIC}/gully-gola/`] },
];

function decodeHtml(raw: string): string {
  return cheerio.load(`<textarea>${raw}</textarea>`)("textarea").text();
}

function preferHttps(url: string): string {
  return url.replace(/^http:\/\//i, "https://");
}

function normalizeNameKey(name: string): string {
  return slugify(
    name
      .replace(/\bboltop\b/gi, "boll top")
      .replace(/\bboll top cone\b/gi, "boll top")
      .replace(/\bthender coconut\b/gi, "tender coconut")
      .replace(/\btripple sundae\b/gi, "triple sundae")
      .replace(/\btripple\b/gi, "triple")
      .replace(/\btutty fruity\b/gi, "tutti frutti")
      .replace(/\bvanila\b/gi, "vanilla")
      .replace(/\bchcolate\b/gi, "chocolate")
      .replace(/\bcookies\s*['’]?n['’]?\s*cream\b/gi, "cookies cream")
      .replace(/\bcookies cream\b/gi, "cookies cream")
      .replace(/\bkasmiri\b/gi, "kashmiri")
      .replace(/\bkalti\b/gi, "katli")
      .replace(/\bkatri\b/gi, "katli")
      .replace(/\bpastr\b/gi, "pastry")
      .replace(/\bimali\b/gi, "imli")
      .replace(/\bkalakhatta\b/gi, "kala khatta")
      .replace(/\bkachikeri\b/gi, "kachi keri")
      .replace(/\bkachi keri\b/gi, "kachi keri")
      .replace(/\bpaan masala ice\s*cream\b/gi, "paan masala icecream")
      .replace(/\([^)]*\)/g, "")
      .replace(/\b\d+\s*ml\b/gi, ""),
  );
}

function isJunkProductName(name: string, imageUrl: string): boolean {
  const n = name.trim();
  const u = imageUrl.toLowerCase();
  if (!n || n.length < 2) return true;
  if (/^(candy|novelty)\s*\d+$/i.test(n)) return true;
  if (
    /^(linked.?in|slider|facebook|instagram|youtube|twitter|menu|cross|scroll(\s*up)?|candies?\s*image|cones?\s*image|cups?\s*image)$/i.test(
      n,
    )
  )
    return true;
  if (/\b(slider|sidebar|main|copy|side|logo|banner|preloader|menu|yellow|scroll|cross)\b/i.test(n))
    return true;
  if (/\/(slider-|product_page\/|linked-in|facebook|instagram|themes\/sheetal\/images\/(?:menu|cross|scroll))/i.test(u))
    return true;
  if (/-(main|side|copy)\.(png|jpe?g|webp)$/i.test(u)) return true;
  if (/\/product_page\//i.test(u)) return true;
  if (/\/themes\/sheetal\/images\/(?:menu|cross|scroll|facebook|instagram|youtube|twitter|linked)/i.test(u))
    return true;
  if (/\/themes\/sheetal\/images\/[^/]+\.(png|jpe?g|webp)$/i.test(u) && !/\/(?:ice_candy|chocobar|dolly|cones|cups|kulfi|novelties|cakes|party-pack|premium-tubs|sugar-free|kids|special-bars|Big-Cup|Naturals|ripple|tub|gully)\//i.test(u)) {
    // Root theme images are almost always chrome, not products.
    if (!/chocolate_chips|tutti_frutti|kalakhatta|kachikeri/i.test(u)) return true;
  }
  return false;
}

function titleFromThemePath(url: string): string {
  const file = decodeURIComponent((url.split("/").pop() ?? "").replace(/\.[^.]+$/, ""));
  return file
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Prefer the largest available WP media size (HD). */
function largestMediaUrl(m: WpMedia): string {
  const candidates: Array<{ url: string; area: number }> = [];
  if (m.source_url) {
    candidates.push({
      url: m.source_url,
      area: (m.media_details?.width ?? 0) * (m.media_details?.height ?? 0),
    });
  }
  for (const size of Object.values(m.media_details?.sizes ?? {})) {
    if (!size?.source_url) continue;
    candidates.push({
      url: size.source_url,
      area: (size.width ?? 0) * (size.height ?? 0),
    });
  }
  candidates.sort((a, b) => b.area - a.area);
  return preferHttps(candidates[0]?.url || m.source_url);
}

/**
 * Classic product pages render cards as:
 *   <img src=".../themes/sheetal/images/.../Name.png">
 *   <p class="img__description"><span>Name</span>Description text</p>
 */
async function scrapeClassicCategoryPages(): Promise<Draft[]> {
  const drafts: Draft[] = [];
  const seen = new Set<string>();

  for (const entry of CLASSIC_CATEGORY_PAGES) {
    for (const pageUrl of entry.urls) {
      let html: string;
      try {
        html = await fetchText(pageUrl);
      } catch (err) {
        console.warn(`  ✗ Failed ${pageUrl}:`, err);
        continue;
      }

      const $ = cheerio.load(html);

      $("p.img__description").each((_, el) => {
        const block = $(el);
        const name = decodeHtml(block.find("span").first().text()).trim();
        if (!name) return;

        const description = decodeHtml(block.clone().children("span").remove().end().text()).trim();

        // Prefer nearest preceding product image in the same column/card.
        const container = block.closest("div.col-12, div.col-md-4, div.col-md-3, div._product_, div.row, div");
        let imageUrl =
          container.find("img[src*='/themes/sheetal/images/']").first().attr("src") ??
          block.parent().find("img[src*='/themes/sheetal/images/']").first().attr("src") ??
          block.parent().parent().find("img[src*='/themes/sheetal/images/']").first().attr("src") ??
          "";

        if (!imageUrl) {
          // Walk previous siblings for an image.
          let prev = block.parent().prev();
          for (let i = 0; i < 6 && prev.length; i += 1) {
            const src = prev.find("img[src*='/wp-content/']").first().attr("src") ?? prev.attr("src");
            if (src && /\/(themes\/sheetal\/images|uploads)\//i.test(src)) {
              imageUrl = src;
              break;
            }
            prev = prev.prev();
          }
        }

        if (!imageUrl) return;
        imageUrl = preferHttps(new URL(imageUrl, pageUrl).href);

        if (isJunkProductName(name, imageUrl)) return;

        const category = /sandwich/i.test(name) ? "Sandwich" : entry.category;

        const key = `${slugify(category)}::${slugify(name)}`;
        if (seen.has(key)) return;
        seen.add(key);

        drafts.push({
          name,
          category,
          description,
          price: null,
          imageUrl,
          sourceUrl: pageUrl,
        });
      });

      // Fallback: product-folder theme images that weren't paired with a description span.
      $("img[src*='/themes/sheetal/images/']").each((_, el) => {
        const src = $(el).attr("src");
        if (!src) return;
        const imageUrl = preferHttps(new URL(src, pageUrl).href);
        if (
          !/\/themes\/sheetal\/images\/(?:ice_candy|chocobar|dolly|cones|cups|kulfi|premium-kulfi|novelties|cakes-pastries|party-pack|premium-tubs|sugar-free|kids|special-bars|Big-Cup-100ml|Big-Cup-80ml|Naturals|ripple-special|tub)\//i.test(
            imageUrl,
          ) &&
          !/\/themes\/sheetal\/images\/(?:Chocolate_Chips|Tutti_Frutti|kalakhatta|kachikeri)\./i.test(
            imageUrl,
          )
        ) {
          return;
        }
        if (/-(side|main)\.(png|jpe?g|webp)$/i.test(imageUrl)) return;

        const name = titleFromThemePath(imageUrl);
        if (isJunkProductName(name, imageUrl)) return;

        const category = /sandwich/i.test(name) ? "Sandwich" : entry.category;

        const key = `${slugify(category)}::${slugify(name)}`;
        if (seen.has(key)) return;
        seen.add(key);

        drafts.push({
          name,
          category,
          description: "",
          price: null,
          imageUrl,
          sourceUrl: pageUrl,
        });
      });
    }
  }

  // Cookies sandwich lives in the WP uploads library (not a theme card).
  const sandwichUrl = `${CLASSIC}/wp-content/uploads/2019/10/Cookies-ice-cream-sandwich.png`;
  const sandwichKey = `${slugify("Sandwich")}::${slugify("Cookies Ice Cream Sandwich")}`;
  if (![...seen].some((k) => k.endsWith(`::${slugify("Cookies Ice Cream Sandwich")}`))) {
    drafts.push({
      name: "Cookies Ice Cream Sandwich",
      category: "Sandwich",
      description: "",
      price: null,
      imageUrl: sandwichUrl,
      sourceUrl: `${CLASSIC}/products/`,
    });
    seen.add(sandwichKey);
  }

  console.log(`  Sheetal classic category drafts: ${drafts.length}`);
  return drafts;
}

async function scrapeFoodworldCards(): Promise<Draft[]> {
  const html = await fetchText(FOODWORLD);
  const $ = cheerio.load(html);
  const drafts: Draft[] = [];
  const seen = new Set<string>();

  $("article[data-product-card]").each((_, el) => {
    const card = $(el);
    const segment = (card.attr("data-segment-name") ?? "").trim().toLowerCase();
    if (segment && segment !== "ice cream" && !segment.includes("ice cream")) return;

    const name = (card.attr("data-name") ?? "").trim();
    if (!name) return;
    const key = slugify(name);
    if (seen.has(key)) return;
    seen.add(key);

    const type = (card.attr("data-type") ?? "").trim();
    const imageUrl = (card.attr("data-image") ?? "").trim();
    if (!imageUrl) return;

    drafts.push({
      name,
      category: mapSheetalCategory(type, name),
      description: (card.attr("data-description") ?? "").trim(),
      price: parseMrp(card.attr("data-mrp") ?? ""),
      imageUrl,
      sourceUrl: FOODWORLD,
      bestseller: (card.attr("data-badge") ?? "").toLowerCase().includes("best"),
    });
  });

  return drafts;
}

async function scrapeFoodworldApi(existing: Set<string>): Promise<Draft[]> {
  let segmentId: number | null = null;
  try {
    const { data: segments } = await fetchJson<Array<{ id: number; slug: string; name: string }>>(
      "https://sheetalfoodworld.com/wp-json/wp/v2/product_segment?per_page=100",
    );
    segmentId =
      segments.find((s) => s.slug === "ice-cream" || /ice\s*cream/i.test(s.name))?.id ?? null;
  } catch {
    segmentId = null;
  }

  const url = segmentId
    ? `${FOODWORLD_API}?per_page=100&_embed&product_segment=${segmentId}`
    : `${FOODWORLD_API}?per_page=100&_embed`;

  const { data } = await fetchJson<WpProduct[]>(url);
  let products = Array.isArray(data) ? data : [];
  if (!segmentId) {
    products = products.filter((p) =>
      (p.class_list ?? []).some((c) => c.includes("product_segment-ice-cream")),
    );
  }

  const drafts: Draft[] = [];
  for (const p of products) {
    const name = decodeHtml(p.title?.rendered ?? "").trim();
    if (!name || existing.has(slugify(name))) continue;
    let imageUrl = p._embedded?.["wp:featuredmedia"]?.[0]?.source_url ?? "";
    if (!imageUrl && p.featured_media) {
      try {
        imageUrl = (await fetchJson<WpMedia>(`${FOODWORLD_MEDIA}/${p.featured_media}`)).data
          .source_url;
      } catch {
        imageUrl = "";
      }
    }
    if (!imageUrl) continue;

    const typeHint =
      (p.class_list ?? [])
        .find((c) => c.startsWith("product_type-"))
        ?.replace("product_type-", "") ?? "";
    drafts.push({
      name,
      category: mapSheetalCategory(typeHint.replace(/-/g, " "), name),
      description: (p.acf?.product_short_description ?? "").trim(),
      price: parseMrp(p.acf?.product_mrp ?? ""),
      imageUrl,
      sourceUrl: p.link || FOODWORLD,
      bestseller: (p.acf?.product_badge ?? "").toLowerCase().includes("best"),
    });
  }
  return drafts;
}

/** Apply Foodworld MRP onto classic products when names match. */
function applyFoodworldPrices(drafts: Draft[], priced: Draft[]): void {
  const byKey = new Map<string, number>();
  for (const p of priced) {
    if (p.price == null) continue;
    byKey.set(normalizeNameKey(p.name), p.price);
    byKey.set(slugify(p.name), p.price);
  }

  for (const d of drafts) {
    if (d.price != null) continue;
    const hit = byKey.get(normalizeNameKey(d.name)) ?? byKey.get(slugify(d.name));
    if (hit != null) d.price = hit;
  }
}

function dedupeDrafts(drafts: Draft[]): Draft[] {
  const byKey = new Map<string, Draft>();

  for (const d of drafts) {
    if (isJunkProductName(d.name, d.imageUrl)) continue;
    // Same flavour can exist in multiple categories (e.g. Chocolate Chips Gully Gola vs Take Home).
    const key = `${slugify(d.category)}::${normalizeNameKey(d.name)}`;
    const prev = byKey.get(key);
    if (!prev) {
      byKey.set(key, d);
      continue;
    }

    const score = (x: Draft) =>
      (x.price != null ? 8 : 0) +
      (x.description ? 4 : 0) +
      (/\/themes\/sheetal\/images\//i.test(x.imageUrl) ? 2 : 0) +
      Math.min(x.name.length, 40) / 40;
    if (score(d) > score(prev)) byKey.set(key, { ...d, price: d.price ?? prev.price });
    else if (prev.price == null && d.price != null) prev.price = d.price;
  }

  const values = [...byKey.values()];
  return values.filter((d) => {
    const lower = d.name.toLowerCase();
    const sameCat = values.filter((o) => o.category === d.category);
    return !sameCat.some(
      (other) =>
        other.name.toLowerCase() !== lower && other.name.toLowerCase().startsWith(lower + " "),
    );
  });
}

export async function scrapeSheetal(
  root: string,
  existing: Map<string, ExistingProduct> = loadExistingProducts(
    resolvePaths(root).jsonPath,
  ),
): Promise<ScrapedProduct[]> {
  const { imagesDir, publicDir } = resolvePaths(root);

  console.log("  Sheetal: classic category product pages…");
  const classic = await scrapeClassicCategoryPages();

  console.log("  Sheetal: foodworld product cards (MRP)…");
  const foodworld = await scrapeFoodworldCards();
  const fwNames = new Set(foodworld.map((d) => slugify(d.name)));

  console.log("  Sheetal: foodworld API…");
  const apiDrafts = await scrapeFoodworldApi(fwNames);

  const pricedSources = [...foodworld, ...apiDrafts];
  applyFoodworldPrices(classic, pricedSources);

  // Include foodworld-only ice creams not already on classic pages.
  const classicKeys = new Set(classic.map((d) => normalizeNameKey(d.name)));
  const extras = pricedSources.filter((d) => !classicKeys.has(normalizeNameKey(d.name)));

  const filtered = dedupeDrafts([...classic, ...extras]);
  console.log(`  Sheetal drafts before download: ${filtered.length}`);

  const out: ScrapedProduct[] = [];
  const seenIds = new Set<string>();
  let skippedDownloads = 0;
  let newDownloads = 0;

  for (const draft of filtered) {
    const category = cleanCategory(draft.category) || "Other";
    const id = `sheetal-${slugify(category)}-${slugify(draft.name)}`;
    if (seenIds.has(id)) continue;
    seenIds.add(id);

    const prev = findExisting(existing, id, "Sheetal", draft.name);

    try {
      const destBase = join(imagesDir, "sheetal", `${slugify(category)}-${slugify(draft.name)}`);
      const { image, downloaded } = await ensureProductImage({
        publicDir,
        imageUrl: draft.imageUrl,
        destPathWithoutExt: destBase,
        prev,
      });

      if (downloaded) newDownloads += 1;
      else skippedDownloads += 1;

      out.push({
        id,
        name: draft.name,
        brand: "Sheetal",
        category,
        description: draft.description,
        slogan: draft.bestseller ? "Bestseller" : "",
        price: draft.price,
        image,
        hide: false,
        sourceUrl: draft.sourceUrl,
      });
      console.log(
        `  ${downloaded ? "↓" : "↷"} Sheetal [${category}]: ${draft.name}${
          draft.price != null ? ` · ₹${draft.price}` : ""
        }`,
      );
      if (downloaded) await sleep(40);
    } catch (err) {
      console.warn(`  ✗ Sheetal image failed for ${draft.name}:`, err);
    }
  }

  console.log(
    `  Sheetal images: ${newDownloads} downloaded, ${skippedDownloads} reused (skipped re-fetch)`,
  );
  return out;
}

if (import.meta.main) {
  const root = process.cwd();
  const products = await scrapeSheetal(root);
  console.log(`Scraped ${products.length} Sheetal products`);
}
