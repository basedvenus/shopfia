import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Camera,
  Heart,
  PartyPopper,
  Search,
  Sparkles,
  Tags,
  UsersRound
} from "lucide-react";
import { Button } from "@/components/ui/button";

const partyTiles = [
  {
    title: "Citrus Garden Brunch",
    image: "/demo/fairfield-lemon-tablescape.png",
    href: "/events/citrus-garden-brunch",
    tags: ["lemons", "floral", "brunch"],
    vendor: "Florals by Solano Flora & Table",
    className: "md:row-span-2"
  },
  {
    title: "Tulip Cookie Shower",
    image: "/demo/vacaville-cookie-tulips.png",
    href: "/events/tulip-cookie-shower",
    tags: ["baby shower", "pastel", "cookies"],
    vendor: "Cookies by Blush Batch",
    className: ""
  },
  {
    title: "Backyard Floral Dinner",
    image:
      "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80",
    href: "/explore?q=florals",
    tags: ["garden party", "tablescape"],
    vendor: "Florals, rentals, and table styling",
    className: ""
  }
];

const valueProps = [
  {
    icon: Search,
    title: "Browse real parties",
    body: "See showers, brunches, birthdays, and dinners by theme, mood, local vendors, and real photos."
  },
  {
    icon: Tags,
    title: "Find local artisans",
    body: "Discover cookie artists, balloon stylists, florists, bakers, backdrops, rentals, photographers, and more."
  },
  {
    icon: BadgeCheck,
    title: "See the real work",
    body: "Vendor profiles become richer when hosts tag the people who helped bring actual celebrations to life."
  }
];

export default function Page() {
  return (
    <div className="-mt-6 space-y-16 pb-10">
      <section className="grid min-h-[calc(100vh-5rem)] items-center gap-10 overflow-hidden py-8 lg:grid-cols-[0.88fr_1.12fr]">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/80 bg-white/75 px-3 py-1 text-sm text-muted-foreground shadow-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            Real parties, local vendors, warm inspiration
          </div>
          <h1 className="mt-5 text-5xl font-semibold tracking-tight text-foreground md:text-6xl lg:text-7xl">
            Bring your party to life.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-muted-foreground md:text-lg">
            From custom cookies to balloon garlands to florals to backdrops, ShopFia
            helps you discover local artisans, browse real parties, and see the people
            behind every celebration.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link href="/explore">
              <Button size="lg">
                <Search className="h-4 w-4" />
                Explore Vendors
              </Button>
            </Link>
            <Link href="/parties">
              <Button size="lg" variant="secondary">
                <PartyPopper className="h-4 w-4" />
                Browse Parties
              </Button>
            </Link>
            <Link href="/account">
              <Button size="lg" variant="secondary">
                <UsersRound className="h-4 w-4" />
                Create Your Profile
              </Button>
            </Link>
          </div>
          <div className="mt-9 grid max-w-lg grid-cols-3 gap-3 text-sm">
            <div className="rounded-[1.15rem] border border-white/80 bg-white/75 p-3 shadow-sm">
              <p className="text-2xl font-semibold text-foreground">120+</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">party ideas and vendor moments</p>
            </div>
            <div className="rounded-[1.15rem] border border-white/80 bg-white/75 p-3 shadow-sm">
              <p className="text-2xl font-semibold text-foreground">Local</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">artists, bakers, florists, stylists</p>
            </div>
            <div className="rounded-[1.15rem] border border-white/80 bg-white/75 p-3 shadow-sm">
              <p className="text-2xl font-semibold text-foreground">Social</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">real hosts, real photos, real parties</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="grid auto-rows-[180px] grid-cols-2 gap-3 md:auto-rows-[220px]">
            {partyTiles.map((tile, index) => (
              <Link
                key={tile.title}
                href={tile.href}
                className={`group relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-muted shadow-soft ${tile.className}`}
              >
                <Image
                  src={tile.image}
                  alt={tile.title}
                  fill
                  priority={index === 0}
                  sizes={index === 0 ? "(min-width: 1024px) 32vw, 50vw" : "(min-width: 1024px) 28vw, 50vw"}
                  className="object-cover transition duration-500 group-hover:scale-[1.03]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {tile.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-full bg-white/15 px-2 py-1 text-[11px] backdrop-blur">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-lg font-semibold">{tile.title}</h2>
                  <p className="mt-1 text-xs text-white/80">{tile.vendor}</p>
                </div>
              </Link>
            ))}

            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/85 p-4 shadow-soft">
              <div className="grid h-full place-items-center text-center">
                <div>
                  <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-accent">
                    <Camera className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="mt-4 font-semibold">Tag vendors at your own party.</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Upload party photos, add tags, and share the vendors behind your celebration.
                  </p>
                  <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    <Heart className="h-3.5 w-3.5" />
                    Real hosts, real recommendations
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {valueProps.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded-[1.5rem] border border-white/80 bg-white/85 p-5 shadow-sm">
              <Icon className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-xl font-semibold tracking-tight">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-sm text-muted-foreground shadow-sm">
            <Heart className="h-4 w-4 text-primary" />
            The social product loop
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
            Follow hosts. Find vendors. Save what feels like you.
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted-foreground">
            ShopFia is built around the way people actually plan events: a friend posts a beautiful
            shower, you tap into the party story, see the florist and baker tagged, then save the
            vendor for your own celebration.
          </p>
          <Link href="/explore" className="mt-6 inline-flex">
            <Button>
              Start browsing
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {["Friend posts a baby shower", "Vendor tags are linked", "You save the artisan"].map((step, index) => (
            <div key={step} className="rounded-[1.5rem] border border-white/80 bg-white/85 p-5 shadow-sm">
              <div className="grid h-10 w-10 place-items-center rounded-full bg-accent font-semibold text-primary">
                {index + 1}
              </div>
              <h3 className="mt-4 font-semibold">{step}</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {index === 0
                  ? "Real celebrations become searchable inspiration."
                  : index === 1
                    ? "Each vendor tag shows where their work appeared."
                    : "Discovery turns into favorites, inquiries, and bookings."}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
