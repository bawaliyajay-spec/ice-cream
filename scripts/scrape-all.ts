import {
  loadExistingProducts,
  mergeWithExisting,
  resolvePaths,
  writeProductsJson,
} from "./scrape-utils";
import { scrapeVadilal } from "./scrape-vadilal";
import { scrapeSheetal } from "./scrape-sheetal";

async function main() {
  const root = process.cwd();
  const { jsonPath } = resolvePaths(root);
  const existing = loadExistingProducts(jsonPath);
  console.log(`Existing catalog: ${existing.size} products (will skip image re-fetch for these)`);

  console.log("Scraping Vadilal (all Hygraph categories)…");
  const vadilal = await scrapeVadilal(root, existing);
  console.log(`Vadilal: ${vadilal.length} products`);

  console.log("Scraping Sheetal (all available categories)…");
  const sheetal = await scrapeSheetal(root, existing);
  console.log(`Sheetal: ${sheetal.length} products`);

  const { products: merged, stats } = mergeWithExisting([...vadilal, ...sheetal], existing);
  merged.sort((a, b) => {
    if (a.brand !== b.brand) return a.brand.localeCompare(b.brand);
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.name.localeCompare(b.name);
  });

  writeProductsJson(jsonPath, merged);

  const byBrandCat = new Map<string, number>();
  for (const p of merged) {
    const key = `${p.brand} / ${p.category}`;
    byBrandCat.set(key, (byBrandCat.get(key) ?? 0) + 1);
  }
  console.log("\nCategory breakdown:");
  for (const [key, count] of [...byBrandCat.entries()].sort()) {
    console.log(`  ${key}: ${count}`);
  }
  console.log(
    `\nMerge: +${stats.added} new, ~${stats.updated} updated, =${stats.unchanged} unchanged, ₹${stats.priceUpdated} price updates`,
  );
  console.log(`Wrote ${merged.length} products → ${jsonPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
