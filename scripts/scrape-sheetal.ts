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
  titleFromFilename,
  type ExistingProduct,
  type ScrapedProduct,
} from "./scrape-utils";

const FOODWORLD = "https://sheetalfoodworld.com/products/";
const CLASSIC = "https://www.sheetalicecream.com/products/";
const CLASSIC_MEDIA = "https://www.sheetalicecream.com/wp-json/wp/v2/media";
const FOODWORLD_API = "https://sheetalfoodworld.com/wp-json/wp/v2/sheetal_product";
const FOODWORLD_MEDIA = "https://sheetalfoodworld.com/wp-json/wp/v2/media";

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
  alt_text?: string;
  title?: { rendered?: string };
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
    product_pack_size?: string;
  };
  class_list?: string[];
  _embedded?: {
    "wp:featuredmedia"?: Array<{ source_url?: string }>;
  };
}

function decodeHtml(raw: string): string {
  return cheerio.load(`<textarea>${raw}</textarea>`)("textarea").text();
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
  // Resolve Ice Cream segment id, then pull those products (with featured images).
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

async function scrapeClassicProductsPage(existing: Set<string>): Promise<Draft[]> {
  const html = await fetchText(CLASSIC);
  const $ = cheerio.load(html);
  const drafts: Draft[] = [];

  // Category slider tiles (category labels)
  const categoryByAlt: Record<string, string> = {
    "gully gola": "Gully Gola",
    "take home": "Take Home",
    "sugar free": "Sugar Free",
    novelties: "Novelties",
    "cakes & pastries": "Cakes & Pastries",
    "cakes &#038; pastries": "Cakes & Pastries",
    kulfi: "Kulfi",
    "candies, dollies & bars": "Candies, Dollies & Bars",
    "candies, dollies &#038; bars": "Candies, Dollies & Bars",
    cones: "Cones",
    cups: "Cups",
  };

  // Featured / named product images on the page (not category tiles / chrome)
  $("img").each((_, el) => {
    const img = $(el);
    const src = img.attr("src")?.trim();
    if (!src) return;
    if (!/uploads\//i.test(src)) return;
    if (/slider-|logo|banner|favicon|pattern|wave|circle|pre-load|product.listing|product_banner|half-cone-product/i.test(src))
      return;

    const alt = decodeHtml((img.attr("alt") ?? "").trim());
    const altKey = alt.toLowerCase();
    if (altKey && categoryByAlt[altKey]) return; // category tile

    let name = alt;
    if (!name || /circle|pattern|logo|banner/i.test(name)) {
      name = titleFromFilename(src.split("/").pop() ?? "");
    }
    if (!name || /^(Circle Pattern|Product Listing Title)$/i.test(name)) return;
    if (existing.has(slugify(name)) || drafts.some((d) => slugify(d.name) === slugify(name))) return;

    drafts.push({
      name,
      category: mapSheetalCategory("", name),
      description: "",
      price: null,
      imageUrl: new URL(src, CLASSIC).href,
      sourceUrl: CLASSIC,
    });
  });

  return drafts;
}

async function scrapeClassicMediaLibrary(existing: Set<string>): Promise<Draft[]> {
  const drafts: Draft[] = [];
  let page = 1;

  const skipName =
    /logo|slider|banner|favicon|pre-load|pattern|wave|icon|menu|facebook|instagram|youtube|twitter|linkedin|cross|scroll|purple|yellow|circle|franchise|notice|agm|book|code-of|disclosure|about-image|owner|sysmbol|map-india|contact|career|investor|joyfulness|milk.of.taste|artboard|all.product|product.listing|half.cone|side|sidebar|main$|content|submit|preloader|^cups$|^cones$|^novelties$|^kulfi$|^candies|^take.home|^sugar.free|^gully|^cakes/i;

  while (page <= 10) {
    const { data, headers } = await fetchJson<WpMedia[]>(
      `${CLASSIC_MEDIA}?per_page=100&page=${page}&media_type=image`,
    );
    if (!Array.isArray(data) || data.length === 0) break;

    for (const m of data) {
      const src = m.source_url ?? "";
      if (!/\.(png|jpe?g|webp)$/i.test(src)) continue;
      if (skipName.test(src)) continue;

      const title = decodeHtml(m.title?.rendered ?? "").trim();
      const alt = decodeHtml(m.alt_text ?? "").trim();
      let name = alt || title;
      if (!name) name = titleFromFilename(src.split("/").pop() ?? "");
      if (!name || skipName.test(name)) continue;
      // Skip vague numbered assets like "1", "23"
      if (/^\d+$/.test(name.trim())) continue;
      if (/^Candy\s*\d+$/i.test(name)) {
        // Keep candy numbered items under Candies category with clearer name
        name = `Candy ${name.replace(/\D/g, "")}`;
      }

      const key = slugify(name);
      if (existing.has(key) || drafts.some((d) => slugify(d.name) === key)) continue;

      drafts.push({
        name,
        category: mapSheetalCategory("", name),
        description: "",
        price: null,
        imageUrl: preferHttps(src),
        sourceUrl: CLASSIC,
      });
    }

    const total = Number(headers.get("X-WP-Total") ?? 0);
    if (total && page * 100 >= total) break;
    page += 1;
  }

  return drafts;
}

async function scrapeFoodworldNamedMedia(existing: Set<string>): Promise<Draft[]> {
  const drafts: Draft[] = [];
  let page = 1;
  const skip =
    /logo|banner|whatsapp|chatgpt|screenshot|certificate|award|blog|print|djbs|cotton.candy.thamb|financial|adani|bse|nse|mou|opportunity|new.project|img-0|chilfuncer|hero|ice-creamcol|^ice.?cream$|^cups$|^cones$|^novelties$/i;

  while (page <= 20) {
    const { data, headers } = await fetchJson<WpMedia[]>(
      `${FOODWORLD_MEDIA}?per_page=100&page=${page}&media_type=image`,
    );
    if (!Array.isArray(data) || data.length === 0) break;

    for (const m of data) {
      const src = m.source_url ?? "";
      const title = decodeHtml(m.title?.rendered ?? "").trim();
      if (!title || skip.test(title) || skip.test(src)) continue;

      const isNoveltySeries = /sheetal\s*novet/i.test(title);
      const looksProduct =
        isNoveltySeries ||
        /cone|kulfi|cup|sundae|mango|jamun|custard|coconut|bastani|nuts|sandwich|candy|dolly|bar|tub|ice.?cream|alphonso|authentik|tripple|triple/i.test(
          title,
        );
      if (!looksProduct) continue;
      // Skip SKU-like / asset dump names
      if (/^\d/.test(title) || /_1-sheetal|sheetal-milk/i.test(title)) continue;

      let name = title
        .replace(/\s*Cone\d*$/i, "")
        .replace(/\s+\d+$/g, "")
        .trim();
      if (isNoveltySeries) {
        const num = title.match(/(\d+)/)?.[1];
        if (!num) continue;
        name = `Novelty ${num}`;
      }
      if (!name || name.length < 3) continue;

      const key = slugify(name);
      if (existing.has(key) || drafts.some((d) => slugify(d.name) === key)) continue;

      drafts.push({
        name,
        category: isNoveltySeries ? "Novelties" : mapSheetalCategory("", name),
        description: "",
        price: null,
        imageUrl: preferHttps(src),
        sourceUrl: FOODWORLD,
      });
    }

    const total = Number(headers.get("X-WP-Total") ?? 0);
    if (total && page * 100 >= total) break;
    page += 1;
  }

  return drafts;
}

function preferHttps(url: string): string {
  return url.replace(/^http:\/\//i, "https://");
}

export async function scrapeSheetal(
  root: string,
  existing: Map<string, ExistingProduct> = loadExistingProducts(
    resolvePaths(root).jsonPath,
  ),
): Promise<ScrapedProduct[]> {
  const { imagesDir, publicDir } = resolvePaths(root);

  console.log("  Sheetal: foodworld product cards…");
  const foodworld = await scrapeFoodworldCards();
  const names = new Set(foodworld.map((d) => slugify(d.name)));

  console.log("  Sheetal: foodworld API…");
  const apiDrafts = await scrapeFoodworldApi(names);
  for (const d of apiDrafts) names.add(slugify(d.name));

  console.log("  Sheetal: classic products page…");
  const classicPage = await scrapeClassicProductsPage(names);
  for (const d of classicPage) names.add(slugify(d.name));

  console.log("  Sheetal: classic media library…");
  const classicMedia = await scrapeClassicMediaLibrary(names);
  for (const d of classicMedia) names.add(slugify(d.name));

  console.log("  Sheetal: foodworld named media…");
  const fwMedia = await scrapeFoodworldNamedMedia(names);

  const drafts = [...foodworld, ...apiDrafts, ...classicPage, ...classicMedia, ...fwMedia];

  // Drop truncated duplicates (e.g. "Boll Top" when "Boll Top Cone" exists)
  const nameSet = new Set(drafts.map((d) => d.name.toLowerCase()));
  const filtered = drafts.filter((d) => {
    const lower = d.name.toLowerCase();
    for (const other of nameSet) {
      if (other !== lower && other.startsWith(lower + " ")) return false;
    }
    return true;
  });

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
        `  ${downloaded ? "↓" : "↷"} Sheetal [${category}]: ${draft.name}${prev ? " (existing)" : ""}${
          prev && draft.price !== null && prev.price !== draft.price
            ? ` · price ${prev.price ?? "—"} → ${draft.price}`
            : ""
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
