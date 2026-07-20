import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
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
type Category = "All" | "Cups" | "Cones" | "Kulfi" | "Family Pack" | "Sticks" | "Sandwich" | "Party Pack";

interface Product {
  name: string;
  slogan: string;
  description: string;
  price: number;
  brand: Brand;
  category: Exclude<Category, "All">;
  bestseller?: boolean;
  emoji: string;
}

const PRODUCTS: Product[] = [
  { name: "Butterscotch Tub", slogan: "Crunch in every scoop", description: "Rich butterscotch loaded with caramelized nut brittle", price: 150, brand: "Vadilal", category: "Family Pack", bestseller: true, emoji: "🍨" },
  { name: "Rajwadi Kesar Pista", slogan: "Royal taste, real saffron", description: "Traditional kesar-pista with real saffron and pistachio", price: 180, brand: "Vadilal", category: "Family Pack", emoji: "🥇" },
  { name: "Chocochips Cone", slogan: "Chocolate in every bite", description: "Creamy vanilla loaded with chocolate chips in a crisp cone", price: 40, brand: "Vadilal", category: "Cones", emoji: "🍦" },
  { name: "Party Pack 1L", slogan: "Perfect for celebrations", description: "Family-size tub in your choice of flavor for gatherings", price: 220, brand: "Vadilal", category: "Party Pack", emoji: "🎉" },
  { name: "Cassata Slice", slogan: "Classic layered joy", description: "Iconic three-layer cassata with nuts and tutti frutti", price: 90, brand: "Vadilal", category: "Cups", emoji: "🍰" },
  { name: "Choco Bar Stick", slogan: "Choco lover's snack", description: "Vanilla stick coated in a thick crackling chocolate shell", price: 30, brand: "Vadilal", category: "Sticks", bestseller: true, emoji: "🍫" },
  { name: "Ice Cream Sandwich", slogan: "Two biscuits, one dream", description: "Vanilla ice cream pressed between chocolate wafer biscuits", price: 45, brand: "Vadilal", category: "Sandwich", emoji: "🥪" },
  { name: "Cup Vanilla Classic", slogan: "Timeless favourite", description: "Smooth creamy vanilla in a convenient 100ml cup", price: 25, brand: "Vadilal", category: "Cups", emoji: "🍨" },

  { name: "Malai Kulfi Stick", slogan: "Pure milk, pure joy", description: "Traditional stick kulfi from slow-cooked 100% pure milk", price: 30, brand: "Sheetal", category: "Kulfi", bestseller: true, emoji: "🍡" },
  { name: "Anjeer Delight", slogan: "A royal fig affair", description: "Creamy fig-flavored ice cream with real fig chunks", price: 160, brand: "Sheetal", category: "Family Pack", emoji: "🍯" },
  { name: "Mango Duet Bar", slogan: "Summer's favourite bite", description: "Layered mango and vanilla stick bar, refreshing and light", price: 35, brand: "Sheetal", category: "Sticks", emoji: "🥭" },
  { name: "Family Tub 1L", slogan: "37+ years of pure love", description: "Classic triple-flavor vanilla, strawberry and chocolate tub", price: 210, brand: "Sheetal", category: "Family Pack", bestseller: true, emoji: "🍨" },
  { name: "Kaju Draksh Cup", slogan: "Nuts about you", description: "Rich cashew and raisin ice cream in a single serve cup", price: 45, brand: "Sheetal", category: "Cups", emoji: "🥜" },
  { name: "Chocolate Cone", slogan: "Deep dark bliss", description: "Belgian-style chocolate scoop in a fresh waffle cone", price: 40, brand: "Sheetal", category: "Cones", emoji: "🍦" },
  { name: "Kesar Pista Kulfi", slogan: "Traditional & true", description: "Slow-cooked kulfi with saffron and pistachio slivers", price: 40, brand: "Sheetal", category: "Kulfi", emoji: "🥭" },
  { name: "Celebration Pack 1.5L", slogan: "Share the sweetness", description: "Large party pack in mixed premium flavors", price: 320, brand: "Sheetal", category: "Party Pack", emoji: "🎂" },
];

const CATEGORIES: Category[] = ["All", "Cups", "Cones", "Kulfi", "Family Pack", "Sticks", "Sandwich", "Party Pack"];

const WHATSAPP = "https://wa.me/919999999999?text=Hi!%20I%27d%20like%20to%20order%20ice%20cream.";

function Index() {
  const [brand, setBrand] = useState<Brand>("Vadilal");
  const [category, setCategory] = useState<Category>("All");
  const [menuOpen, setMenuOpen] = useState(false);

  const filtered = useMemo(
    () =>
      PRODUCTS.filter(
        (p) => p.brand === brand && (category === "All" || p.category === category),
      ),
    [brand, category],
  );

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-vanilla/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-2">
            <span className="grid h-10 w-10 place-items-center rounded-full gradient-melt shadow-scoop">
              <IceCreamCone className="h-5 w-5 text-white" />
            </span>
            <span className="font-display text-lg font-bold text-brand-blue sm:text-xl">
              Scoops <span className="text-brand-red">&</span> Sticks
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

        {/* Drip divider */}
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
            Switch between brands and filter by category. Prices in ₹, subject to availability.
          </p>
        </div>

        {/* Brand toggle */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex rounded-full border border-border bg-vanilla p-1 shadow-sm">
            {(["Vadilal", "Sheetal"] as Brand[]).map((b) => (
              <button
                key={b}
                onClick={() => setBrand(b)}
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

        {/* Category chips */}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {CATEGORIES.map((c) => {
            const active = category === c;
            return (
              <button
                key={c}
                onClick={() => setCategory(c)}
                className={`rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition sm:text-sm ${
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

      {/* Brand section: Vadilal anchor */}
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
            Showing {filtered.length} product{filtered.length === 1 ? "" : "s"}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-vanilla p-12 text-center text-muted-foreground">
            No products in this category. Try a different filter.
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((p) => (
              <ProductCard key={p.name} product={p} />
            ))}
          </div>
        )}

        {/* Also hidden anchor for the other brand so nav jumps work */}
        <div id={brand === "Vadilal" ? "sheetal" : "vadilal"} className="scroll-mt-24" />
      </section>

      {/* Why us */}
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

      {/* Footer / Contact */}
      <footer id="contact" className="bg-brand-blue text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
          <div className="grid gap-10 md:grid-cols-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-full gradient-melt">
                  <IceCreamCone className="h-5 w-5 text-white" />
                </span>
                <span className="font-display text-xl font-bold">
                  Scoops <span className="text-brand-gold">&</span> Sticks
                </span>
              </div>
              <p className="mt-4 max-w-xs text-sm text-white/70">
                Your neighbourhood destination for Vadilal & Sheetal ice creams — cups, cones, kulfi, sticks and family packs.
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
                <li className="flex gap-3"><MapPin className="h-4 w-4 shrink-0 text-brand-pink" /> Shop No. 4, Market Road, Your City</li>
                <li className="flex gap-3"><Phone className="h-4 w-4 shrink-0 text-brand-pink" /> +91 99999 99999</li>
                <li className="flex gap-3"><Clock className="h-4 w-4 shrink-0 text-brand-pink" /> 10:00 AM – 11:00 PM · All days</li>
              </ul>
              <a
                href={WHATSAPP}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-brand-gold px-5 py-2.5 text-sm font-bold text-brand-blue shadow-scoop transition hover:scale-[1.03]"
              >
                <MessageCircle className="h-4 w-4" /> Order on WhatsApp
              </a>
            </div>
          </div>

          <div className="mt-12 border-t border-white/10 pt-6 text-center text-xs text-white/60">
            © {new Date().getFullYear()} Scoops & Sticks. Vadilal & Sheetal are trademarks of their respective owners.
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
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-3xl border border-border/50 bg-card shadow-card transition hover:-translate-y-1 hover:shadow-scoop">
      <div className="relative flex h-44 items-center justify-center overflow-hidden bg-gradient-to-br from-cream to-brand-gold/20">
        <span className="text-7xl transition group-hover:scale-110">{product.emoji}</span>

        <span
          className={`absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white ${
            isVadilal ? "bg-brand-blue" : "bg-brand-pink"
          }`}
        >
          {product.brand}
        </span>

        {product.bestseller && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-brand-gold px-2.5 py-0.5 text-[10px] font-bold uppercase text-brand-blue">
            <Sparkles className="h-3 w-3" /> Best
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h4 className="font-display text-lg font-bold text-brand-blue">{product.name}</h4>
        <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-brand-red/80">
          {product.slogan}
        </p>
        <p className="mt-2 flex-1 text-sm text-muted-foreground">{product.description}</p>

        <div className="mt-4 flex items-center justify-between">
          <span className="inline-flex items-center rounded-full bg-brand-gold px-3 py-1 font-display text-sm font-bold text-brand-blue">
            ₹{product.price}
          </span>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {product.category}
          </span>
        </div>
      </div>
    </article>
  );
}
