/**
 * Enrich catalog with retail prices for EVERY product.
 *
 * Priority:
 * 1) Sheetal Foodworld official MRP (exact name)
 * 2) BigBasket listed MRP (Vadilal, name + pack-format match)
 * 3) Category retail median from matched items, else known India retail MRP bands
 *
 * Prices are stored as whole rupees (number) uniformly.
 */
import {
  fetchJson,
  fetchText,
  loadExistingProducts,
  parseMrp,
  resolvePaths,
  slugify,
  writeProductsJson,
  type ScrapedProduct,
} from "./scrape-utils";

const FOODWORLD_API = "https://sheetalfoodworld.com/wp-json/wp/v2/sheetal_product?per_page=100";
const JINA = "https://r.jina.ai/";

interface PriceHit {
  brand: "Vadilal" | "Sheetal";
  title: string;
  price: number;
  source: string;
  categoryHint?: string;
}

/** Typical India retail MRP by brand + category when no exact listing is found. */
const RETAIL_DEFAULTS: Record<string, number> = {
  // Vadilal
  "vadilal::badabite ice cream candy": 50,
  "vadilal::chocolate candies": 30,
  "vadilal::cones": 40,
  "vadilal::consumer bulk packs": 200,
  "vadilal::cool-fi": 50,
  "vadilal::cup treats": 40,
  "vadilal::dollies": 50,
  "vadilal::flingo ice cream cone": 50,
  "vadilal::frootful": 40,
  "vadilal::gourmet cups": 50,
  "vadilal::gourmet natural kulfi": 60,
  "vadilal::gourmet natural tubs": 250,
  "vadilal::gourmet tubs": 250,
  "vadilal::ice cream cakes": 300,
  "vadilal::ice trooper ice cream": 40,
  "vadilal::jumbo ice cream cups": 30,
  "vadilal::kulfies": 45,
  "vadilal::no sugar ice cream cups": 50,
  "vadilal::novelties": 60,
  "vadilal::other": 50,
  "vadilal::party packs": 300,
  "vadilal::shrikhand": 115,
  "vadilal::sundae cups": 40,
  "vadilal::sundae spin": 40,
  // Sheetal
  "sheetal::cakes & pastries": 300,
  "sheetal::candies, dollies & bars": 25,
  "sheetal::cones": 60,
  "sheetal::cups": 40,
  "sheetal::gully gola": 20,
  "sheetal::kulfi": 45,
  "sheetal::novelties": 60,
  "sheetal::other": 40,
  "sheetal::sandwich": 40,
  "sheetal::sugar free": 80,
  "sheetal::take home": 200,
};

function decodeHtml(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function formatTags(input: string): Set<string> {
  const tags = new Set<string>();
  const s = input.toLowerCase();
  if (/party\s*pack/.test(s)) tags.add("party-pack");
  if (/jumbo/.test(s)) tags.add("jumbo");
  if (/flingo/.test(s)) tags.add("flingo");
  if (/\bcones?\b/.test(s) || /treat cone/.test(s)) tags.add("cone");
  if (/\bcups?\b/.test(s) && !/jumbo/.test(s)) tags.add("cup");
  if (/\btubs?\b/.test(s)) tags.add("tub");
  if (/cake|pastr/.test(s)) tags.add("cake");
  if (/kulfi|matka|cool-fi|coolf/.test(s)) tags.add("kulfi");
  if (/chocobar|badabite|candy|bomber|funtastic|one up|orange bar|bon.?bon/.test(s))
    tags.add("stick");
  if (/dolly/.test(s)) tags.add("dolly");
  if (/sandwich/.test(s)) tags.add("sandwich");
  if (/shrikhand/.test(s)) tags.add("shrikhand");
  if (/cassatta|cassata/.test(s)) tags.add("cassata");
  if (/frootful|fruitful|gully|gola/.test(s)) tags.add("stick");
  if (/sundae\s*spin|trooper/.test(s)) tags.add("stick");
  if (/take\s*home|family\s*tub|party/.test(s) && !/party\s*pack/.test(s)) tags.add("tub");
  if (/bulk/.test(s)) tags.add("bulk");
  return tags;
}

function coreName(input: string): string {
  return slugify(
    input
      .toLowerCase()
      .replace(/\bvadilal\b|\bsheetal\b/g, " ")
      .replace(/\bice[\s-]*creams?\b/g, " ")
      .replace(
        /\b(party pack|jumbo cup|flingo( ice cream)? cone|gourmet( natural)?|premium|classic|no sugar|cup treat|consumer bulk packs?|badabite|chocolate candies)\b/g,
        " ",
      )
      .replace(/\b\d+\s*(ml|l|ltr|g|gms|kg)\b/g, " "),
  );
}

function nameScore(productName: string, marketTitle: string): number {
  const aCore = coreName(productName);
  const bCore = coreName(marketTitle);
  if (!aCore || !bCore) return 0;

  const a = new Set(aCore.split("-").filter((t) => t && t.length >= 3));
  const b = new Set(bCore.split("-").filter((t) => t && t.length >= 3));
  if (a.size === 0) return 0;

  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const coverage = inter / a.size;
  if (coverage < 0.7) return 0;

  const union = new Set([...a, ...b]).size;
  let score = inter / union;
  if (bCore.includes(aCore) || aCore.includes(bCore)) score += 0.2;

  const fa = formatTags(productName);
  const fb = formatTags(marketTitle);
  if (fa.size && fb.size) {
    let agree = 0;
    for (const t of fa) if (fb.has(t)) agree += 1;
    if (agree > 0) score += 0.15;
    else score -= 0.35;
  }
  return Math.max(0, Math.min(1, score));
}

function priceSane(price: number, formats: Set<string>, category: string): boolean {
  const cat = category.toLowerCase();
  if (formats.has("party-pack") || /party pack/i.test(cat)) return price >= 120 && price <= 600;
  if (formats.has("cake") || /cake|pastr/i.test(cat)) return price >= 150 && price <= 700;
  if (formats.has("tub") || /tub|take home/i.test(cat)) return price >= 100 && price <= 500;
  if (formats.has("shrikhand") || /shrikhand/i.test(cat)) return price >= 40 && price <= 250;
  if (formats.has("jumbo") || /jumbo/i.test(cat)) return price >= 20 && price <= 80;
  if (
    formats.has("stick") ||
    formats.has("dolly") ||
    formats.has("cone") ||
    formats.has("cup") ||
    formats.has("flingo") ||
    formats.has("kulfi") ||
    /candy|chocobar|dolly|cone|cup|cool-fi|sundae|trooper|gully|kulfi/i.test(cat)
  ) {
    return price >= 15 && price <= 120;
  }
  return price >= 10 && price <= 800;
}

function sheetalNameKey(name: string): string {
  return slugify(
    name
      .replace(/\bboltop\b/gi, "boll top")
      .replace(/\bboll top cone\b/gi, "boll top")
      .replace(/\bthender coconut\b/gi, "tender coconut")
      .replace(/\btripple sundae\b/gi, "triple sundae")
      .replace(/\btripple\b/gi, "triple")
      .replace(/\([^)]*\)/g, "")
      .replace(/\b(cone|cup|pack)\b/gi, ""),
  );
}

function pickSheetalHit(productName: string, category: string, hits: PriceHit[]): PriceHit | null {
  const key = sheetalNameKey(productName);
  const cat = category.toLowerCase();
  for (const hit of hits) {
    if (hit.brand !== "Sheetal") continue;
    if (sheetalNameKey(hit.title) !== key) continue;
    const hint = (hit.categoryHint ?? "").toLowerCase();
    if (hint.includes("cone") && !/cone/i.test(cat)) continue;
    if ((hint.includes("cup") || hint.includes("natural")) && /take home|party|tub|gola/i.test(cat))
      continue;
    if (hint.includes("novelt") && /take home|cone|cup/i.test(cat)) continue;
    return hit;
  }
  return null;
}

function pickVadilalHit(productName: string, category: string, hits: PriceHit[]): PriceHit | null {
  const fa = formatTags(`${productName} ${category}`);
  let best: PriceHit | null = null;
  let bestScore = 0;
  for (const hit of hits) {
    if (hit.brand !== "Vadilal") continue;
    const fb = formatTags(hit.title);
    if (fa.size > 0) {
      let agree = 0;
      for (const t of fa) if (fb.has(t)) agree += 1;
      if (agree === 0) continue;
    }
    const score = nameScore(productName, hit.title);
    if (score <= bestScore) continue;
    if (!priceSane(hit.price, fa, category)) continue;
    bestScore = score;
    best = hit;
  }
  if (!best || bestScore < 0.58) return null;
  return best;
}

function pickBestHit(productName: string, brand: string, category: string, hits: PriceHit[]): PriceHit | null {
  if (brand === "Sheetal") return pickSheetalHit(productName, category, hits);
  return pickVadilalHit(productName, category, hits);
}

async function scrapeSheetalFoodworldPrices(): Promise<PriceHit[]> {
  const { data } = await fetchJson<
    Array<{
      title?: { rendered?: string };
      acf?: { product_mrp?: string };
      class_list?: string[];
    }>
  >(FOODWORLD_API);

  const hits: PriceHit[] = [];
  for (const p of data ?? []) {
    const isIce = (p.class_list ?? []).some((c) => c.includes("product_segment-ice-cream"));
    if (!isIce) continue;
    const title = decodeHtml(p.title?.rendered ?? "").trim();
    const price = parseMrp(p.acf?.product_mrp ?? "");
    if (!title || price == null || price <= 0) continue;
    const typeHint =
      (p.class_list ?? [])
        .find((c) => c.startsWith("product_type-"))
        ?.replace("product_type-", "")
        .replace(/-/g, " ") ?? "";
    hits.push({
      brand: "Sheetal",
      title,
      price,
      source: "sheetalfoodworld",
      categoryHint: typeHint,
    });
  }
  return hits;
}

function parseBigBasketMarkdown(text: string, brand: "Vadilal" | "Sheetal"): PriceHit[] {
  const hits: PriceHit[] = [];
  const brandRe = brand === "Vadilal" ? /vadilal/i : /sheetal/i;

  const push = (rawTitle: string, prices: number[]) => {
    if (!prices.length) return;
    const title = rawTitle.trim();
    if (!brandRe.test(title)) return;
    const price = Math.round(Math.max(...prices));
    if (price <= 0 || price > 5000) return;
    hits.push({
      brand,
      title: title.replace(new RegExp(`^${brand}\\s+`, "i"), "").trim(),
      price,
      source: "bigbasket",
    });
  };

  const imgRe = new RegExp(
    `!\\[[^\\]]*?((?:${brand})[^\\]]+)\\]\\((https://www\\.bbassets\\.com[^)]+)\\)`,
    "gi",
  );
  for (const m of text.matchAll(imgRe)) {
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 320);
    const prices = [...after.matchAll(/₹\s*([0-9]+(?:\.[0-9]+)?)/g)].map((x) => Number(x[1]));
    push(m[1], prices);
  }

  for (const m of text.matchAll(/https:\/\/www\.bigbasket\.com\/pd\/\d+\/([a-z0-9-]+)\//gi)) {
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 220);
    const prices = [...after.matchAll(/₹\s*([0-9]+(?:\.[0-9]+)?)/g)].map((x) => Number(x[1]));
    const slug = m[1].replace(/-/g, " ");
    if (brandRe.test(slug)) push(slug, prices);
  }

  return hits;
}

async function scrapeBigBasketPrices(brand: "Vadilal" | "Sheetal"): Promise<PriceHit[]> {
  const queries =
    brand === "Vadilal"
      ? [
          "https://www.bigbasket.com/pb/vadilal/",
          "https://www.bigbasket.com/pb/vadilal/?page=2",
          "https://www.bigbasket.com/pb/vadilal/ice-creams/",
          "https://www.bigbasket.com/pb/vadilal/ice-creams/?page=2",
          "https://www.bigbasket.com/ps/?q=vadilal%20badabite",
          "https://www.bigbasket.com/ps/?q=vadilal%20cone",
          "https://www.bigbasket.com/ps/?q=vadilal%20kulfi",
          "https://www.bigbasket.com/ps/?q=vadilal%20jumbo",
          "https://www.bigbasket.com/ps/?q=vadilal%20cassatta",
          "https://www.bigbasket.com/ps/?q=vadilal%20chocobar",
          "https://www.bigbasket.com/ps/?q=vadilal%20shrikhand",
          "https://www.bigbasket.com/ps/?q=vadilal%20cup",
          "https://www.bigbasket.com/ps/?q=vadilal%20american%20nuts",
          "https://www.bigbasket.com/ps/?q=vadilal%20butterscotch",
          "https://www.bigbasket.com/ps/?q=vadilal%20vanilla",
          "https://www.bigbasket.com/ps/?q=vadilal%20rajbhog",
          "https://www.bigbasket.com/ps/?q=vadilal%20matka",
          "https://www.bigbasket.com/ps/?q=vadilal%20party",
          "https://www.bigbasket.com/ps/?q=vadilal%20cake",
          "https://www.bigbasket.com/ps/?q=vadilal%20tub",
        ]
      : [
          "https://www.bigbasket.com/ps/?q=sheetal%20ice%20cream",
          "https://www.bigbasket.com/ps/?q=sheetal%20cone",
          "https://www.bigbasket.com/ps/?q=sheetal%20kulfi",
          "https://www.bigbasket.com/ps/?q=sheetal%20chocobar",
          "https://www.bigbasket.com/ps/?q=sheetal%20cup",
        ];

  const all: PriceHit[] = [];
  for (const url of queries) {
    try {
      const text = await fetchText(JINA + url);
      const hits = parseBigBasketMarkdown(text, brand);
      console.log(`  BigBasket ${brand} ${url.replace("https://www.bigbasket.com", "")}: ${hits.length}`);
      all.push(...hits);
    } catch (err) {
      console.warn(`  ✗ price fetch failed ${url}:`, err);
    }
  }
  return all;
}

function categoryKey(brand: string, category: string): string {
  return `${brand.toLowerCase()}::${category.toLowerCase().trim()}`;
}

function median(nums: number[]): number | null {
  if (!nums.length) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : Math.round((sorted[mid - 1]! + sorted[mid]!) / 2);
}

function retailFallback(brand: string, category: string, medians: Map<string, number>): number {
  const key = categoryKey(brand, category);
  return medians.get(key) ?? RETAIL_DEFAULTS[key] ?? (brand === "Vadilal" ? 50 : 40);
}

export async function enrichPrices(products: ScrapedProduct[]): Promise<{
  products: ScrapedProduct[];
  stats: {
    updated: number;
    kept: number;
    missing: number;
    listed: number;
    fallback: number;
    sources: Record<string, number>;
  };
}> {
  console.log("Enriching retail prices for all products…");
  const sheetalOfficial = await scrapeSheetalFoodworldPrices();
  console.log(`  Sheetal Foodworld MRP: ${sheetalOfficial.length}`);
  const vadilalBb = await scrapeBigBasketPrices("Vadilal");
  console.log(`  Vadilal BigBasket rows: ${vadilalBb.length}`);
  const sheetalBb = await scrapeBigBasketPrices("Sheetal");
  console.log(`  Sheetal BigBasket rows: ${sheetalBb.length}`);

  const hits = [...sheetalOfficial, ...vadilalBb, ...sheetalBb];
  const sources: Record<string, number> = {};
  let updated = 0;
  let kept = 0;
  let listed = 0;
  let fallback = 0;

  // Pass 1: exact/listed retail matches
  const pass1 = products.map((p) => {
    const hit = pickBestHit(p.name, p.brand, p.category, hits);
    if (!hit) return { ...p, price: null as number | null, _listed: false as boolean };
    sources[hit.source] = (sources[hit.source] ?? 0) + 1;
    listed += 1;
    if (p.price !== hit.price) updated += 1;
    else kept += 1;
    return { ...p, price: hit.price, _listed: true };
  });

  // Category medians from listed matches
  const byCat = new Map<string, number[]>();
  for (const p of pass1) {
    if (!p._listed || p.price == null) continue;
    const key = categoryKey(p.brand, p.category);
    const arr = byCat.get(key) ?? [];
    arr.push(p.price);
    byCat.set(key, arr);
  }
  const medians = new Map<string, number>();
  for (const [key, vals] of byCat) {
    const m = median(vals);
    if (m != null) medians.set(key, m);
  }

  // Pass 2: fill every remaining product with category retail MRP
  const out: ScrapedProduct[] = pass1.map(({ _listed, ...p }) => {
    if (p.price != null) return p;
    const price = retailFallback(p.brand, p.category, medians);
    fallback += 1;
    sources.category_retail = (sources.category_retail ?? 0) + 1;
    return { ...p, price };
  });

  return {
    products: out,
    stats: { updated, kept, missing: 0, listed, fallback, sources },
  };
}

if (import.meta.main) {
  const root = process.cwd();
  const { jsonPath } = resolvePaths(root);
  const existing = loadExistingProducts(jsonPath);
  const products = [...existing.values()].map((p) => ({
    id: p.id!,
    name: p.name ?? "",
    brand: (p.brand ?? "Vadilal") as "Vadilal" | "Sheetal",
    category: p.category ?? "Other",
    description: p.description ?? "",
    slogan: p.slogan ?? "",
    price: p.price ?? null,
    image: p.image ?? "",
    hide: Boolean(p.hide),
    sourceUrl: p.sourceUrl ?? "",
  })) satisfies ScrapedProduct[];

  const { products: enriched, stats } = await enrichPrices(products);
  enriched.sort((a, b) => {
    if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });
  writeProductsJson(jsonPath, enriched);
  const priced = enriched.filter((p) => p.price != null).length;
  console.log(
    `Prices: ${priced}/${enriched.length} · listed ${stats.listed}, category-retail ${stats.fallback}`,
  );
  console.log("Sources:", stats.sources);
}
