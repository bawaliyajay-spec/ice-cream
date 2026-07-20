/**
 * Enrich catalog prices from public retail listings.
 *
 * - Sheetal: official Foodworld MRP (acf.product_mrp)
 * - Vadilal: BigBasket listed MRP (brand does not publish MRP on its own site)
 *
 * Prices are stored as whole rupees (number). Unmatched products stay null.
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

function decodeHtml(raw: string): string {
  return raw
    .replace(/&amp;/g, "&")
    .replace(/&#039;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

const FORMAT_WORDS = new Set([
  "party",
  "pack",
  "jumbo",
  "flingo",
  "cone",
  "cup",
  "tub",
  "cake",
  "kulfi",
  "candy",
  "chocobar",
  "dolly",
  "sandwich",
  "shrikhand",
  "sundae",
  "trooper",
  "cool",
  "fi",
  "treat",
  "bulk",
]);

function formatTags(input: string): Set<string> {
  const tags = new Set<string>();
  const s = input.toLowerCase();
  if (/party\s*pack/.test(s)) tags.add("party-pack");
  if (/jumbo/.test(s)) tags.add("jumbo");
  if (/flingo/.test(s)) tags.add("flingo");
  if (/\bcones?\b/.test(s) || /treat cone/.test(s)) tags.add("cone");
  if (/\bcups?\b/.test(s) && !/jumbo/.test(s)) tags.add("cup");
  if (/\btubs?\b/.test(s)) tags.add("tub");
  if (/cake/.test(s)) tags.add("cake");
  if (/kulfi|matka|cool-fi|coolf/.test(s)) tags.add("kulfi");
  if (/chocobar|badabite|candy|bomber|funtastic|one up/.test(s)) tags.add("stick");
  if (/dolly/.test(s)) tags.add("dolly");
  if (/sandwich/.test(s)) tags.add("sandwich");
  if (/shrikhand/.test(s)) tags.add("shrikhand");
  if (/cassatta|cassata/.test(s)) tags.add("cassata");
  if (/frootful|fruitful/.test(s)) tags.add("stick");
  if (/sundae\s*spin|trooper/.test(s)) tags.add("stick");
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

  const a = new Set(aCore.split("-").filter(Boolean));
  const b = new Set(bCore.split("-").filter(Boolean));
  // Drop ultra-generic tokens
  for (const t of [...a]) if (FORMAT_WORDS.has(t) || t.length < 3) a.delete(t);
  for (const t of [...b]) if (FORMAT_WORDS.has(t) || t.length < 3) b.delete(t);
  if (a.size === 0) return 0;

  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const coverage = inter / a.size;
  if (coverage < 0.7) return 0;

  const union = new Set([...a, ...b]).size;
  let score = inter / union;

  // Exact core containment
  if (bCore.includes(aCore) || aCore.includes(bCore)) score += 0.2;

  // Format agreement bonus / conflict penalty
  const fa = formatTags(productName);
  const fb = formatTags(marketTitle);
  if (fa.size && fb.size) {
    let agree = 0;
    for (const t of fa) if (fb.has(t)) agree += 1;
    if (agree > 0) score += 0.15;
    else score -= 0.35; // e.g. Party Pack vs Cake
  }

  return Math.max(0, Math.min(1, score));
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

function pickBestHit(productName: string, brand: string, category: string, hits: PriceHit[]): PriceHit | null {
  if (brand === "Sheetal") return pickSheetalHit(productName, category, hits);

  const fa = formatTags(`${productName} ${category}`);
  let best: PriceHit | null = null;
  let bestScore = 0;

  for (const hit of hits) {
    if (hit.brand !== brand) continue;
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
  if (!best || bestScore < 0.62) return null;
  return best;
}

function priceSane(price: number, formats: Set<string>, category: string): boolean {
  const cat = category.toLowerCase();
  if (formats.has("party-pack") || /party pack/i.test(cat)) return price >= 120 && price <= 600;
  if (formats.has("cake") || /cake/i.test(cat)) return price >= 150 && price <= 700;
  if (formats.has("tub") || /tub/i.test(cat)) return price >= 120 && price <= 500;
  if (formats.has("shrikhand") || /shrikhand/i.test(cat)) return price >= 40 && price <= 250;
  if (
    formats.has("stick") ||
    formats.has("dolly") ||
    formats.has("cone") ||
    formats.has("cup") ||
    formats.has("flingo") ||
    /candy|chocobar|dolly|cone|cup|cool-fi|sundae|trooper/i.test(cat)
  ) {
    return price >= 15 && price <= 120;
  }
  if (formats.has("jumbo") || /jumbo/i.test(cat)) return price >= 20 && price <= 80;
  return price >= 10 && price <= 800;
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

function parseBigBasketMarkdown(text: string): PriceHit[] {
  const hits: PriceHit[] = [];

  const push = (rawTitle: string, prices: number[]) => {
    if (!prices.length) return;
    const title = rawTitle.trim();
    if (!/vadilal/i.test(title)) return;
    // Prefer MRP (usually the higher struck-through price when two are shown)
    const price = Math.round(Math.max(...prices));
    if (price <= 0 || price > 5000) return;
    hits.push({
      brand: "Vadilal",
      title: title.replace(/^vadilal\s+/i, "").trim(),
      price,
      source: "bigbasket",
    });
  };

  for (const m of text.matchAll(
    /!\[[^\]]*?((?:Vadilal)[^\]]+)\]\((https:\/\/www\.bbassets\.com[^)]+)\)/gi,
  )) {
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 320);
    const prices = [...after.matchAll(/₹\s*([0-9]+(?:\.[0-9]+)?)/g)].map((x) => Number(x[1]));
    push(m[1], prices);
  }

  for (const m of text.matchAll(/https:\/\/www\.bigbasket\.com\/pd\/\d+\/([a-z0-9-]+)\//gi)) {
    const after = text.slice(m.index! + m[0].length, m.index! + m[0].length + 220);
    const prices = [...after.matchAll(/₹\s*([0-9]+(?:\.[0-9]+)?)/g)].map((x) => Number(x[1]));
    const slug = m[1].replace(/-/g, " ");
    if (/vadilal/i.test(slug)) push(slug, prices);
  }

  return hits;
}

async function scrapeVadilalBigBasketPrices(): Promise<PriceHit[]> {
  const urls = [
    "https://www.bigbasket.com/pb/vadilal/",
    "https://www.bigbasket.com/pb/vadilal/?page=2",
    "https://www.bigbasket.com/pb/vadilal/ice-creams/",
    "https://www.bigbasket.com/pb/vadilal/ice-creams/?page=2",
    "https://www.bigbasket.com/ps/?q=vadilal%20badabite",
    "https://www.bigbasket.com/ps/?q=vadilal%20flingo",
    "https://www.bigbasket.com/ps/?q=vadilal%20cone",
    "https://www.bigbasket.com/ps/?q=vadilal%20kulfi",
    "https://www.bigbasket.com/ps/?q=vadilal%20party%20pack",
    "https://www.bigbasket.com/ps/?q=vadilal%20jumbo",
    "https://www.bigbasket.com/ps/?q=vadilal%20cassatta",
    "https://www.bigbasket.com/ps/?q=vadilal%20chocobar",
    "https://www.bigbasket.com/ps/?q=vadilal%20shrikhand",
    "https://www.bigbasket.com/ps/?q=vadilal%20cup",
  ];

  const all: PriceHit[] = [];
  for (const url of urls) {
    try {
      const text = await fetchText(JINA + url);
      const hits = parseBigBasketMarkdown(text);
      console.log(`  BigBasket ${url.replace("https://www.bigbasket.com", "")}: ${hits.length} price rows`);
      all.push(...hits);
    } catch (err) {
      console.warn(`  ✗ price fetch failed ${url}:`, err);
    }
  }
  return all;
}

export async function enrichPrices(products: ScrapedProduct[]): Promise<{
  products: ScrapedProduct[];
  stats: { updated: number; kept: number; missing: number; sources: Record<string, number> };
}> {
  console.log("Enriching prices (Foodworld MRP + BigBasket MRP)…");
  const sheetalHits = await scrapeSheetalFoodworldPrices();
  console.log(`  Sheetal Foodworld MRP rows: ${sheetalHits.length}`);
  const vadilalHits = await scrapeVadilalBigBasketPrices();
  console.log(`  Vadilal BigBasket MRP rows: ${vadilalHits.length}`);

  const hits = [...sheetalHits, ...vadilalHits];
  const sources: Record<string, number> = {};
  let updated = 0;
  let kept = 0;
  let missing = 0;

  const out = products.map((p) => {
    const hit = pickBestHit(p.name, p.brand, p.category, hits);
    if (hit) {
      sources[hit.source] = (sources[hit.source] ?? 0) + 1;
      if (p.price !== hit.price) updated += 1;
      else kept += 1;
      return { ...p, price: hit.price };
    }
    // Do not keep previously guessed/wrong market prices — only trusted hits this run.
    missing += 1;
    return { ...p, price: null };
  });

  return { products: out, stats: { updated, kept, missing, sources } };
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
    `Prices: ${priced}/${enriched.length} set · updated ${stats.updated}, kept ${stats.kept}, still missing ${stats.missing}`,
  );
  console.log("Sources:", stats.sources);
}
