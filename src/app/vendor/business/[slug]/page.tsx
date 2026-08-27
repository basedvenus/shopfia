import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronDown, Edit3, Eye, MessageSquare, PackagePlus, Settings, ShoppingBag, Store, Wand2 } from "lucide-react";
import { auth } from "@/auth";
import { deleteOfferingAction, duplicateOfferingAction, toggleOfferingPublishedAction } from "@/app/actions/offerings";
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
  if (!session?.user?.id) redirect("/account?next=login");

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
      website: true,
      categories: { select: { category: { select: { name: true } }, categoryId: true }, take: 4 },
      inquiries: {
        orderBy: { createdAt: "desc" },
        select: { eventLocation: true, id: true, name: true, status: true, offering: { select: { title: true } } },
        take: 8
      },
      offerings: {
        orderBy: { createdAt: "desc" },
        select: {
          active: true,
          basePriceCents: true,
          category: { select: { name: true } },
          description: true,
          id: true,
          messageForPricing: true,
          photos: true,
          title: true
        }
      },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          amountCents: true,
          buyer: { select: { email: true, name: true } },
          buyerTotalCents: true,
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
          eventLocation: true,
          id: true,
          offering: { select: { title: true } },
          quote: { select: { amountCents: true } },
          status: true
        },
        take: 8
      }
    }
  });

  if (!business) redirect("/vendor/dashboard");

  const publicUrl = storefrontUrl(business.slug);
  const publicPath = storefrontPath(business.slug);
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
      <header className="rounded-[1.25rem] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(72,44,43,0.08)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full bg-[#f8deda] text-xl font-semibold text-primary">
              {business.logoUrl ? <img src={business.logoUrl} alt={`${business.name} logo`} className="absolute inset-0 h-full w-full object-cover" /> : initials(business.name)}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Business dashboard</p>
              <h1 className="mt-1 truncate text-3xl font-semibold tracking-[-0.04em]">{business.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Storefront status: {storefrontStatus(business)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href={`/vendor/business/${business.slug}/storefront`}>
                <Wand2 className="h-4 w-4" />
                Edit Storefront
              </Link>
            </Button>
            <details className="group relative">
              <summary className="inline-flex h-10 cursor-pointer list-none items-center justify-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-medium transition hover:bg-muted">
                More
                <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
              </summary>
              <div className="absolute right-0 z-20 mt-2 w-56 rounded-[1rem] border border-border bg-white p-2 shadow-[0_18px_50px_rgba(72,44,43,0.14)]">
                <MenuLink href={publicPath} icon={<Eye className="h-4 w-4" />} label="View Live Storefront" />
                <CopyStorefrontLinkButton url={publicUrl} label="Copy Link" className="h-9 w-full justify-start bg-white px-3 shadow-none" />
                <MenuLink href="#settings" icon={<Settings className="h-4 w-4" />} label="Business Settings" />
              </div>
            </details>
          </div>
        </div>
      </header>

      <nav className="sticky top-[88px] z-10 flex gap-2 overflow-x-auto rounded-full border border-border/70 bg-white/90 p-2 shadow-[0_14px_36px_rgba(72,44,43,0.08)] backdrop-blur">
        {["Home", "Storefront", "Services", "Inquiries", "Bookings", "Settings"].map((item) => (
          <a key={item} href={`#${item.toLowerCase()}`} className="whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-[#f8ece9] hover:text-foreground">
            {item}
          </a>
        ))}
      </nav>

      <section id="home" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatTile label="Services" value={String(activeServices)} />
        <StatTile label="Open Requests" value={String(openRequests)} />
        <StatTile label="Active Bookings" value={String(activeBookings)} />
        <StatTile label="Revenue" value={formatCurrency(revenue)} />
      </section>

      <section id="storefront" className="scroll-mt-24">
        <Panel>
          <SectionKicker icon={<Store className="h-4 w-4" />} label="Storefront" />
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">Customer-facing mini website</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Edit the page customers see: content, design, sections, portfolio, service area, and inquiry flow.
          </p>
        </Panel>
      </section>

      <section id="services" className="scroll-mt-24 space-y-4">
        <SectionHeader
          action={<Button asChild><Link href={`/vendor/business/${business.slug}/services/new`}><PackagePlus className="h-4 w-4" />Add Service</Link></Button>}
          icon={<PackagePlus className="h-4 w-4" />}
          label="Services"
          title="Services and offerings"
        />
        {business.offerings.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {business.offerings.map((offering) => (
              <article key={offering.id} className="overflow-hidden rounded-[1.25rem] border border-white/80 bg-white shadow-[0_18px_50px_rgba(72,44,43,0.08)]">
                <div className="relative aspect-[4/3] bg-[#f8ece9]">
                  {offering.photos[0] ? <img src={offering.photos[0]} alt={offering.title} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-sm text-muted-foreground">{offering.category.name}</div>}
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
                    <OfferingAction action={duplicateOfferingAction} id={offering.id} label="Duplicate" />
                    <OfferingAction action={toggleOfferingPublishedAction} id={offering.id} label={offering.active ? "Unpublish" : "Publish"} />
                    <Button type="button" size="sm" variant="secondary" className="w-full cursor-not-allowed opacity-60" title="Use the storefront editor to reorder public sections.">Reorder</Button>
                    <OfferingAction action={deleteOfferingAction} id={offering.id} label="Delete" />
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
            empty="New customer inquiries will appear here."
            items={business.inquiries.map((inquiry) => ({
              detail: inquiry.offering?.title ?? inquiry.eventLocation ?? "General inquiry",
              id: inquiry.id,
              status: inquiry.status,
              title: inquiry.name
            }))}
          />
        </Panel>
        <Panel>
          <SectionKicker icon={<MessageSquare className="h-4 w-4" />} label="Quote requests" />
          <RequestList
            empty="Quote requests connected to conversations will appear here."
            items={business.quoteRequests.map((request) => ({
              detail: request.offering?.title ?? request.eventLocation,
              id: request.id,
              status: request.quote ? `${request.status} · ${formatCurrency(request.quote.amountCents)}` : request.status,
              title: request.buyer.name ?? request.buyer.email ?? "Customer"
            }))}
          />
        </Panel>
      </section>

      <section id="bookings" className="scroll-mt-24">
        <Panel>
          <SectionKicker icon={<ShoppingBag className="h-4 w-4" />} label="Bookings" />
          <RequestList
            empty="Orders and payments will appear here after customers accept quotes."
            items={business.orders.map((order) => ({
              detail: order.buyer.name ?? order.buyer.email ?? "Customer",
              id: order.id,
              status: `${order.status} · ${formatCurrency(order.buyerTotalCents || order.amountCents)}`,
              title: order.offering?.title ?? "Custom booking"
            }))}
          />
        </Panel>
      </section>

      <section id="settings" className="scroll-mt-24">
        <Panel>
          <SectionKicker icon={<Settings className="h-4 w-4" />} label="Settings" />
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="rounded-[1rem] border border-[#eadbd8] bg-[#fbf7f5] p-4">
              <h3 className="font-semibold">Business details</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{formatLocation(business.city, business.state)} · {business.serviceRadiusMiles} mile service radius</p>
              <Button asChild variant="secondary" className="mt-4"><Link href={`/vendor/business/${business.slug}/storefront`}>Edit Storefront</Link></Button>
            </div>
            <div className="rounded-[1rem] border border-[#eadbd8] bg-[#fbf7f5] p-4">
              <h3 className="font-semibold">Payments</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">{paymentStatus(business)}</p>
              <div className="mt-4"><ConnectStripeButton businessSlug={business.slug} connected={business.stripeOnboardingComplete} /></div>
            </div>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return <Link href={href} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium hover:bg-[#fbf7f5]">{icon}{label}</Link>;
}

function OfferingAction({ action, id, label }: { action: (formData: FormData) => void | Promise<void>; id: string; label: string }) {
  return <form action={action}><input type="hidden" name="offeringId" value={id} /><Button type="submit" size="sm" variant="secondary" className="w-full">{label}</Button></form>;
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="rounded-[1.25rem] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(72,44,43,0.08)] sm:p-6">{children}</div>;
}

function SectionHeader({ action, icon, label, title }: { action?: React.ReactNode; icon: React.ReactNode; label: string; title: string }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><SectionKicker icon={icon} label={label} /><h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em]">{title}</h2></div>{action}</div>;
}

function SectionKicker({ icon, label }: { icon: React.ReactNode; label: string }) {
  return <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary">{icon}{label}</div>;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[1.25rem] border border-white/80 bg-white p-5 shadow-[0_18px_50px_rgba(72,44,43,0.08)]"><div className="text-2xl font-semibold tracking-tight">{value}</div><div className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{label}</div></div>;
}

function RequestList({ empty, items }: { empty: string; items: Array<{ detail: string; id: string; status: string; title: string }> }) {
  if (!items.length) return <p className="mt-4 text-sm leading-6 text-muted-foreground">{empty}</p>;
  return <div className="mt-4 space-y-3">{items.map((item) => <div key={item.id} className="rounded-[1rem] border border-[#eadbd8] bg-[#fbf7f5] p-4 text-sm"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold">{item.title}</div><div className="mt-1 text-muted-foreground">{item.detail}</div></div><span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold">{item.status}</span></div></div>)}</div>;
}

function EmptyState({ action, body, href, title }: { action: string; body: string; href: string; title: string }) {
  return <div className="rounded-[1.25rem] border border-white/80 bg-white p-8 text-center shadow-[0_18px_50px_rgba(72,44,43,0.08)]"><h3 className="text-xl font-semibold tracking-[-0.02em]">{title}</h3><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">{body}</p><Button asChild className="mt-5"><Link href={href}>{action}</Link></Button></div>;
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

function formatLocation(city: string, state?: string | null) {
  return state ? `${city}, ${state}` : city;
}

function formatOfferingPrice(offering: { basePriceCents: number | null; messageForPricing: boolean }) {
  if (offering.messageForPricing) return "Message for pricing";
  return offering.basePriceCents ? `From ${formatCurrency(offering.basePriceCents)}` : "Message for pricing";
}

function storefrontStatus(business: { bio: string | null; coverPhoto: string | null; logoUrl: string | null; offerings: unknown[]; photos: string[]; status: string }) {
  if (!business.bio || !business.offerings.length || (!business.coverPhoto && !business.logoUrl && !business.photos.length)) return "Incomplete";
  if (business.status === "UNCLAIMED") return "Draft";
  return "Published";
}

function paymentStatus(business: { stripeChargesEnabled: boolean; stripeOnboardingComplete: boolean; stripePayoutsEnabled: boolean }) {
  if (business.stripeChargesEnabled && business.stripePayoutsEnabled) return "Ready for payments and payouts.";
  if (business.stripeOnboardingComplete) return "Stripe onboarding is complete and awaiting final readiness.";
  return "Connect Stripe to accept payments from quotes.";
}
