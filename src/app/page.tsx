import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarHeart,
  CakeSlice,
  Flower2,
  GlassWater,
  Heart,
  PartyPopper,
  Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { partyInspirationExamples } from "@/lib/party-inspiration";

const landingPartyExamples = partyInspirationExamples.map((party, index) =>
  index === 0
    ? {
        ...party,
        title: "Candy Boards",
        theme: "A sweet spring celebration",
        coverImageUrl: "/landing/pastel-easter-treats.webp",
        href: "/parties"
      }
    : {
        ...party,
        title: "Custom Cookies",
        theme: "Decorated cookies",
        coverImageUrl: "/landing/custom-cookies.webp",
        href: "/parties"
      }
);

const partyImages = [
  ...landingPartyExamples.map((party, index) => ({
    title: party.title,
    image: party.coverImageUrl,
    href: party.href,
    detail: party.theme,
    className: index === 0 ? "md:col-span-2 md:row-span-3" : ""
  })),
  {
    title: "Florals",
    image: "/landing/floral-arrangements.webp",
    href: "/parties",
    detail: "Blush roses in bloom",
    className: ""
  },
  {
    title: "Beach Birthdays",
    image: "/landing/beach-birthdays.webp",
    href: "/parties",
    detail: "Celebrations by the sea",
    className: "col-span-2 row-span-2"
  }
];

const categoryCards = [
  {
    name: "Cakes",
    description: "Custom cakes, tiered cakes, smash cakes",
    image: "/landing/cakes-category-close.webp",
    icon: CakeSlice
  },
  {
    name: "Balloons",
    description: "Balloon arches, garlands, and bouquets",
    image: "/landing/balloons-category.webp",
    icon: PartyPopper
  },
  {
    name: "Florals",
    description: "Centerpieces, bouquets, and floral installations",
    image: "/landing/florals-category.webp",
    icon: Flower2
  },
  {
    name: "Decor",
    description: "Table styling, signs, and party displays",
    image: "/landing/decor-category.webp",
    icon: Sparkles
  },
  {
    name: "Cookies",
    description: "Custom cookies in all shapes and sizes",
    image: "/landing/cookies-category.webp",
    icon: Heart
  },
  {
    name: "Rentals",
    description: "Backdrops, bar carts, and tents",
    image: "/landing/rentals-dessert-cart.webp",
    icon: CalendarHeart
  },
  {
    name: "Desserts",
    description: "Cakes, cupcakes, and pies",
    image: "/landing/desserts-category.webp",
    icon: CakeSlice
  },
  {
    name: "Drinks",
    description: "Bartenders, bar carts, and signature drinks",
    image: "/landing/drinks-category.webp",
    icon: GlassWater
  }
];

const featuredParties = [
  ...landingPartyExamples.map((party, index) => ({
    title: index === 0 ? "Desserts" : index === 1 ? "Birthday Displays" : party.title,
    meta: index === 0 ? "Sweet details for your celebration" : index === 1 ? "Details for a birthday celebration" : party.theme,
    image: index === 0 ? "/landing/featured-desserts.webp" : index === 1 ? "/landing/birthday-displays.webp" : party.coverImageUrl,
    href: party.href
  })),
  {
    title: "Backdrops",
    meta: "Backdrops for your celebration",
    image: "/landing/backdrops.webp",
    href: "/parties"
  }
];

const howItWorks = [
  {
    title: "Pick a theme",
    body: "Find inspiration from baby showers, birthdays, weddings, bridal showers, and more."
  },
  {
    title: "Book your vendor",
    body: "Find your vendors, discuss the details, and book your celebration."
  },
  {
    title: "Post your party",
    body: "Share your photos and tag the vendors who made it happen."
  }
];

export default function Page() {
  return (
    <div className="-mt-6 space-y-20 pb-12 font-sans">
      <section className="grid items-center gap-10 overflow-hidden py-8 lg:grid-cols-[0.84fr_1.16fr]">
        <div className="max-w-2xl">
          <div className="flex items-center gap-4 text-xs font-semibold uppercase tracking-[0.16em] text-[#a85f5e]">
            <span className="h-px w-12 bg-[#a85f5e]" />
            <span>Real celebrations, shoppable inspiration</span>
          </div>
          <h1 className="mt-7 text-5xl font-semibold leading-[1.02] tracking-normal text-foreground md:text-6xl lg:text-7xl">
            Find the vendors behind{" "}
            <span
              className="shopfia-editorial-heading font-normal italic text-primary"
              style={{
                fontFamily: 'var(--font-shopfia-serif), Canela, "Editorial New", "Iowan Old Style", Georgia, serif',
                fontWeight: 500
              }}
            >
              every party.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground md:text-lg">
            Browse real celebrations to discover the cake artists, florists,
            balloon stylists, decorators, rentals, and vendors behind every detail.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/parties">
              <Button
                size="lg"
                className="h-12 rounded-[8px] px-8 shadow-sm hover:shadow-sm"
                style={{
                  background: "linear-gradient(90deg, #E3A7A7 0%, #EAB8B3 100%)",
                  color: "#ffffff",
                  borderColor: "#E6B0AE",
                  boxShadow: "0 1px 2px 0 rgb(0 0 0 / 0.05)"
                }}
              >
                Explore Real Parties
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/explore">
              <Button
                size="lg"
                variant="secondary"
                className="h-12 rounded-[8px] border-border bg-white px-8 text-foreground shadow-sm transition hover:bg-muted"
              >
                Find Local Vendors
              </Button>
            </Link>
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
                style={{ objectPosition: party.title === "Beach Birthdays" ? "center 55%" : "center" }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              <div className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-foreground opacity-0 transition group-hover:opacity-100">
                <ArrowUpRight className="h-4 w-4" />
              </div>
              <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                <h2 className="text-lg font-semibold leading-tight">{party.title}</h2>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section
        className="!mt-6 bg-white px-5 pb-6 pt-12 text-center md:px-10"
        style={{ boxShadow: "0 0 0 100vmax white", clipPath: "inset(0 -100vmax)" }}
      >
        <h2
          className="mx-auto flex max-w-6xl flex-wrap items-baseline justify-center gap-x-4 gap-y-2 text-5xl font-bold uppercase leading-none tracking-wide md:gap-x-6 md:text-6xl lg:text-7xl"
          style={{ fontFamily: '"DIN Condensed", "Arial Narrow", Impact, sans-serif' }}
        >
          <span className="text-[#f4bfc2]">FESTIVITIES.</span>
          <span className="text-[#f0b4a8]">INSPIRATION.</span>
          <span className="text-[#f7caaa]">ARTISANS.</span>
        </h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-muted-foreground md:text-base">
          Discover the inspiration, the details, and the people who bring it all to life.
        </p>
      </section>

      <section className="!mt-8 space-y-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a85f5e]">
              Trending Categories
            </p>
            <h2 className="shopfia-editorial-heading mt-2 text-3xl tracking-normal md:text-4xl">
              Plan your party with local vendors and real inspiration.
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
                  <p className="mt-1 text-xs font-medium uppercase tracking-[0.12em] text-white/90">
                    {category.description}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a85f5e]">
            Inspiration examples
          </p>
          <h2 className="shopfia-editorial-heading mt-2 text-3xl tracking-normal md:text-4xl">
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
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#a85f5e]">
            How ShopFia Works
          </p>
          <h2 className="shopfia-editorial-heading mt-2 text-3xl tracking-normal md:text-4xl">
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

    </div>
  );
}
