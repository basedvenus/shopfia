import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  CalendarDays,
  Edit3,
  ExternalLink,
  Eye,
  MessageSquare,
  PackagePlus,
  Settings,
  ShoppingBag,
  Store,
  Wand2
} from "lucide-react";
import { auth } from "@/auth";
import {
  deleteOfferingAction,
  duplicateOfferingAction,
  toggleOfferingPublishedAction
} from "@/app/actions/offerings";
import { Button } from "@/components/ui/button";
import { ConnectStripeButton } from "@/components/vendor/connect-stripe-button";
import { CopyStorefrontLinkButton } from "@/components/vendor/copy-storefront-link-button";
import { storefrontPath, storefrontUrl } from "@/lib/businesses";
import { db } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

const openRequestStatuses = new Set(["SUBMITTED", "RESPONDED"]);
const activeOrderStatuses = new Set(["awaiting_payment", "paid", "in_progress"]);

export default async function BusinessDashboardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/account?next=login");
  }

  const business = await db.vendorProfile.findFirst({
    where: session.user.role === "ADMIN" ? { slug } : { slug, userId: session.user.id },
    select: {
      id: true,
      availabilityNotes: true,
      bio: true,
      city: true,
      coverPhoto: true,
      instagramUrl: true,
      logoUrl: true,
      name: true,
      photos: true,
      serviceAreaNotes: true,
      serviceRadiusMiles: true,
      slug: true,
      state: true,
      status: true,
      stripeChargesEnabled: true,
      stripeOnboardingComplete: true,
      stripePayoutsEnabled: true,
      tiktokUrl: true,
      username: true,
      website: true,
      weekendAvailable: true,
      categories: {
        select: { category: { select: { id: true, name: true } }, categoryId: true },
        take: 4
      },
      inquiries: {
        orderBy: { createdAt: "desc" },
        select: {
          createdAt: true,
          eventLocation: true,
          id: true,
          name: true,
          status: true,
          offering: { select: { title: true } }
        },
        take: 8
      },
      offerings: {
        orderBy: { createdAt: "desc" },
        select: {
          active: true,
          basePriceCents: true,
          category: { select: { name: true } },
          categories: { select: { category: { select: { id: true, name: true } } } },
          createdAt: true,
          description: true,
          id: true,
          messageForPricing: true,
          photos: true,
          slug: true,
          title: true,
          type: true
        }
      },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          amountCents: true,
          buyer: { select: { email: true, name: true } },
          buyerTotalCents: true,
          createdAt: true,
          id: true,
          offering: { select: { title: true } },
          status: true
        },
        take: 8
      },
      quoteRequests: {
        orderBy: { createdAt: "desc" },
        select: {
          buyer: { select: { email: true, name: true } },
          budgetCents: true,
          createdAt: true,
          eventLocation: true,
          id: true,
          offering: { select: { title: true } },
          quote: { select: { amountCents: true, status: true } },
          status: true
        },
        take: 8
      }
    }
  });

  if (!business) {
    redirect("/vendor/dashboard");
  }

  const publicUrl = storefrontUrl(business.slug);
  const publicPath = storefrontPath(business.slug);
  const heroImage = business.coverPhoto ?? business.logoUrl ?? business.photos[0] ?? business.offerings[0]?.photos[0] ?? null;
  const activeServices = business.offerings.filter((offering) => offering.active).length;
  const openRequests =
    business.inquiries.filter((inquiry) => inquiry.status === "NEW").length +
    business.quoteRequests.filter((request) => openRequestStatuses.has(request.status)).length;
  const activeBookings = business.orders.filter((order) => activeOrderStatuses.has(order.status)).length;
  const revenue = business.orders
    .filter((order) => ["paid", "in_progress", "completed"].includes(order.status))
    .reduce((sum, order) => sum + (order.buyerTotalCents || order.amountCents), 0);

  return (
    <div className="space-y-6 pb-10">
      <section className="overflow-hidden rounded-[1.5rem] border border-white/80 bg-white shadow-[0_18px_50px_rgba(72,44,43,0.08)]">
        <div className="relative min-h-[260px] bg-[#f8ece9]">
          {heroImage ? <Image src={heroImage} alt={`${business.name} cover`} fill priority className="object-cover" /> : null}
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/25 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-7">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/72">Business dashboard</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">{business.name} Dashboard</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-white/84">
              <span>{publicUrl.replace(/^https?:\/\//, "")}</span>
              <span>{formatStatus(business.status)}</span>
              <span>{formatLocation(business.city, business.state)}</span>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button asChild variant="secondary" className="bg-white/92">
                <Link href={publicPath}>
                  <Eye className="h-4 w-4" />
                  View Storefront
                </Link>
              </Button>
              <CopyStorefrontLinkButton url={publicUrl} />
              <Button asChild variant="secondary" className="bg-white/92">
                <Link href={`/vendor/business/${business.slug}/storefront`}>
                  <Wand2 className="h-4 w-4" />
                  Customize Storefront
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/vendor/business/${business.slug}/services/new`}>
                  <PackagePlus className="h-4 w-4" />
                  Add Service
                </Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="grid gap-px bg-[#eadbd8] sm:grid-cols-4">
          <StatTile label="Services" value={String(activeServices)} />
          <StatTile label="Open Requests" value={String(openRequests)} />
          <StatTile label="Active Bookings" value={String(activeBookings)} />
          <StatTile label="Revenue" value={formatCurrency(revenue)} />
        </div>
      </section>

      <nav className="sticky top-[88px] z-10 flex gap-2 overflow-x-auto rounded-full border border-border/70 bg-white/90 p-2 shadow-[0_14px_36px_rgba(72,44,43,0.08)] backdrop-blur">
        {["Overview", "Storefront", "Services", "Inquiries", "Bookings", "Settings"].map((item) => (
          <a key={item} href={`#${item.toLowerCase()}`} className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-[#f8ece9] hover:text-foreground">
            {item}
          </a>
        ))}
      </nav>

      <section id="overview" className="grid gap-5 lg:grid-cols-[1fr_0.8fr]">
        <Panel>
          <SectionKicker icon={<Store className="h-4 w-4" />} label="Overview" />
          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">Your business home base</h2>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {business.bio || "Add an About section so customers understand your style, services, and the celebrations you create."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {business.categories.length ? business.categories.map((item) => <SoftChip key={item.categoryId}>{item.category.name}</SoftChip>) : <SoftChip>Add a category</SoftChip>}
          </div>
        </Panel>
        <Panel>
          <SectionKicker icon={<ExternalLink className="h-4 w-4" />} label="Storefront link" />
          <div className="mt-4 rounded-[1rem] border border-[#eadbd8] bg-[#fbf7f5] px-4 py-3 text-sm font-semibold">{publicUrl.replace(/^https?:\/\//, "")}</div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <CopyStorefrontLinkButton url={publicUrl} />
            <Button asChild variant="secondary">
              <Link href={publicPath}>View Storefront</Link>
            </Button>
          </div>
        </Panel>
      </section>

      <section id="storefront" className="scroll-mt-24">
        <Panel>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <SectionKicker icon={<Wand2 className="h-4 w-4" />} label="Storefront" />
              <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em]">Customize how customers experience this business</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Manage public content, photos, social links, services, and the customer inquiry path for this specific business.
              </p>
            </div>
            <Button asChild>
              <Link href={`/vendor/business/${business.slug}/storefront`}>
                Customize Storefront
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <MiniMetric label="Logo" value={business.logoUrl ? "Added" : "Missing"} />
            <MiniMetric label="Cover" value={business.coverPhoto ? "Added" : "Missing"} />
            <MiniMetric label="Portfolio" value={`${business.photos.length} photos`} />
          </div>
        </Panel>
      </section>

      <section id="services" className="scroll-mt-24 space-y-4">
          <SectionHeader
          icon={<PackagePlus className="h-4 w-4" />}
          label="Services"
          title="Services and offerings"
          action={<Button asChild><Link href={`/vendor/business/${business.slug}/services/new`}><PackagePlus className="h-4 w-4" />Add Service</Link></Button>}
        />
        {business.offerings.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {business.offerings.map((offering) => (
              <article key={offering.id} className="overflow-hidden rounded-[1.25rem] border border-white/80 bg-white shadow-[0_18px_50px_rgba(72,44,43,0.08)]">
                <div className="relative aspect-[4/3] bg-[#f8ece9]">
                  {offering.photos[0] ? <Image src={offering.photos[0]} alt={offering.title} fill className="object-cover" /> : <div className="grid h-full place-items-center text-sm text-muted-foreground">{offering.category.name}</div>}
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold">{offering.active ? "Published" : "Unpublished"}</span>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <h3 className="text-lg font-semibold tracking-[-0.02em]">{offering.title}</h3>
                    <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{offering.description}</p>
                    <p className="mt-2 text-sm font-semibold">{formatOfferingPrice(offering)}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button asChild size="sm" variant="secondary"><Link href={`/vendor/offering/${offering.id}`}><Edit3 className="h-4 w-4" />Edit</Link></Button>
                    <Button asChild size="sm" variant="secondary"><Link href={`/offering/${offering.id}`}><Eye className="h-4 w-4" />View</Link></Button>
                    <form action={duplicateOfferingAction}>
                      <input type="hidden" name="offeringId" value={offering.id} />
                      <Button type="submit" size="sm" variant="secondary" className="w-full">Duplicate</Button>
                    </form>
                    <form action={toggleOfferingPublishedAction}>
                      <input type="hidden" name="offeringId" value={offering.id} />
                      <Button type="submit" size="sm" variant="secondary" className="w-full">{offering.active ? "Unpublish" : "Publish"}</Button>
                    </form>
                    <Button type="button" size="sm" variant="secondary" className="w-full cursor-not-allowed opacity-60" title="Service ordering is part of the storefront customization migration.">Reorder</Button>
                    <form action={deleteOfferingAction}>
                      <input type="hidden" name="offeringId" value={offering.id} />
                      <Button type="submit" size="sm" variant="secondary" className="w-full">Delete</Button>
                    </form>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No services yet" body="Add a service before this storefront is promoted through Explore and Categories." href={`/vendor/business/${business.slug}/services/new`} action="Add Service" />
        )}
      </section>

      <section id="inquiries" className="scroll-mt-24 grid gap-5 xl:grid-cols-2">
        <Panel>
          <SectionKicker icon={<MessageSquare className="h-4 w-4" />} label="Inquiries" />
          <RequestList
            items={business.inquiries.map((inquiry) => ({
              id: inquiry.id,
              title: inquiry.name,
              detail: inquiry.offering?.title ?? inquiry.eventLocation ?? "General inquiry",
              status: inquiry.status
            }))}
            empty="New customer inquiries will appear here."
          />
        </Panel>
        <Panel>
          <SectionKicker icon={<MessageSquare className="h-4 w-4" />} label="Quote requests" />
          <RequestList
            items={business.quoteRequests.map((request) => ({
              id: request.id,
              title: request.buyer.name ?? request.buyer.email ?? "Customer",
              detail: request.offering?.title ?? request.eventLocation,
              status: request.quote ? `${request.status} · ${formatCurrency(request.quote.amountCents)}` : request.status
            }))}
            empty="Quote requests connected to conversations will appear here."
          />
        </Panel>
      </section>

      <section id="bookings" className="scroll-mt-24">
        <Panel>
          <SectionKicker icon={<ShoppingBag className="h-4 w-4" />} label="Bookings" />
          <RequestList
            items={business.orders.map((order) => ({
              id: order.id,
              title: order.offering?.title ?? "Custom booking",
              detail: order.buyer.name ?? order.buyer.email ?? "Customer",
              status: `${order.status} · ${formatCurrency(order.buyerTotalCents || order.amountCents)}`
            }))}
            empty="Orders and payments will appear here after customers accept quotes."
          />
        </Panel>
      </section>

      <section id="settings" className="scroll-mt-24">
        <Panel>
          <SectionKicker icon={<Settings className="h-4 w-4" />} label="Settings" />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1rem] border border-[#eadbd8] bg-[#fbf7f5] p-4">
              <h3 className="font-semibold">Business details</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {formatLocation(business.city, business.state)} · {business.serviceRadiusMiles} mile service radius
              </p>
              <Button asChild variant="secondary" className="mt-4">
                <Link href={`/vendor/business/${business.slug}/storefront#content`}>Edit details</Link>
              </Button>
            </div>
            <div className="rounded-[1rem] border border-[#eadbd8] bg-[#fbf7f5] p-4">
              <h3 className="font-semibold">Payments</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{paymentStatus(business)}</p>
              <div className="mt-4">
                <ConnectStripeButton businessSlug={business.slug} connected={business.stripeOnboardingComplete} />
              </div>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[1.25rem] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(72,44,43,0.08)] sm:p-6">{children}</div>;
}

function SectionHeader({ action, icon, label, title }: { action?: React.ReactNode; icon: React.ReactNode; label: string; title: string }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <SectionKicker icon={icon} label={label} />
        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function SectionKicker({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">{icon}{label}</div>;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return <div className="bg-white p-4"><div className="text-2xl font-semibold tracking-tight">{value}</div><div className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div></div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[1rem] bg-[#fbf7f5] p-4"><div className="text-lg font-semibold">{value}</div><div className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div></div>;
}

function SoftChip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-[#f8ece9] px-3 py-1 text-xs font-medium text-primary">{children}</span>;
}

function RequestList({ empty, items }: { empty: string; items: Array<{ detail: string; id: string; status: string; title: string }> }) {
  if (!items.length) return <p className="mt-4 text-sm leading-6 text-muted-foreground">{empty}</p>;
  return (
    <div className="mt-4 space-y-3">
      {items.map((item) => (
        <div key={item.id} className="rounded-[1rem] border border-[#eadbd8] bg-[#fbf7f5] p-4 text-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="font-semibold">{item.title}</div>
              <div className="mt-1 text-muted-foreground">{item.detail}</div>
            </div>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold">{item.status}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ action, body, href, title }: { action: string; body: string; href: string; title: string }) {
  return (
    <div className="rounded-[1.25rem] border border-white/80 bg-white p-8 text-center shadow-[0_18px_50px_rgba(72,44,43,0.08)]">
      <h3 className="text-xl font-semibold tracking-[-0.02em]">{title}</h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{body}</p>
      <Button asChild className="mt-5"><Link href={href}>{action}</Link></Button>
    </div>
  );
}

function formatLocation(city: string, state?: string | null) {
  return state ? `${city}, ${state}` : city;
}

function formatStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function formatOfferingPrice(offering: { basePriceCents: number | null; messageForPricing: boolean }) {
  if (offering.messageForPricing) return "Message for pricing";
  return offering.basePriceCents ? `From ${formatCurrency(offering.basePriceCents)}` : "Message for pricing";
}

function paymentStatus(business: { stripeChargesEnabled: boolean; stripeOnboardingComplete: boolean; stripePayoutsEnabled: boolean }) {
  if (business.stripeChargesEnabled && business.stripePayoutsEnabled) return "Ready for payments and payouts.";
  if (business.stripeOnboardingComplete) return "Stripe onboarding is complete and awaiting final readiness.";
  return "Connect Stripe to accept payments from quotes.";
}
