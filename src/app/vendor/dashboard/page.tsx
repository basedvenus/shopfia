import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, ExternalLink, Plus, Store } from "lucide-react";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { CopyStorefrontLinkButton } from "@/components/vendor/copy-storefront-link-button";
import { storefrontPath } from "@/lib/businesses";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MyBusinessesPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/account?next=login");
  }

  const businesses = await db.vendorProfile.findMany({
    where: session.user.role === "ADMIN" ? {} : { userId: session.user.id },
    select: {
      id: true,
      coverPhoto: true,
      logoUrl: true,
      name: true,
      photos: true,
      slug: true,
      categories: {
        include: { category: true },
        take: 2
      },
      offerings: {
        select: { id: true, active: true }
      },
      inquiries: {
        where: { status: "NEW" },
        select: { id: true }
      },
      orders: {
        select: { id: true, amountCents: true, status: true }
      }
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }]
  });

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Vendor dashboard</p>
          <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em]">My Businesses</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Manage each private business dashboard separately while every storefront keeps its own public link, services, messages, bookings, and trust details.
          </p>
        </div>
        <Button asChild>
          <Link href="/onboarding?newBusiness=1#profile">
            <Plus className="h-4 w-4" />
            Add a Business
          </Link>
        </Button>
      </div>

      {businesses.length ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {businesses.map((business) => {
            const image = business.coverPhoto ?? business.logoUrl ?? business.photos[0] ?? null;
            const openOrders = business.orders.filter((order) => ["awaiting_payment", "paid", "in_progress"].includes(order.status));
            const revenue = business.orders
              .filter((order) => ["paid", "in_progress", "completed"].includes(order.status))
              .reduce((sum, order) => sum + order.amountCents, 0);

            return (
              <article
                key={business.id}
                className="group overflow-hidden rounded-[1.5rem] border border-white/80 bg-white shadow-[0_18px_50px_rgba(72,44,43,0.08)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(72,44,43,0.12)]"
              >
                <div className="relative aspect-[16/9] bg-[#f8ece9]">
                  {image ? (
                    <Image src={image} alt={`${business.name} cover`} fill className="object-cover transition duration-500 group-hover:scale-[1.02]" />
                  ) : (
                    <div className="absolute inset-0 grid place-items-center text-sm font-medium text-muted-foreground">
                      {business.categories[0]?.category.name ?? "ShopFia business"}
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                    <div className="flex items-end gap-3">
                      <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-white/90 text-sm font-semibold text-primary">
                        {business.logoUrl ? <Image src={business.logoUrl} alt={`${business.name} logo`} fill className="object-cover" /> : business.name.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate text-2xl font-semibold tracking-tight">{business.name}</h2>
                        <p className="truncate text-xs text-white/80">{storefrontPath(business.slug)}</p>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-4 p-5">
                  <div className="rounded-[1rem] border border-[#eadbd8] bg-[#fbf7f5] px-3 py-2 text-xs font-semibold text-muted-foreground">
                    {storefrontPath(business.slug).replace("/", "shopfia.app/")}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {business.categories.length ? (
                      business.categories.map((item) => (
                        <span key={item.categoryId} className="rounded-full bg-[#f8ece9] px-3 py-1 text-xs font-medium text-primary">
                          {item.category.name}
                        </span>
                      ))
                    ) : (
                      <span className="rounded-full bg-[#f8ece9] px-3 py-1 text-xs font-medium text-primary">Add category</span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <Metric label="Services" value={String(business.offerings.filter((offering) => offering.active).length)} />
                    <Metric label="Requests" value={String(business.inquiries.length)} />
                    <Metric label="Orders" value={String(openOrders.length)} />
                  </div>
                  <div className="flex items-center justify-between gap-3 border-t border-[#f1e2dd] pt-4 text-sm">
                    <span className="text-muted-foreground">Revenue {formatCurrency(revenue)}</span>
                    <Button asChild size="sm">
                      <Link href={`/vendor/business/${business.slug}`}>
                        Manage Business
                        <ArrowUpRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <Button asChild variant="secondary" size="sm" className="w-full">
                      <Link href={storefrontPath(business.slug)}>
                        <ExternalLink className="h-4 w-4" />
                        View Storefront
                      </Link>
                    </Button>
                    <CopyStorefrontLinkButton url={`https://www.shopfia.app${storefrontPath(business.slug)}`} />
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="rounded-[2rem] border border-white/80 bg-white p-8 text-center shadow-[0_18px_50px_rgba(72,44,43,0.08)]">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-[#f8deda] text-primary">
            <Store className="h-6 w-6" />
          </div>
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em]">Create your first business storefront.</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            One ShopFia account can manage multiple businesses, each with its own storefront, offerings, messages, orders, and verification details.
          </p>
          <Button asChild className="mt-6">
            <Link href="/onboarding?newBusiness=1#profile">
              <Plus className="h-4 w-4" />
              Add a Business
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1rem] bg-[#fbf7f5] p-3">
      <div className="text-lg font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div>
    </div>
  );
}
