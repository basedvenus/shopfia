import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarHeart, Heart, MessageCircle, PackageCheck, PenLine, Store } from "lucide-react";
import { acceptQuoteAndCreatePaymentIntentAction } from "@/app/actions/quotes";
import { createReviewAction } from "@/app/actions/reviews";
import { AccountProfileEditor } from "@/components/account/account-profile-editor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SignInPanel } from "@/components/account/sign-in-panel";
import { authProviderConfig } from "@/lib/auth/provider-config";
import { isUnsafeProfileImage } from "@/lib/profile-image";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AccountPage({
  searchParams
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ auth }, { db }] = await Promise.all([import("@/auth"), import("@/lib/db")]);
  const resolvedSearchParams: Record<string, string | string[] | undefined> = searchParams
    ? await searchParams
    : {};
  const callbackUrl = getSafeCallbackUrl(resolvedSearchParams.redirectTo ?? resolvedSearchParams.callbackUrl);
  const session = await auth().catch((error) => {
    console.error("ShopFia auth session failed on account page", error);
    return null;
  });

  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader><CardTitle>Sign in to ShopFia</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Sign in to favorite vendors, message, request quotes, and book.
            </p>
            <SignInPanel
              callbackUrl={callbackUrl}
              emailEnabled={authProviderConfig.emailEnabled}
              googleEnabled={authProviderConfig.googleEnabled}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const userId = session.user.id;
  let accountData: Awaited<ReturnType<typeof loadAccountData>>;

  async function loadAccountData() {
    return Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          image: true,
          username: true,
          bio: true,
          instagramUrl: true,
          tiktokUrl: true
        }
      }),
      db.order.findMany({
        where: { buyerId: userId },
        include: {
          vendorProfile: true,
          review: true
        },
        orderBy: { createdAt: "desc" }
      }),
      db.quoteRequest.findMany({
        where: { buyerId: userId },
        include: {
          vendor: true,
          quote: true
        },
        orderBy: { createdAt: "desc" }
      }),
      db.favorite.count({ where: { buyerId: userId } }),
      db.conversation.count({
        where: {
          OR: [{ buyerId: userId }, { vendorId: userId }]
        }
      })
    ]);
  }

  try {
    accountData = await loadAccountData();
  } catch (error) {
    console.error("ShopFia account dashboard failed", error);
    return (
      <div className="mx-auto max-w-xl">
        <Card className="border-[#ead6cf] bg-white/92 shadow-soft">
          <CardHeader>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6b65]">
              Database needs attention
            </p>
            <CardTitle>Your account data cannot load right now.</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-6 text-muted-foreground">
              ShopFia is online, but the database provider is currently refusing reads because
              the project exceeded its data transfer quota. That is why Explore is empty and
              your signed-in account dashboard cannot load your vendor/profile data yet.
            </p>
            <div className="rounded-2xl border border-[#ead6cf] bg-[#fff8f5] p-4 text-sm leading-6 text-muted-foreground">
              Fix the Neon database quota or wait for the quota reset. Once Neon allows reads
              again, your vendors, listings, account, and messages should come back without
              recreating them.
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild>
                <Link href="/">Return home</Link>
              </Button>
              <Button asChild variant="secondary">
                <Link href="/explore">Check Explore</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const [accountUser, orders, quoteRequests, favoriteCount, conversationCount] = accountData;

  if (!accountUser?.username || !accountUser.name) {
    redirect("/account/setup");
  }

  if (isUnsafeProfileImage(accountUser?.image)) {
    await db.user.update({
      where: { id: session.user.id },
      data: { image: null }
    });
    accountUser!.image = null;
  }

  const displayName = accountUser?.name || session.user.name || "ShopFia Member";
  const handle = accountUser?.username ? `@${accountUser.username}` : "@choose-your-handle";
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const dashboardItems = [
    {
      label: "Quotes",
      value: quoteRequests.length,
      href: "#quotes",
      icon: PenLine,
      detail: "Requests and vendor responses"
    },
    {
      label: "Orders",
      value: orders.length,
      href: "#orders",
      icon: PackageCheck,
      detail: "Bookings and review prompts"
    },
    {
      label: "Vendor Tools",
      value: "Studio",
      href: "/vendor/dashboard",
      icon: Store,
      detail: "Business profile, services, and payouts"
    },
    {
      label: "Favorites",
      value: favoriteCount,
      href: "/favorites",
      icon: Heart,
      detail: "Saved Solano vendors"
    },
    {
      label: "Messages",
      value: conversationCount,
      href: "/messages",
      icon: MessageCircle,
      detail: "Conversations and quotes"
    },
    {
      label: "My Parties",
      value: "Gallery",
      href: "/my-parties",
      icon: CalendarHeart,
      detail: "Events, moodboards, and inspiration"
    }
  ];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-soft">
        <AccountProfileEditor
          displayName={displayName}
          handle={handle}
          initials={initials}
          signOutAction={async () => {
            "use server";
            const { signOut } = await import("@/auth");
            await signOut({ redirectTo: "/explore" });
          }}
        />
      </section>

      <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
        {dashboardItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link key={item.label} href={item.href} className="rounded-[1.5rem] border border-white/70 bg-white/90 p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-soft">
              <Icon className="h-5 w-5 text-primary" />
              <div className="mt-4 text-2xl font-semibold">{item.value}</div>
              <div className="mt-1 font-medium">{item.label}</div>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
            </Link>
          );
        })}
      </section>

      <section id="quotes" className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Your Quote Requests</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {quoteRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No quote requests yet.</p>
            ) : (
              quoteRequests.map((qr) => (
                <div key={qr.id} className="rounded-2xl border p-3 text-sm">
                  <div className="font-medium">{qr.vendor.name}</div>
                  <div className="text-muted-foreground">{qr.eventLocation}</div>
                  <div className="text-muted-foreground">Status: {qr.status}</div>
                  {qr.quote && (
                    <div className="mt-2 space-y-2">
                      <div className="text-foreground">
                        Quote: {formatCurrency(qr.quote.amountCents)} (expires {new Date(qr.quote.expiresAt).toLocaleDateString()})
                      </div>
                      {qr.quote.status === "SENT" && (
                        <form
                          action={async (formData) => {
                            "use server";
                            const result = await acceptQuoteAndCreatePaymentIntentAction(formData);
                            redirect(`/account?orderId=${result.orderId}&paymentIntent=created`);
                          }}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input type="hidden" name="quoteId" value={qr.quote.id} />
                          <select name="payMode" className="h-9 rounded-xl border bg-white px-2 text-sm">
                            <option value="deposit">Pay deposit</option>
                            <option value="full">Pay full</option>
                          </select>
                          <Button type="submit" size="sm">Accept & create payment</Button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card id="orders">
          <CardHeader><CardTitle>Your Orders</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="space-y-2 rounded-2xl border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{order.vendorProfile.name}</div>
                      <div className="text-xs text-muted-foreground">{order.status}</div>
                    </div>
                    <div className="text-sm font-medium">{formatCurrency(order.amountCents)}</div>
                  </div>
                  {order.status === "completed" && order.paymentSucceededAt ? (
                    <form action={createReviewAction} className="grid gap-2 rounded-xl bg-muted/40 p-3">
                      <input type="hidden" name="orderId" value={order.id} />
                      <div className="text-sm font-medium">Leave a review</div>
                      <div className="text-xs text-muted-foreground">
                        Reviews are only collected for bookings made through Fia.
                      </div>
                      <Input name="rating" type="number" min={1} max={5} placeholder="Rating (1-5)" required />
                      <Textarea name="body" placeholder="Leave a review" className="min-h-[80px]" />
                      <Button type="submit" size="sm">{order.review ? "Update review" : "Submit review"}</Button>
                    </form>
                  ) : null}
                  {order.status === "completed" && !order.paymentSucceededAt ? (
                    <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
                      Reviews unlock only after payment is successfully processed through Fia.
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="rounded-3xl border bg-white/70 p-4">
        <h2 className="font-semibold">Vendor tools</h2>
        <p className="text-sm text-muted-foreground">Create a vendor profile to sell services or goods.</p>
        <div className="mt-3 flex gap-2">
          <Link href="/onboarding"><Button>Become a vendor</Button></Link>
          <Link href="/vendor/dashboard"><Button variant="secondary">Vendor dashboard</Button></Link>
        </div>
      </section>

      <section className="rounded-[2rem] border border-white/70 bg-white/90 p-5 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">My Parties</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Parties, tagged vendors, and visual inspiration now live on their own dedicated page.
            </p>
          </div>
          <Link href="/my-parties">
            <Button>Open My Parties</Button>
          </Link>
        </div>
      </section>
    </div>
  );
}

function getSafeCallbackUrl(value: string | string[] | undefined) {
  const rawValue = Array.isArray(value) ? value[0] : value;
  if (!rawValue) return "/explore";

  try {
    const decoded = decodeURIComponent(rawValue);
    if (!decoded.startsWith("/") || decoded.startsWith("//")) return "/explore";
    if (decoded.startsWith("/api/")) return "/explore";
    return decoded;
  } catch {
    return "/explore";
  }
}
