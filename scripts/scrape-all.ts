import {
  loadExistingProducts,
  mergeWithExisting,
  resolvePaths,
  writeProductsJson,
} from "./scrape-utils";
import { scrapeVadilal } from "./scrape-vadilal";
import { scrapeSheetal } from "./scrape-sheetal";
import { enrichPrices } from "./scrape-prices";

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

  // Merge brands separately so stale Sheetal placeholders are dropped.
  const vadilalMerged = mergeWithExisting(vadilal, existing);
  const sheetalMerged = mergeWithExisting(sheetal, existing);
  let merged = [...vadilalMerged.products, ...sheetalMerged.products];
  const stats = {
    added: vadilalMerged.stats.added + sheetalMerged.stats.added,
    updated: vadilalMerged.stats.updated + sheetalMerged.stats.updated,
    unchanged: vadilalMerged.stats.unchanged + sheetalMerged.stats.unchanged,
    priceUpdated: vadilalMerged.stats.priceUpdated + sheetalMerged.stats.priceUpdated,
  };

  const priced = await enrichPrices(merged);
  merged = priced.products;

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
  const withPrice = merged.filter((p) => p.price != null).length;
  console.log(
    `\nMerge: +${stats.added} new, ~${stats.updated} updated, =${stats.unchanged} unchanged, ₹${stats.priceUpdated} scrape price updates`,
  );
  console.log(
    `Prices set: ${withPrice}/${merged.length} (listed ${priced.stats.listed}, category-retail ${priced.stats.fallback})`,
  );
  console.log(`Wrote ${merged.length} products → ${jsonPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
