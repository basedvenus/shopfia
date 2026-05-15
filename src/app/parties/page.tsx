import Link from "next/link";
import { CalendarHeart, MapPin, Sparkles, Tags } from "lucide-react";
import { CroppedImage } from "@/components/ui/cropped-image";
import { db } from "@/lib/db";
import { normalizeImageCrop } from "@/lib/image-crop";
import { getSafeProfileImage } from "@/lib/profile-image";

export const dynamic = "force-dynamic";

const demoParties = [
  {
    title: "Citrus Garden Brunch",
    theme: "Lemon tablescape inspiration",
    tags: ["lemons", "floral", "brunch"],
    location: "Fairfield, CA",
    coverImageUrl: "/demo/fairfield-lemon-tablescape.png",
    slug: "citrus-garden-brunch",
    vendorCount: 1,
    photoCount: 1,
    host: "ShopFia"
  },
  {
    title: "Tulip Cookie Shower",
    theme: "Pastel cookie favors",
    tags: ["baby shower", "pastel", "cookies"],
    location: "Vacaville, CA",
    coverImageUrl: "/demo/vacaville-cookie-tulips.png",
    slug: "tulip-cookie-shower",
    vendorCount: 1,
    photoCount: 1,
    host: "ShopFia"
  }
];

export default async function PartiesPage() {
  const parties = await db.partyEvent.findMany({
    include: {
      user: {
        select: {
          image: true,
          name: true,
          username: true
        }
      },
      photos: {
        orderBy: { sortOrder: "asc" },
        include: {
          taggedVendors: {
            select: {
              id: true,
              name: true,
              slug: true
            }
          }
        }
      },
      taggedVendors: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    },
    orderBy: [{ createdAt: "desc" }],
    take: 36
  });

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/60 p-6 shadow-soft md:p-8">
        <div className="flex max-w-4xl flex-col gap-4">
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-primary/20 bg-white/75 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Real parties near you
          </div>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
              Discover real parties near you.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              Browse celebrations styled by local artisans, see tagged vendors in context, and save the details that feel like your next event.
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {parties.length > 0
          ? parties.map((party) => {
              const { crop, image } = getEventImage(party);
              const vendors = getUniqueVendors(party);
              const hostImage = getSafeProfileImage(party.user.image);
              const hostName = party.user.name ?? party.user.username ?? "ShopFia host";

              return (
                <Link
                  key={party.id}
                  href={`/events/${party.slug}`}
                  className="group overflow-hidden rounded-[1.6rem] border border-white/75 bg-white/85 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
                >
                  <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                    <CroppedImage src={image} alt="" crop={crop} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
                      {(party.tags.length ? party.tags : [party.theme].filter(Boolean))
                        .slice(0, 3)
                        .map((tag) => (
                          <span key={tag} className="rounded-full bg-white/20 px-2.5 py-1 text-xs text-white backdrop-blur">
                            #{tag}
                          </span>
                        ))}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                      <h2 className="text-2xl font-semibold tracking-tight">{party.title}</h2>
                      {party.location || party.city ? (
                        <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-white/80">
                          <MapPin className="h-4 w-4" />
                          {party.location ?? [party.city, party.state].filter(Boolean).join(", ")}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <div className="space-y-4 p-5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2.5">
                        {hostImage ? (
                          <img src={hostImage} alt="" className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                            {hostName.slice(0, 2).toUpperCase()}
                          </span>
                        )}
                        <span className="truncate text-sm text-muted-foreground">Posted by {hostName}</span>
                      </div>
                      <span className="shrink-0 rounded-full bg-[#fff7f4] px-3 py-1 text-xs text-muted-foreground">
                        {party.theme ?? "Party story"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-white px-3 py-1.5">
                        <CalendarHeart className="h-3.5 w-3.5" />
                        {party.photos.length || party.imageUrls.length || 1} photos
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-white px-3 py-1.5">
                        <Tags className="h-3.5 w-3.5" />
                        {vendors.length} tagged vendor{vendors.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {vendors.length > 0 ? (
                      <p className="line-clamp-1 text-sm text-muted-foreground">
                        Vendors: {vendors.slice(0, 3).map((vendor) => vendor.name).join(", ")}
                      </p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Vendor tags will appear as hosts add them to party photos.
                      </p>
                    )}
                  </div>
                </Link>
              );
            })
          : demoParties.map((party) => (
              <Link
                key={party.title}
                href={`/events/${party.slug}`}
                className="group overflow-hidden rounded-[1.6rem] border border-white/75 bg-white/85 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft"
              >
                <div className="relative aspect-[4/5] overflow-hidden bg-muted">
                  <div
                    className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-[1.04]"
                    style={{ backgroundImage: `url(${party.coverImageUrl})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                  <div className="absolute left-4 top-4 flex flex-wrap gap-1.5">
                    {party.tags.map((tag) => (
                      <span key={tag} className="rounded-full bg-white/20 px-2.5 py-1 text-xs text-white backdrop-blur">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                    <h2 className="text-2xl font-semibold tracking-tight">{party.title}</h2>
                    <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-white/80">
                      <MapPin className="h-4 w-4" />
                      {party.location}
                    </p>
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-muted-foreground">Posted by {party.host}</span>
                    <span className="rounded-full bg-[#fff7f4] px-3 py-1 text-xs text-muted-foreground">
                      {party.theme}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-white px-3 py-1.5">
                      <CalendarHeart className="h-3.5 w-3.5" />
                      {party.photoCount} photo
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/80 bg-white px-3 py-1.5">
                      <Tags className="h-3.5 w-3.5" />
                      {party.vendorCount} tagged vendor
                    </span>
                  </div>
                </div>
              </Link>
            ))}
      </section>
    </div>
  );
}

function getUniqueVendors(party: {
  taggedVendors: Array<{ id: string; name: string; slug: string }>;
  photos: Array<{ taggedVendors: Array<{ id: string; name: string; slug: string }> }>;
}) {
  const vendorMap = new Map<string, { id: string; name: string; slug: string }>();
  party.taggedVendors.forEach((vendor) => vendorMap.set(vendor.id, vendor));
  party.photos.forEach((photo) => {
    photo.taggedVendors.forEach((vendor) => vendorMap.set(vendor.id, vendor));
  });
  return Array.from(vendorMap.values());
}

function getEventImage(event: {
  coverImageUrl: string | null;
  imageUrls: string[];
  photos: Array<{ crop: unknown; id: string; updatedAt: Date }>;
}) {
  return event.photos[0]
    ? {
        crop: normalizeImageCrop(event.photos[0].crop),
        image: `/api/party-photos/${event.photos[0].id}?v=${event.photos[0].updatedAt.getTime()}`
      }
    : {
        crop: normalizeImageCrop(null),
        image: event.coverImageUrl ?? event.imageUrls[0] ?? "/demo/fairfield-lemon-tablescape.png"
      };
}
