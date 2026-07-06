import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { Bookmark, FolderHeart, Heart, Plus, Sparkles } from "lucide-react";
import { createFavoriteCollectionAction, toggleFavoriteAction } from "@/app/actions/favorites";
import { FavoriteToggle } from "@/components/favorites/favorite-toggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { imageCropToCss, normalizeImageCrop } from "@/lib/image-crop";
import { partyPhotoUrl } from "@/lib/party-photo-url";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const fallbackImage =
  "https://images.unsplash.com/photo-1526047932273-341f2a7631f9?auto=format&fit=crop&w=1200&q=80";
const starterCollections = [
  "Baby Shower Ideas",
  "Wedding Inspiration",
  "Vendors I Love",
  "Future Birthday Ideas",
  "Outdoor Party Inspiration"
];

export default async function FavoritesPage() {
  const [{ auth }, { db }] = await Promise.all([import("@/auth"), import("@/lib/db")]);
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-soft">
        <Heart className="mx-auto h-8 w-8 text-primary" />
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Save ideas for later.</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
          Sign in to collect vendors, parties, and services into your own inspiration boards.
        </p>
        <Link href="/account" className="mt-5 inline-flex">
          <Button>Sign in</Button>
        </Link>
      </section>
    );
  }

  const [favorites, collections] = await Promise.all([
    db.favorite.findMany({
      where: { buyerId: session.user.id },
      include: {
        collection: true,
        vendor: {
          include: {
            categories: { include: { category: true } }
          }
        },
        partyEvent: {
          include: {
            photos: { orderBy: { sortOrder: "asc" }, take: 1 }
          }
        },
        offering: {
          include: {
            category: true,
            vendor: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    }),
    db.favoriteCollection.findMany({
      where: { buyerId: session.user.id },
      include: { _count: { select: { favorites: true } } },
      orderBy: { createdAt: "desc" }
    })
  ]);

  const vendorFavorites = favorites.filter((favorite) => favorite.vendor);
  const partyFavorites = favorites.filter((favorite) => favorite.partyEvent);
  const serviceFavorites = favorites.filter((favorite) => favorite.offering);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 rounded-[2rem] border border-white/70 bg-white/75 p-6 shadow-soft lg:grid-cols-[1fr_0.72fr]">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Saved inspiration
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">
            Your favorites, curated.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
            Collect party ideas, vendors, and services as you plan. Collections are ready for boards like baby showers, weddings, future birthdays, and vendors you love.
          </p>
        </div>
        <form action={createFavoriteCollectionAction} className="self-end rounded-[1.5rem] border border-white/80 bg-white/80 p-4">
          <label className="text-sm font-semibold" htmlFor="collection-name">
            Start a collection
          </label>
          <div className="mt-3 flex gap-2">
            <Input id="collection-name" name="name" placeholder="Baby Shower Ideas" />
            <Button type="submit" className="shrink-0">
              <Plus className="h-4 w-4" />
              Create
            </Button>
          </div>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold tracking-tight">Collections</h2>
          <span className="text-sm text-muted-foreground">{collections.length} created</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {(collections.length ? collections : starterCollections.map((name) => ({ id: name, name, _count: { favorites: 0 } }))).map((collection) => (
            <Card key={collection.id} className="border-white/70 bg-white/85 transition hover:-translate-y-0.5 hover:shadow-soft">
              <CardContent className="p-4">
                <FolderHeart className="h-5 w-5 text-primary" />
                <h3 className="mt-4 font-semibold">{collection.name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {collection._count.favorites} saved item{collection._count.favorites === 1 ? "" : "s"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {favorites.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-primary/25 bg-white/70 p-8 text-center">
          <Bookmark className="mx-auto h-8 w-8 text-primary" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Nothing saved yet.</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            Tap the hearts on vendors, parties, and services to build your planning board.
          </p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/parties"><Button>Browse parties</Button></Link>
            <Link href="/explore"><Button variant="secondary">Explore vendors</Button></Link>
          </div>
        </section>
      ) : (
        <>
          <FavoriteSection title="Parties" count={partyFavorites.length}>
            {partyFavorites.map((favorite) => {
              if (!favorite.partyEvent) return null;
              const photo = favorite.partyEvent.photos[0];
              const image = photo
                ? partyPhotoUrl(photo.id, photo.updatedAt, { width: 900 })
                : favorite.partyEvent.coverImageUrl ?? favorite.partyEvent.imageUrls[0] ?? fallbackImage;
              return (
                <SavedCard
                  key={favorite.id}
                  href={`/events/${favorite.partyEvent.slug}`}
                  image={image}
                  crop={photo?.crop}
                  title={favorite.partyEvent.title}
                  eyebrow="Party"
                  meta={favorite.partyEvent.location ?? favorite.partyEvent.theme ?? "Saved inspiration"}
                  targetType="party"
                  targetId={favorite.partyEvent.id}
                />
              );
            })}
          </FavoriteSection>

          <FavoriteSection title="Vendors" count={vendorFavorites.length}>
            {vendorFavorites.map((favorite) => {
              if (!favorite.vendor) return null;
              return (
                <SavedCard
                  key={favorite.id}
                  href={`/vendor/profile/${favorite.vendor.slug}`}
                  image={favorite.vendor.coverPhoto ?? favorite.vendor.photos[0] ?? favorite.vendor.logoUrl ?? fallbackImage}
                  title={favorite.vendor.name}
                  eyebrow="Vendor"
                  meta={[favorite.vendor.city, favorite.vendor.state].filter(Boolean).join(", ")}
                  targetType="vendor"
                  targetId={favorite.vendor.id}
                />
              );
            })}
          </FavoriteSection>

          <FavoriteSection title="Services" count={serviceFavorites.length}>
            {serviceFavorites.map((favorite) => {
              if (!favorite.offering) return null;
              const crop = Array.isArray(favorite.offering.photoCrops)
                ? favorite.offering.photoCrops[0]
                : null;
              return (
                <SavedCard
                  key={favorite.id}
                  href={`/offering/${favorite.offering.id}`}
                  image={favorite.offering.photos[0] ?? favorite.offering.vendor.coverPhoto ?? fallbackImage}
                  crop={crop}
                  title={favorite.offering.title}
                  eyebrow={favorite.offering.category.name}
                  meta={
                    favorite.offering.messageForPricing
                      ? "Message for pricing"
                      : favorite.offering.basePriceCents
                        ? `From ${formatCurrency(favorite.offering.basePriceCents)}`
                        : "Custom pricing"
                  }
                  targetType="offering"
                  targetId={favorite.offering.id}
                />
              );
            })}
          </FavoriteSection>
        </>
      )}
    </div>
  );
}

function FavoriteSection({
  children,
  count,
  title
}: {
  children: ReactNode;
  count: number;
  title: string;
}) {
  if (count === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <span className="text-sm text-muted-foreground">{count} saved</span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function SavedCard({
  crop,
  eyebrow,
  href,
  image,
  meta,
  targetId,
  targetType,
  title
}: {
  crop?: unknown;
  eyebrow: string;
  href: string;
  image: string;
  meta: string;
  targetId: string;
  targetType: "vendor" | "party" | "offering";
  title: string;
}) {
  async function removeFavorite() {
    "use server";

    await toggleFavoriteAction(targetType, targetId);
  }

  return (
    <Card className="group relative overflow-hidden border-white/70 bg-white/90 transition hover:-translate-y-0.5 hover:shadow-soft">
      <Link href={href} className="absolute inset-0 z-10" aria-label={`Open ${title}`} />
      <div className="relative aspect-[4/3] bg-muted">
        <Image
          src={image}
          alt={title}
          fill
          sizes="(min-width: 1280px) 33vw, (min-width: 640px) 50vw, 100vw"
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
          style={imageCropToCss(normalizeImageCrop(crop))}
        />
        <div className="absolute right-3 top-3 z-20">
          <FavoriteToggle targetType={targetType} targetId={targetId} isSaved />
        </div>
      </div>
      <CardContent className="p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">{eyebrow}</p>
        <h3 className="mt-2 line-clamp-1 font-semibold">{title}</h3>
        <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{meta}</p>
        <form action={removeFavorite} className="relative z-20 mt-4">
          <Button type="submit" size="sm" variant="secondary" className="w-full">
            Remove from favorites
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
