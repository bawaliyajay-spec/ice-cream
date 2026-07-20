import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  Phone,
  MessageCircle,
  MapPin,
  Clock,
  Snowflake,
  Sparkles,
  Truck,
  BadgeCheck,
  IceCreamCone,
  Menu,
  X,
  Instagram,
  Facebook,
} from "lucide-react";
import heroImg from "@/assets/hero-icecream.jpg";

export const Route = createFileRoute("/")({
  component: Index,
});

type Brand = "Vadilal" | "Sheetal";

interface Product {
  id: string;
  name: string;
  slogan: string;
  description: string;
  price: number | null;
  brand: Brand;
  category: string;
  image: string;
  hide: boolean;
}

const SHOP_NAME = "Chamunda Pan & Vadilal Ice-Creams, Sheetal Ice-Creams";
const SHOP_SHORT = "Chamunda Pan";
const SHOP_SUBTITLE = "Vadilal & Sheetal Ice-Creams";
const PHONE_DISPLAY = "+91 87350 45999";
const PHONE_TEL = "tel:+918735045999";
const WHATSAPP =
  "https://wa.me/918735045999?text=Hi!%20I%27d%20like%20to%20order%20ice%20cream.";
const MAPS_URL = "https://maps.app.goo.gl/qmUNEsBvWP2xnALA8?g_st=aw";
const ADDRESS =
  "Chamunda Pan Centre, Main road, opp. Dr. Satapra's clinic, Vasuki plot, Thangadh, Gujarat 363530";
const BASE = import.meta.env.BASE_URL;

function assetUrl(path: string): string {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${BASE}${path.replace(/^\//, "")}`;
}

function Index() {
  const [brand, setBrand] = useState<Brand>("Vadilal");
  const [category, setCategory] = useState<string>("All");
  const [menuOpen, setMenuOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`${BASE}data/products.json`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load products (${res.status})`);
        return res.json() as Promise<Product[]>;
      })
      .then((data) => {
        if (cancelled) return;
        setProducts(Array.isArray(data) ? data : []);
        setLoadError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setLoadError(err instanceof Error ? err.message : "Failed to load products");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(() => products.filter((p) => !p.hide), [products]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const p of visible) {
      if (p.brand === brand && p.category) set.add(p.category);
    }
    return ["All", ...Array.from(set).sort((a, b) => a.localeCompare(b))];
  }, [visible, brand]);

  useEffect(() => {
    if (!categories.includes(category)) setCategory("All");
  }, [categories, category]);

  const filtered = useMemo(
    () =>
      visible.filter(
        (p) => p.brand === brand && (category === "All" || p.category === category),
      ),
    [visible, brand, category],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-vanilla/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-2">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full gradient-melt shadow-scoop">
              <IceCreamCone className="h-5 w-5 text-white" />
            </span>
            <span className="leading-tight">
              <span className="block font-display text-lg font-bold text-brand-blue sm:text-xl">
                {SHOP_SHORT}
              </span>
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-brand-red/80 sm:text-xs">
                {SHOP_SUBTITLE}
              </span>
            </span>
          </a>

          <nav className="hidden items-center gap-7 text-sm font-semibold text-brand-blue md:flex">
            <a href="#top" className="hover:text-brand-red">Home</a>
            <a href="#vadilal" className="hover:text-brand-red">Vadilal</a>
            <a href="#sheetal" className="hover:text-brand-red">Sheetal</a>
            <a href="#why" className="hover:text-brand-red">Why Us</a>
            <a href="#contact" className="hover:text-brand-red">Contact</a>
          </nav>

          <div className="hidden md:flex">
            <a
              href={WHATSAPP}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-brand-red px-4 py-2 text-sm font-bold text-white shadow-scoop transition hover:scale-[1.03]"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp
            </a>
          </div>

          <button
            className="grid h-10 w-10 place-items-center rounded-full bg-cream text-brand-blue md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {menuOpen && (
          <div className="border-t border-border/60 bg-vanilla md:hidden">
            <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3 text-sm font-semibold text-brand-blue">
              {["Home", "Vadilal", "Sheetal", "Why Us", "Contact"].map((item, i) => (
                <a
                  key={item}
                  href={["#top", "#vadilal", "#sheetal", "#why", "#contact"][i]}
                  onClick={() => setMenuOpen(false)}
                  className="rounded-lg px-3 py-2 hover:bg-cream"
                >
                  {item}
                </a>
              ))}
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-4 py-2 text-sm font-bold text-white"
              >
                <MessageCircle className="h-4 w-4" /> Order on WhatsApp
              </a>
            </div>
          </div>
        )}
      </header>

      {/* Hero */}
      <section id="top" className="relative overflow-hidden gradient-melt">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_30%,white,transparent_40%),radial-gradient(circle_at_80%_60%,white,transparent_45%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 md:grid-cols-2">
          <div className="text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold uppercase tracking-wider backdrop-blur">
              <Sparkles className="h-3.5 w-3.5" /> Fresh stock daily
            </span>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.05] sm:text-5xl md:text-6xl">
              Two Legendary Brands.
              <br />
              <span className="text-brand-gold">One Sweet Destination.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base text-white/90 sm:text-lg">
              Vadilal & Sheetal Ice Creams — all your favourite cups, cones, kulfi and family packs under one roof.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="#vadilal"
                className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-brand-red shadow-scoop transition hover:scale-[1.03]"
              >
                View Full Menu
              </a>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border-2 border-white/70 px-6 py-3 text-sm font-bold text-white transition hover:bg-white/10"
              >
                <MessageCircle className="h-4 w-4" /> Order Now
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[2.5rem] bg-white/20 blur-2xl" />
            <img
              src={heroImg}
              alt="Assorted Vadilal and Sheetal ice cream scoops, cones and cups"
              width={1600}
              height={1200}
              className="relative w-full rounded-[2rem] object-cover shadow-scoop"
            />
          </div>
        </div>

        <svg className="block h-16 w-full text-background sm:h-24" viewBox="0 0 1440 100" preserveAspectRatio="none" aria-hidden>
          <path fill="currentColor" d="M0,40 C240,120 480,0 720,50 C960,100 1200,20 1440,60 L1440,100 L0,100 Z" />
        </svg>
      </section>

      {/* Brand intro cards */}
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="grid gap-6 md:grid-cols-2">
          <BrandCard
            title="VADILAL"
            tagline="Trusted Taste, Generations Strong"
            bgClass="bg-brand-blue"
            btnClass="bg-brand-gold text-brand-blue"
            targetId="vadilal"
            onSelect={() => setBrand("Vadilal")}
            initials="V"
          />
          <BrandCard
            title="SHEETAL"
            tagline="100% Pure Milk, Pure Joy"
            bgClass="bg-brand-pink"
            btnClass="bg-white text-brand-pink"
            targetId="sheetal"
            onSelect={() => setBrand("Sheetal")}
            initials="S"
          />
        </div>
      </section>

      {/* Catalog */}
      <section id="menu" className="mx-auto max-w-7xl px-4 pb-6 sm:px-6">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold sm:text-4xl">
            The <span className="text-gradient-melt">Full Menu</span>
          </h2>
          <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-brand-gold" />
          <p className="mx-auto mt-4 max-w-xl text-sm text-muted-foreground sm:text-base">
            Switch between brands and filter by category. Prices in ₹ when listed — otherwise ask us on WhatsApp.
          </p>
        </div>

        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full border border-border bg-vanilla p-1 shadow-sm">
            {(["Vadilal", "Sheetal"] as Brand[]).map((b) => (
              <button
                key={b}
                onClick={() => {
                  setBrand(b);
                  setCategory("All");
                }}
                className={`rounded-full px-6 py-2 text-sm font-bold transition ${
                  brand === b
                    ? b === "Vadilal"
                      ? "bg-brand-blue text-white shadow"
                      : "bg-brand-pink text-white shadow"
                    : "text-brand-blue/70 hover:text-brand-blue"
                }`}
              >
                {b}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-6 flex max-h-40 flex-wrap justify-center gap-2 overflow-y-auto px-1 sm:max-h-none">
          {categories.map((c) => {
            const active = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-3 py-1.5 text-[11px] font-bold uppercase tracking-wide transition sm:px-4 sm:text-sm ${
                  active
                    ? "border-brand-red bg-brand-red text-white shadow"
                    : "border-border bg-vanilla text-brand-blue/80 hover:border-brand-red/50 hover:text-brand-red"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </section>

      <section id={brand === "Vadilal" ? "vadilal" : "sheetal"} className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider text-white ${
                brand === "Vadilal" ? "bg-brand-blue" : "bg-brand-pink"
              }`}
            >
              {brand}
            </span>
            <h3 className="mt-3 font-display text-2xl font-bold sm:text-3xl">
              {brand === "Vadilal"
                ? "Trusted since generations"
                : "100% pure milk goodness"}
            </h3>
          </div>
          <p className="text-sm text-muted-foreground">
            {loading
              ? "Loading…"
              : `Showing ${filtered.length} product${filtered.length === 1 ? "" : "s"}`}
          </p>
        </div>

        {loadError ? (
          <div className="rounded-2xl border border-dashed border-border bg-vanilla p-12 text-center text-muted-foreground">
            {loadError}
          </div>
        ) : loading ? (
          <div className="rounded-2xl border border-dashed border-border bg-vanilla p-12 text-center text-muted-foreground">
            Loading catalog…
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-vanilla p-12 text-center text-muted-foreground">
            No products in this category. Try a different filter.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}

        <div id={brand === "Vadilal" ? "sheetal" : "vadilal"} className="scroll-mt-24" />
      </section>

      <section id="why" className="bg-vanilla py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="font-display text-3xl font-bold sm:text-4xl">Why Choose Us</h2>
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-brand-gold" />
          </div>
          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { Icon: BadgeCheck, title: "Two Trusted Brands", desc: "Vadilal & Sheetal, side by side" },
              { Icon: Snowflake, title: "Always Fresh Stock", desc: "Deep-freeze storage, daily rotation" },
              { Icon: Sparkles, title: "Best Market Prices", desc: "Fair MRP on every single item" },
              { Icon: Truck, title: "Quick Pickup & Delivery", desc: "WhatsApp order, delivered chilled" },
            ].map(({ Icon, title, desc }) => (
              <div key={title} className="text-center">
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand-gold shadow-scoop">
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <h4 className="mt-4 font-display text-lg font-bold text-brand-blue">{title}</h4>
                <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer id="contact" className="bg-brand-blue text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full gradient-melt">
                  <IceCreamCone className="h-5 w-5 text-white" />
                </span>
                <span className="leading-tight">
                  <span className="block font-display text-xl font-bold">{SHOP_SHORT}</span>
                  <span className="block text-xs font-semibold text-brand-gold">{SHOP_SUBTITLE}</span>
                </span>
              </div>
              <p className="mt-4 max-w-xs text-sm text-white/70">
                {SHOP_NAME} — your neighbourhood destination for cups, cones, kulfi, sticks and family packs.
              </p>
              <div className="mt-5 flex gap-3">
                <a href="#" aria-label="Instagram" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-brand-pink"><Instagram className="h-4 w-4" /></a>
                <a href="#" aria-label="Facebook" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 hover:bg-brand-pink"><Facebook className="h-4 w-4" /></a>
              </div>
            </div>

            <div>
              <h5 className="font-display text-lg font-bold text-brand-gold">Quick Links</h5>
              <ul className="mt-4 space-y-2 text-sm text-white/80">
                <li><a href="#top" className="hover:text-white">Home</a></li>
                <li><a href="#vadilal" className="hover:text-white">Vadilal Menu</a></li>
                <li><a href="#sheetal" className="hover:text-white">Sheetal Menu</a></li>
                <li><a href="#why" className="hover:text-white">Why Choose Us</a></li>
              </ul>
            </div>

            <div>
              <h5 className="font-display text-lg font-bold text-brand-gold">Visit & Order</h5>
              <ul className="mt-4 space-y-3 text-sm text-white/80">
                <li className="flex gap-3">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-pink" />
                  <a
                    href={MAPS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="hover:text-white"
                  >
                    {ADDRESS}
                  </a>
                </li>
                <li className="flex gap-3">
                  <Phone className="h-4 w-4 shrink-0 text-brand-pink" />
                  <a href={PHONE_TEL} className="hover:text-white">
                    {PHONE_DISPLAY}
                  </a>
                </li>
                <li className="flex gap-3">
                  <Clock className="h-4 w-4 shrink-0 text-brand-pink" />
                  7:00 AM – 12:00 AM · All days
                </li>
              </ul>
              <div className="mt-5 flex flex-wrap gap-3">
                <a
                  href={WHATSAPP}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-blue shadow-scoop transition hover:scale-[1.03]"
                >
                  <MessageCircle className="h-4 w-4" /> Order on WhatsApp
                </a>
                <a
                  href={MAPS_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-white/40 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-white/10"
                >
                  <MapPin className="h-4 w-4" /> Open in Maps
                </a>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-white/60">
            © {new Date().getFullYear()} {SHOP_NAME}. Vadilal & Sheetal are trademarks of their respective owners.
          </div>
        </div>
      </footer>
    </div>
  );
}

function BrandCard({
  title,
  tagline,
  bgClass,
  btnClass,
  targetId,
  onSelect,
  initials,
}: {
  title: string;
  tagline: string;
  bgClass: string;
  btnClass: string;
  targetId: string;
  onSelect: () => void;
  initials: string;
}) {
  return (
    <div className={`group relative overflow-hidden rounded-3xl ${bgClass} p-8 text-white shadow-card transition hover:-translate-y-1 sm:p-10`}>
      <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
      <div className="relative flex items-start justify-between gap-4">
        <div>
          <h3 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h3>
          <p className="mt-2 text-sm text-white/85 sm:text-base">{tagline}</p>
        </div>
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-white/15 font-display text-3xl font-bold text-white backdrop-blur">
          {initials}
        </div>
      </div>
      <a
        href={`#${targetId}`}
        onClick={onSelect}
        className={`mt-8 inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold shadow transition hover:scale-[1.03] ${btnClass}`}
      >
        View {title.charAt(0) + title.slice(1).toLowerCase()} Menu →
      </a>
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const isVadilal = product.brand === "Vadilal";
  const imageSrc = assetUrl(product.image);
  const [imgFailed, setImgFailed] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/50 bg-card shadow-card transition hover:-translate-y-1 hover:shadow-scoop">
      <div className="relative flex h-52 items-center justify-center overflow-hidden bg-gradient-to-br from-cream to-brand-gold/20 p-4">
        {imageSrc && !imgFailed ? (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            className="h-full w-full cursor-zoom-in border-0 bg-transparent p-0"
            aria-label={`View ${product.name} image`}
          >
            <img
              src={imageSrc}
              alt={product.name}
              loading="lazy"
              className="h-full w-full object-contain transition group-hover:scale-105"
              onError={() => setImgFailed(true)}
            />
          </button>
        ) : (
          <IceCreamCone className="h-16 w-16 text-brand-blue/30" />
        )}

        <span
          className={`pointer-events-none absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${
            isVadilal ? "bg-brand-blue" : "bg-brand-pink"
          }`}
        >
          {product.brand}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h4 className="font-display text-lg font-bold text-brand-blue">{product.name}</h4>
        {product.slogan ? (
          <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-brand-red/80">
            {product.slogan}
          </p>
        ) : null}
        {product.description ? (
          <p className="mt-2 flex-1 text-sm text-muted-foreground">{product.description}</p>
        ) : (
          <div className="flex-1" />
        )}

        <div className="mt-4 flex items-center justify-between gap-2">
          <span className="inline-flex items-center rounded-full bg-brand-gold px-3 py-1 font-display text-sm font-bold text-brand-blue">
            {product.price != null ? `₹${product.price}` : "Ask for price"}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {product.category}
          </span>
        </div>
      </div>

      {lightboxOpen && imageSrc ? (
        <ImageLightbox
          src={imageSrc}
          alt={product.name}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </article>
  );
}

function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const stageRef = useRef<HTMLDivElement | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinchStart = useRef<{ dist: number; scale: number } | null>(null);
  const dragStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const lastTap = useRef(0);
  const scaleRef = useRef(scale);
  const offsetRef = useRef(offset);
  scaleRef.current = scale;
  offsetRef.current = offset;

  const clampScale = (value: number) => Math.min(4, Math.max(1, value));

  const resetView = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const zoomBy = (delta: number, around?: { x: number; y: number }) => {
    setScale((prev) => {
      const next = clampScale(prev + delta);
      if (next === 1) {
        setOffset({ x: 0, y: 0 });
      } else if (around && typeof window !== "undefined") {
        const cx = around.x - window.innerWidth / 2;
        const cy = around.y - window.innerHeight / 2;
        setOffset((o) => ({
          x: o.x - (cx * (next - prev)) / next,
          y: o.y - (cy * (next - prev)) / next,
        }));
      }
      return next;
    });
  };

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "+" || e.key === "=") zoomBy(0.25);
      if (e.key === "-" || e.key === "_") zoomBy(-0.25);
      if (e.key === "0") resetView();
    };
    window.addEventListener("keydown", onKey);

    const stage = stageRef.current;
    const onWheelNative = (e: WheelEvent) => {
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 0.2 : -0.2, { x: e.clientX, y: e.clientY });
    };
    stage?.addEventListener("wheel", onWheelNative, { passive: false });

    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      stage?.removeEventListener("wheel", onWheelNative);
    };
  }, [onClose]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      pinchStart.current = { dist, scale: scaleRef.current };
      dragStart.current = null;
      return;
    }

    if (scaleRef.current > 1) {
      dragStart.current = {
        x: e.clientX,
        y: e.clientY,
        ox: offsetRef.current.x,
        oy: offsetRef.current.y,
      };
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointers.current.has(e.pointerId)) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.current.size === 2 && pinchStart.current) {
      const pts = [...pointers.current.values()];
      const dist = Math.hypot(pts[0]!.x - pts[1]!.x, pts[0]!.y - pts[1]!.y);
      const next = clampScale((pinchStart.current.scale * dist) / pinchStart.current.dist);
      setScale(next);
      if (next === 1) setOffset({ x: 0, y: 0 });
      return;
    }

    if (dragStart.current && scale > 1) {
      setOffset({
        x: dragStart.current.ox + (e.clientX - dragStart.current.x),
        y: dragStart.current.oy + (e.clientY - dragStart.current.y),
      });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinchStart.current = null;
    if (pointers.current.size === 0) dragStart.current = null;
  };

  const onDoubleActivate = (clientX: number, clientY: number) => {
    if (scale > 1) {
      resetView();
    } else {
      setScale(2.5);
      setOffset({
        x: (window.innerWidth / 2 - clientX) * 0.6,
        y: (window.innerHeight / 2 - clientY) * 0.6,
      });
    }
  };

  const onImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTap.current < 280) {
      onDoubleActivate(e.clientX, e.clientY);
      lastTap.current = 0;
    } else {
      lastTap.current = now;
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    zoomBy(e.deltaY < 0 ? 0.2 : -0.2, { x: e.clientX, y: e.clientY });
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] touch-none overscroll-none bg-black/45"
      role="dialog"
      aria-modal="true"
      aria-label={alt}
      onClick={() => {
        if (scale > 1) resetView();
        else onClose();
      }}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[102] flex items-start justify-between gap-2 p-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:p-4">
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              zoomBy(-0.35);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/75 text-lg font-bold text-white shadow-lg sm:h-12 sm:w-12"
            aria-label="Zoom out"
          >
            −
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              zoomBy(0.35);
            }}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/75 text-lg font-bold text-white shadow-lg sm:h-12 sm:w-12"
            aria-label="Zoom in"
          >
            +
          </button>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-black/75 text-white shadow-lg sm:h-12 sm:w-12"
          aria-label="Close image"
        >
          <X className="h-6 w-6" />
        </button>
      </div>

      <div
        ref={stageRef}
        className="flex h-[100dvh] w-[100vw] items-center justify-center overflow-hidden"
        onWheel={onWheel}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="select-none object-contain will-change-transform"
          style={{
            width: "auto",
            height: "auto",
            maxWidth: "100vw",
            maxHeight: "100dvh",
            transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${scale})`,
            transformOrigin: "center center",
            cursor: scale > 1 ? "grab" : "zoom-in",
            transition: pointers.current.size ? "none" : "transform 120ms ease-out",
          }}
          onClick={onImageClick}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        />
      </div>

      <p className="pointer-events-none absolute inset-x-0 bottom-0 z-[102] px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] text-center text-[11px] text-white/85 sm:text-sm">
        Pinch or + / − to zoom · double-tap to toggle · drag when zoomed
      </p>
    </div>,
    document.body,
  );
}
