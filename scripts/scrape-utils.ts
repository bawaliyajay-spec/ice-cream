import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";

export type Brand = "Vadilal" | "Sheetal";

export interface ScrapedProduct {
  id: string;
  name: string;
  brand: Brand;
  category: string;
  description: string;
  slogan: string;
  price: number | null;
  image: string;
  hide: boolean;
  sourceUrl: string;
}

export interface ExistingProduct {
  id: string;
  brand?: Brand;
  name?: string;
  category?: string;
  description?: string;
  slogan?: string;
  price?: number | null;
  image?: string;
  hide?: boolean;
  sourceUrl?: string;
}

const USER_AGENT =
  "Mozilla/5.0 (compatible; IceCreamCatalogBot/1.0; +https://github.com/bawaliyajay-spec/ice-cream)";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

export function cleanCategory(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().replace(/[.,]+$/, "");
}

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "text/html,application/json,*/*",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.text();
}

export async function fetchJson<T>(url: string): Promise<{ data: T; headers: Headers }> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
  });
  if (!res.ok) throw new Error(`Failed to fetch JSON ${url}: ${res.status}`);
  return { data: (await res.json()) as T, headers: res.headers };
}

export async function fetchBuffer(url: string): Promise<{ buffer: ArrayBuffer; contentType: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "image/*,*/*" },
  });
  if (!res.ok) throw new Error(`Failed to download image ${url}: ${res.status}`);
  return {
    buffer: await res.arrayBuffer(),
    contentType: res.headers.get("content-type") ?? "",
  };
}

/** Prefer original WordPress upload over resized variants like -580x1024. */
export function preferFullImageUrl(url: string): string {
  return url.replace(/-\d+x\d+(?=\.(?:png|jpe?g|webp|gif)$)/i, "");
}

export function extensionFromUrl(url: string, contentType: string): string {
  const clean = url.split("?")[0] ?? url;
  const ext = extname(clean).toLowerCase();
  if ([".png", ".jpg", ".jpeg", ".webp", ".gif"].includes(ext)) return ext === ".jpeg" ? ".jpg" : ext;
  if (contentType.includes("png")) return ".png";
  if (contentType.includes("webp")) return ".webp";
  if (contentType.includes("gif")) return ".gif";
  return ".jpg";
}

export async function downloadImage(
  imageUrl: string,
  destPathWithoutExt: string,
): Promise<string> {
  const fullUrl = preferFullImageUrl(imageUrl);
  let buffer: ArrayBuffer;
  let contentType: string;
  try {
    ({ buffer, contentType } = await fetchBuffer(fullUrl));
  } catch {
    ({ buffer, contentType } = await fetchBuffer(imageUrl));
  }
  const ext = extensionFromUrl(fullUrl, contentType);
  const dest = `${destPathWithoutExt}${ext}`;
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(buffer));
  return dest;
}

export function loadExistingProducts(jsonPath: string): Map<string, ExistingProduct> {
  const map = new Map<string, ExistingProduct>();
  if (!existsSync(jsonPath)) return map;
  try {
    const data = JSON.parse(readFileSync(jsonPath, "utf8")) as ExistingProduct[];
    if (!Array.isArray(data)) return map;
    for (const item of data) {
      if (item?.id) map.set(item.id, item);
    }
  } catch {
    // ignore corrupt file; scraper will rewrite
  }
  return map;
}

function nameKey(brand: string, name: string): string {
  return `${brand.toLowerCase()}::${slugify(name)}`;
}

export function findExisting(
  existing: Map<string, ExistingProduct>,
  id: string,
  brand: Brand,
  name: string,
): ExistingProduct | undefined {
  return existing.get(id) ?? [...existing.values()].find(
    (item) => item.brand === brand && item.name && nameKey(item.brand, item.name) === nameKey(brand, name),
  );
}

/** Reuse on-disk image for an existing product; returns relative public path or null. */
export function existingImagePath(
  publicDir: string,
  prev: ExistingProduct | undefined,
): string | null {
  if (!prev?.image) return null;
  const abs = join(publicDir, prev.image);
  if (existsSync(abs)) return prev.image.replace(/\\/g, "/");
  return null;
}

/**
 * Download only when the product is new or its local image file is missing.
 * Existing products keep their image file (no re-fetch).
 */
export async function ensureProductImage(opts: {
  publicDir: string;
  imageUrl: string;
  destPathWithoutExt: string;
  prev?: ExistingProduct;
}): Promise<{ image: string; downloaded: boolean }> {
  const reused = existingImagePath(opts.publicDir, opts.prev);
  if (reused) {
    return { image: reused, downloaded: false };
  }
  const saved = await downloadImage(opts.imageUrl, opts.destPathWithoutExt);
  return { image: publicRelPath(saved, opts.publicDir), downloaded: true };
}

/**
 * Merge scraped catalog with previous JSON:
 * - Skip treating as brand-new when id/name already exists (image handled separately)
 * - Always take source price when the scrape found one (updates changed MRP)
 * - Keep manual price if source has null
 * - Preserve hide flag and non-empty manual slogan/description when source is empty
 */
export function mergeWithExisting(
  scraped: ScrapedProduct[],
  existing: Map<string, ExistingProduct>,
): { products: ScrapedProduct[]; stats: { added: number; updated: number; unchanged: number; priceUpdated: number } } {
  const byName = new Map<string, ExistingProduct>();
  for (const item of existing.values()) {
    if (item.brand && item.name) byName.set(nameKey(item.brand, item.name), item);
  }

  const stats = { added: 0, updated: 0, unchanged: 0, priceUpdated: 0 };

  const products = scraped.map((product) => {
    const prev = existing.get(product.id) ?? byName.get(nameKey(product.brand, product.name));
    if (!prev) {
      stats.added += 1;
      return product;
    }

    const nextPrice =
      product.price !== null && product.price !== undefined ? product.price : (prev.price ?? null);

    if (prev.price !== nextPrice && product.price !== null && product.price !== undefined) {
      stats.priceUpdated += 1;
    }

    const merged: ScrapedProduct = {
      ...product,
      image: product.image || prev.image || "",
      hide: typeof prev.hide === "boolean" ? prev.hide : product.hide,
      price: nextPrice,
      slogan:
        product.slogan !== ""
          ? product.slogan
          : prev.slogan !== undefined && prev.slogan !== ""
            ? prev.slogan
            : product.slogan,
      description:
        product.description !== ""
          ? product.description
          : prev.description !== undefined && prev.description !== ""
            ? prev.description
            : product.description,
    };

    const changed =
      merged.price !== prev.price ||
      merged.category !== prev.category ||
      merged.description !== (prev.description ?? "") ||
      merged.image !== (prev.image ?? "");

    if (changed) stats.updated += 1;
    else stats.unchanged += 1;

    return merged;
  });

  return { products, stats };
}

export function parseMrp(raw: string): number | null {
  if (!raw) return null;
  const match = raw.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

/** Map Sheetal type/name into a stable display category. */
export function mapSheetalCategory(type: string, name: string): string {
  const t = `${type} ${name}`.toLowerCase();
  if (t.includes("gully") || t.includes("gola")) return "Gully Gola";
  if (t.includes("sugar free") || t.includes("sugar-free") || t.includes("no sugar")) return "Sugar Free";
  if (t.includes("cake") || t.includes("pastr")) return "Cakes & Pastries";
  if (t.includes("take home") || t.includes("tub") || t.includes("family") || t.includes("party pack"))
    return "Take Home";
  if (t.includes("kulfi")) return "Kulfi";
  if (t.includes("cone")) return "Cones";
  if (t.includes("sandwich")) return "Sandwich";
  if (t.includes("candy") || t.includes("dolly") || t.includes("bar") || t.includes("chocobar"))
    return "Candies, Dollies & Bars";
  if (t.includes("novelt") || t.includes("sundae")) return "Novelties";
  if (t.includes("cup") || t.includes("natural cup") || t.includes("big cup") || t.includes("jumbo"))
    return "Cups";
  if (type) return cleanCategory(type);
  return "Other";
}

export function publicRelPath(absolutePath: string, publicDir: string): string {
  return absolutePath.replace(publicDir + "/", "").replace(/\\/g, "/");
}

export function writeProductsJson(jsonPath: string, products: ScrapedProduct[]): void {
  mkdirSync(dirname(jsonPath), { recursive: true });
  writeFileSync(jsonPath, JSON.stringify(products, null, 2) + "\n");
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function resolvePaths(root: string) {
  const publicDir = join(root, "public");
  return {
    publicDir,
    jsonPath: join(publicDir, "data", "products.json"),
    imagesDir: join(publicDir, "images"),
  };
}

export function titleFromFilename(file: string): string {
  const base = decodeURIComponent(file.replace(/\.[^.]+$/, ""));
  return base
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
