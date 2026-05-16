import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Heart,
  MapPin,
  Search,
  Tags,
  Upload,
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
    icon: Tags,
    title: "Real parties. Tagged vendors.",
    body: "See the cake, florals, balloons, rentals, and backdrops behind each celebration."
  },
  {
    icon: Search,
    title: "Inspiration you can hire.",
    body: "Browse by theme, detail, city, and vendor so saved ideas can turn into real bookings."
  },
  {
    icon: BadgeCheck,
    title: "Community-built proof.",
    body: "Hosts help vendor profiles grow through real event photos, not anonymous review blurbs."
  }
];

export default function Page() {
  return (
    <div className="-mt-6 space-y-16 pb-10 [font-family:Inter,ui-sans-serif,system-ui,sans-serif]">
      <section className="grid min-h-[calc(100vh-5rem)] items-center gap-12 overflow-hidden py-8 lg:grid-cols-[0.86fr_1.14fr]">
        <div className="max-w-2xl">
          <div className="flex items-center gap-4 text-xs font-semibold uppercase text-primary">
            <span className="h-px w-12 bg-primary" />
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span>Real parties · local vendors</span>
          </div>
          <h1 className="mt-7 text-5xl font-semibold leading-[1.02] tracking-normal text-foreground md:text-6xl lg:text-7xl [font-family:'PP_Neue_Montreal','Satoshi','Instrument_Sans',Inter,ui-sans-serif,system-ui,sans-serif]">
            Discover the
            <br />
            people behind
            <br />
            <span className="font-normal italic text-primary [font-family:'Canela','Editorial_New','Iowan_Old_Style','Times_New_Roman',serif]">
              the party.
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-8 text-muted-foreground md:text-lg">
            From custom cookies to balloon garlands to florals and decor, ShopFia
            connects you with trusted local vendors through real celebrations shared
            by your community.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/explore">
              <Button size="lg" className="h-12 rounded-md px-8">
                Explore
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/parties">
              <Button size="lg" variant="secondary" className="h-12 rounded-md px-8">
                Browse Parties
              </Button>
            </Link>
            <Link href="/account">
              <Button size="lg" variant="secondary" className="h-12 rounded-md px-8">
                Sign Up
              </Button>
            </Link>
          </div>
          <div className="mt-12 grid max-w-xl grid-cols-3 divide-x divide-primary/20 border-y border-primary/15 py-5 text-sm">
            <div className="pr-5">
              <div className="mb-5 grid h-11 w-11 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                <UsersRound className="h-5 w-5" />
              </div>
              <p className="text-3xl font-semibold text-foreground">120+</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">party ideas and vendor moments</p>
            </div>
            <div className="px-5">
              <div className="mb-5 grid h-11 w-11 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                <MapPin className="h-5 w-5" />
              </div>
              <p className="text-3xl font-semibold text-foreground">Local</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">artists, bakers, florists, stylists</p>
            </div>
            <div className="pl-5">
              <div className="mb-5 grid h-11 w-11 place-items-center rounded-full border border-primary/25 bg-primary/10 text-primary">
                <Heart className="h-5 w-5" />
              </div>
              <p className="text-3xl font-semibold text-foreground">Social</p>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">real hosts, real photos, real parties</p>
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="grid auto-rows-[180px] grid-cols-2 gap-3 md:auto-rows-[220px]">
            {partyTiles.map((tile, index) => (
              <Link
                key={tile.title}
                href={tile.href}
                className={`group relative overflow-hidden rounded-xl border border-white/80 bg-muted shadow-sm ${tile.className}`}
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
                <div className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/85 text-foreground opacity-0 transition group-hover:opacity-100">
                  <ArrowUpRight className="h-4 w-4" />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {tile.tags.slice(0, 3).map((tag) => (
                      <span key={tag} className="rounded-md bg-white/15 px-2 py-1 text-[11px] backdrop-blur">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <h2 className="text-xl font-semibold">{tile.title}</h2>
                  <p className="mt-1 text-xs text-white/80">{tile.vendor}</p>
                </div>
              </Link>
            ))}

            <div className="relative col-span-2 overflow-hidden rounded-xl border border-white/80 bg-white/80 p-6 shadow-sm">
              <div className="flex h-full items-center gap-6">
                <div className="grid h-20 w-20 shrink-0 place-items-center rounded-full border border-primary/30 bg-white text-primary">
                  <Upload className="h-8 w-8" />
                </div>
                <div className="max-w-md">
                  <h2 className="text-xl font-semibold">Tag vendors at your own party.</h2>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Upload party photos, add tags, and share the vendors behind your celebration.
                  </p>
                  <Link href="/my-parties" className="mt-4 inline-flex items-center gap-2 border-b border-primary/40 pb-1 text-sm font-medium text-primary">
                    For hosts: real recommendations
                    <ArrowRight className="h-4 w-4" />
                  </Link>
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
            <article key={item.title} className="rounded-xl border border-white/80 bg-white/85 p-5 shadow-sm">
              <Icon className="h-5 w-5 text-primary" />
              <h2 className="mt-4 text-xl font-semibold tracking-normal">{item.title}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.body}</p>
            </article>
          );
        })}
      </section>

      <section className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-sm text-muted-foreground shadow-sm">
            <Heart className="h-4 w-4 text-primary" />
            Discovery through real events
          </div>
          <h2 className="mt-4 text-3xl font-semibold tracking-normal md:text-4xl">
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
            <div key={step} className="rounded-xl border border-white/80 bg-white/85 p-5 shadow-sm">
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
