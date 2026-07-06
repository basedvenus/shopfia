import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bookmark,
  CalendarHeart,
  Camera,
  CakeSlice,
  Flower2,
  GlassWater,
  Heart,
  PartyPopper,
  Sparkles,
  Tags
} from "lucide-react";
import { Button } from "@/components/ui/button";

const partyImages = [
  {
    title: "Citrus Garden Brunch",
    image: "/demo/fairfield-lemon-tablescape.png",
    href: "/events/citrus-garden-brunch",
    detail: "Florals, linens, rentals, and cake artists tagged",
    className: "md:col-span-2 md:row-span-2"
  },
  {
    title: "Tulip Cookie Shower",
    image: "/demo/vacaville-cookie-tulips.png",
    href: "/events/tulip-cookie-shower",
    detail: "Custom cookies and pastel tablescape",
    className: ""
  },
  {
    title: "Blush Garden Tables",
    image:
      "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=1100&q=80",
    href: "/parties",
    detail: "Decor, florals, and rentals behind the look",
    className: ""
  },
  {
    title: "Candlelit Dessert Moment",
    image:
      "https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1100&q=80",
    href: "/parties",
    detail: "Save the look for your next celebration",
    className: "md:col-span-2"
  }
];

const categoryCards = [
  {
    name: "Cakes",
    image:
      "https://images.unsplash.com/photo-1535141192574-5d4897c12636?auto=format&fit=crop&w=900&q=80",
    icon: CakeSlice
  },
  {
    name: "Balloons",
    image:
      "https://images.unsplash.com/photo-1527529482837-4698179dc6ce?auto=format&fit=crop&w=900&q=80",
    icon: PartyPopper
  },
  {
    name: "Florals",
    image:
      "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=900&q=80",
    icon: Flower2
  },
  {
    name: "Decor",
    image:
      "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=900&q=80",
    icon: Sparkles
  },
  {
    name: "Cookies",
    image: "/demo/vacaville-cookie-tulips.png",
    icon: Heart
  },
  {
    name: "Rentals",
    image:
      "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=900&q=80",
    icon: CalendarHeart
  },
  {
    name: "Photography",
    image:
      "https://images.unsplash.com/photo-1511285560929-80b456fea0bc?auto=format&fit=crop&w=900&q=80",
    icon: Camera
  },
  {
    name: "Bartending",
    image:
      "https://images.unsplash.com/photo-1551024709-8f23befc6f87?auto=format&fit=crop&w=900&q=80",
    icon: GlassWater
  }
];

const featuredParties = [
  {
    title: "Lemon Grove Baby Brunch",
    meta: "Fairfield, CA · 8 vendors tagged",
    image: "/demo/fairfield-lemon-tablescape.png",
    href: "/events/citrus-garden-brunch"
  },
  {
    title: "Blush Tulip Shower",
    meta: "Vacaville, CA · cookies, florals, tablescape",
    image: "/demo/vacaville-cookie-tulips.png",
    href: "/events/tulip-cookie-shower"
  },
  {
    title: "Backyard Floral Dinner",
    meta: "Garden party · rentals, stems, place settings",
    image:
      "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1000&q=80",
    href: "/parties"
  }
];

const howItWorks = [
  {
    title: "Browse real parties",
    body: "Find inspiration from baby showers, birthdays, weddings, bridal showers, and more."
  },
  {
    title: "See every vendor behind the event",
    body: "Each party can feature tagged vendors, products, and services."
  },
  {
    title: "Save what you love and book the look",
    body: "Collect ideas and connect with the people who made them happen."
  }
];

const partyStyles = [
  "Garden baby showers",
  "Bow and pearl birthdays",
  "Citrus brunch tables",
  "Modern bridal showers",
  "Pastel dessert bars",
  "Backyard dinner parties"
];

const recentVendors = [
  "Cake artists creating sculptural dessert tables",
  "Florists behind soft, romantic centerpieces",
  "Balloon stylists building statement entrances",
  "Rental teams styling linens, chairs, and bars"
];

export default function Page() {
  return (
    <div className="-mt-6 space-y-20 pb-12 [font-family:Inter,ui-sans-serif,system-ui,sans-serif]">
      <section className="grid min-h-[calc(100vh-5rem)] items-center gap-10 overflow-hidden py-8 lg:grid-cols-[0.84fr_1.16fr]">
        <div className="max-w-2xl">
          <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            <span className="h-px w-12 bg-primary" />
            <span>Real celebrations, shoppable inspiration</span>
          </div>
          <h1 className="mt-7 text-5xl font-semibold leading-[1.02] tracking-normal text-foreground md:text-6xl lg:text-7xl [font-family:'PP_Neue_Montreal','Satoshi','Instrument_Sans',Inter,ui-sans-serif,system-ui,sans-serif]">
            Find the vendors behind the most beautiful parties.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground md:text-lg">
            Browse real celebrations to discover the cake artists, florists,
            balloon stylists, decorators, rentals, and vendors behind every detail.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/parties">
              <Button size="lg" className="h-12 rounded-[8px] px-8">
                Explore Real Parties
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/explore">
              <Button
                size="lg"
                variant="secondary"
                className="h-12 rounded-[8px] px-8"
              >
                Find Local Vendors
              </Button>
            </Link>
          </div>
          <div className="mt-10 grid max-w-2xl gap-3 sm:grid-cols-2">
            {[
              "Every vendor is discovered through a real celebration.",
              "Built from real parties, not anonymous reviews."
            ].map((line) => (
              <div
                key={line}
                className="flex items-start gap-3 rounded-[8px] border border-white/80 bg-white/80 p-4 text-sm leading-6 text-muted-foreground shadow-sm"
              >
                <BadgeCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                <span>{line}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid auto-rows-[142px] grid-cols-2 gap-3 sm:auto-rows-[170px] md:grid-cols-4 md:auto-rows-[154px]">
          {partyImages.map((party, index) => (
            <Link
              key={party.title}
              href={party.href}
              className={`group relative overflow-hidden rounded-[8px] border border-white/80 bg-muted shadow-sm ${party.className}`}
            >
              <Image
                src={party.image}
                alt={party.title}
                fill
                priority={index === 0}
                sizes={
                  index === 0
                    ? "(min-width: 1024px) 34vw, 100vw"
                    : "(min-width: 1024px) 18vw, 50vw"
                }
                className="object-cover transition duration-500 group-hover:scale-[1.03]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              <div className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-foreground opacity-0 transition group-hover:opacity-100">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <h2 className="text-lg font-semibold leading-tight">{party.title}</h2>
                <p className="mt-1 text-xs leading-5 text-white/82">{party.detail}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[8px] border border-primary/20 bg-white/85 px-5 py-8 text-center shadow-sm md:px-10">
        <div className="mx-auto grid max-w-5xl gap-5 text-2xl font-semibold leading-tight text-foreground md:grid-cols-3 md:text-3xl">
          <p>Pinterest gives you ideas.</p>
          <p>Instagram shows you pretty photos.</p>
          <p className="text-primary">
            ShopFia lets you hire the people who created them.
          </p>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Trending Categories
            </p>
            <h2 className="mt-2 text-3xl font-semibold tracking-normal md:text-4xl">
              Discover through real events, then save the look.
            </h2>
          </div>
          <Link
            href="/categories"
            className="inline-flex items-center gap-2 text-sm font-semibold text-primary"
          >
            Browse all categories
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {categoryCards.map((category) => {
            const Icon = category.icon;

            return (
              <Link
                key={category.name}
                href={`/explore?q=${encodeURIComponent(category.name.toLowerCase())}`}
                className="group relative aspect-[4/5] overflow-hidden rounded-[8px] border border-white/80 bg-muted shadow-sm"
              >
                <Image
                  src={category.image}
                  alt={`${category.name} party inspiration`}
                  fill
                  sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/20 to-transparent" />
                <div className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-white/90 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <h3 className="text-2xl font-semibold">{category.name}</h3>
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-white/78">
                    Vendors behind the party
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            Featured Parties
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal md:text-4xl">
            Start with the celebration, not a search form.
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            ShopFia is for the moment when you see a beautiful shower, brunch,
            wedding, or birthday and want to know who made every detail happen.
            Browse the event, tap the tags, and save the vendors behind the party.
          </p>
          <Link href="/parties" className="mt-6 inline-flex">
            <Button className="rounded-[8px]">
              Explore Real Parties
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {featuredParties.map((party) => (
            <Link
              key={party.title}
              href={party.href}
              className="group overflow-hidden rounded-[8px] border border-white/80 bg-white/85 shadow-sm"
            >
              <div className="relative aspect-[4/5] overflow-hidden">
                <Image
                  src={party.image}
                  alt={party.title}
                  fill
                  sizes="(min-width: 1024px) 20vw, 100vw"
                  className="object-cover transition duration-500 group-hover:scale-[1.04]"
                />
              </div>
              <div className="p-4">
                <h3 className="font-semibold leading-tight">{party.title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  {party.meta}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
            How ShopFia Works
          </p>
          <h2 className="mt-2 text-3xl font-semibold tracking-normal md:text-4xl">
            From saved inspiration to the vendors behind every detail.
          </h2>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {howItWorks.map((step, index) => (
            <article
              key={step.title}
              className="rounded-[8px] border border-white/80 bg-white/85 p-6 shadow-sm"
            >
              <div className="grid h-10 w-10 place-items-center rounded-full bg-accent font-semibold text-primary">
                {index + 1}
              </div>
              <h2 className="mt-5 text-xl font-semibold">{step.title}</h2>
              <p className="mt-3 text-sm leading-7 text-muted-foreground">
                {step.body}
              </p>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[8px] border border-white/80 bg-white/85 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Bookmark className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Popular Party Styles
            </p>
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-normal">
            Inspiration that feels ready to collect.
          </h2>
          <div className="mt-6 flex flex-wrap gap-2">
            {partyStyles.map((style) => (
              <Link
                key={style}
                href={`/parties?q=${encodeURIComponent(style)}`}
                className="rounded-full border border-primary/20 bg-accent/60 px-4 py-2 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-accent"
              >
                {style}
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-[8px] border border-white/80 bg-white/85 p-6 shadow-sm">
          <div className="flex items-center gap-3">
            <Tags className="h-5 w-5 text-primary" />
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Recently Added Vendors
            </p>
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-normal">
            Book the people who made it happen.
          </h2>
          <div className="mt-6 grid gap-3">
            {recentVendors.map((vendor) => (
              <div
                key={vendor}
                className="flex items-center justify-between gap-3 rounded-[8px] border border-border/70 bg-background/70 px-4 py-3 text-sm text-muted-foreground"
              >
                <span>{vendor}</span>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-primary" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-white/80 bg-foreground text-white shadow-sm">
        <div className="grid lg:grid-cols-[1.06fr_0.94fr]">
          <div className="p-6 md:p-10">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
              Seasonal Inspiration
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-normal md:text-5xl">
              Plan from a real celebration, then make it your own.
            </h2>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/72">
              Save citrus brunches, floral showers, bow-filled birthdays, and
              candlelit dinner parties. When you are ready, connect with the
              vendors behind the details you already love.
            </p>
            <Link href="/parties" className="mt-7 inline-flex">
              <Button variant="secondary" className="rounded-[8px]">
                Browse Seasonal Ideas
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="relative min-h-[280px]">
            <Image
              src="https://images.unsplash.com/photo-1519225421980-715cb0215aed?auto=format&fit=crop&w=1200&q=80"
              alt="Elegant seasonal party table inspiration"
              fill
              sizes="(min-width: 1024px) 42vw, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
