# Chamunda Pan & Vadilal Ice-Creams, Sheetal Ice-Creams

Static catalog site for **Vadilal** and **Sheetal** ice creams at Chamunda Pan, Thangadh. No backend — products load from JSON and local images.

**Live URL (GitHub Pages):** https://bawaliyajay-spec.github.io/ice-cream/

## Develop

```bash
bun install
bun run dev
```

## Scrape products

Pull product names + HD thumbnails from the official Vadilal and Sheetal sites into `public/`:

```bash
bun run scrape
```

Writes:

- `public/data/products.json`
- `public/images/vadilal/*`
- `public/images/sheetal/*`

Re-running the scraper **skips re-downloading images** for products that already exist on disk, **updates price** when the source MRP changed, and **preserves** `hide` plus manual slogan/description when the source leaves those empty.

### Hide a product

In `public/data/products.json`, set `"hide": true` on any product. Hidden items are omitted from the UI but kept in the file.

### Prices

Many catalog pages do not list MRP. Missing prices show as **Ask for price**. Edit `price` in the JSON when you know it.

## Build (static)

```bash
bun run build
```

Output is in `dist/` (includes `404.html` for GitHub Pages SPA fallback).

## GitHub Pages

1. Repo **Settings → Pages → Build and deployment → Source:** GitHub Actions
2. Push to `main` (or run the **Deploy to GitHub Pages** workflow manually)

The Vite `base` path is `/ice-cream/` to match this repository name.
