import { join } from "node:path";
import {
  cleanCategory,
  ensureProductImage,
  findExisting,
  loadExistingProducts,
  resolvePaths,
  slugify,
  sleep,
  type ExistingProduct,
  type ScrapedProduct,
} from "./scrape-utils";

const HYGRAPH =
  "https://api-ap-south-1.hygraph.com/v2/cl6w1y7ev3vj701tb1cbp9r7k/master";
const SOURCE = "https://www.vadilalicecreams.com/product-listing";

interface HygraphProduct {
  id: string;
  title: string;
  desc: string | null;
  image: { url: string; fileName?: string | null } | null;
  productListing: { id: string; title: string } | null;
}

interface HygraphResponse {
  data?: {
    products: HygraphProduct[];
    productsConnection: { aggregate: { count: number } };
  };
  errors?: unknown;
}

const QUERY = `
query Products($first: Int!, $skip: Int!) {
  products(first: $first, skip: $skip, orderBy: title_ASC) {
    id
    title
    desc
    image { url fileName }
    productListing { id title }
  }
  productsConnection {
    aggregate { count }
  }
}
`;

async function fetchAllHygraphProducts(): Promise<HygraphProduct[]> {
  const all: HygraphProduct[] = [];
  let skip = 0;
  const pageSize = 100;

  for (;;) {
    const res = await fetch(HYGRAPH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (compatible; IceCreamCatalogBot/1.0; +https://github.com/bawaliyajay-spec/ice-cream)",
      },
      body: JSON.stringify({
        query: QUERY,
        variables: { first: pageSize, skip },
      }),
    });
    if (!res.ok) throw new Error(`Hygraph HTTP ${res.status}`);
    const json = (await res.json()) as HygraphResponse;
    if (json.errors) throw new Error(`Hygraph errors: ${JSON.stringify(json.errors)}`);
    const batch = json.data?.products ?? [];
    const total = json.data?.productsConnection.aggregate.count ?? batch.length;
    all.push(...batch);
    console.log(`  Hygraph page skip=${skip}: +${batch.length} (total ${all.length}/${total})`);
    if (all.length >= total || batch.length === 0) break;
    skip += batch.length;
  }

  return all;
}

export async function scrapeVadilal(
  root: string,
  existing: Map<string, ExistingProduct> = loadExistingProducts(
    resolvePaths(root).jsonPath,
  ),
): Promise<ScrapedProduct[]> {
  const { imagesDir, publicDir } = resolvePaths(root);
  const remote = await fetchAllHygraphProducts();
  const out: ScrapedProduct[] = [];
  const seen = new Set<string>();
  let skippedDownloads = 0;
  let newDownloads = 0;

  for (const item of remote) {
    const name = item.title?.trim();
    if (!name) continue;
    const imageUrl = item.image?.url?.trim();
    if (!imageUrl) {
      console.warn(`  ✗ Vadilal skip (no image): ${name}`);
      continue;
    }

    const category = cleanCategory(item.productListing?.title || "Other") || "Other";
    const id = `vadilal-${slugify(category)}-${slugify(name)}`;
    if (seen.has(id)) continue;
    seen.add(id);

    const prev = findExisting(existing, id, "Vadilal", name);

    try {
      const destBase = join(imagesDir, "vadilal", `${slugify(category)}-${slugify(name)}`);
      const { image, downloaded } = await ensureProductImage({
        publicDir,
        imageUrl,
        destPathWithoutExt: destBase,
        prev,
      });

      if (downloaded) newDownloads += 1;
      else skippedDownloads += 1;

      out.push({
        id,
        name,
        brand: "Vadilal",
        category,
        description: (item.desc ?? "").trim(),
        slogan: "",
        // Vadilal Hygraph listing has no MRP today; keep null so merge preserves manual prices
        price: null,
        image,
        hide: false,
        sourceUrl: SOURCE,
      });

      console.log(
        `  ${downloaded ? "↓" : "↷"} Vadilal [${category}]: ${name}${prev ? " (existing)" : ""}`,
      );
      if (downloaded) await sleep(40);
    } catch (err) {
      console.warn(`  ✗ Vadilal image failed for ${name}:`, err);
    }
  }

  console.log(
    `  Vadilal images: ${newDownloads} downloaded, ${skippedDownloads} reused (skipped re-fetch)`,
  );
  return out;
}

if (import.meta.main) {
  const root = process.cwd();
  const products = await scrapeVadilal(root);
  console.log(`Scraped ${products.length} Vadilal products`);
}
