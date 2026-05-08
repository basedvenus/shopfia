import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarHeart, Heart, Instagram, MessageCircle, Music2, PackageCheck, PenLine, Settings, Sparkles, Store, UserRound } from "lucide-react";
import { addPartyPhotoAction, updateAccountProfileAction } from "@/app/actions/auth";
import { acceptQuoteAndCreatePaymentIntentAction } from "@/app/actions/quotes";
import { createReviewAction } from "@/app/actions/reviews";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SignInPanel } from "@/components/account/sign-in-panel";
import { authProviderConfig } from "@/lib/auth/provider-config";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const [{ auth }, { db }] = await Promise.all([import("@/auth"), import("@/lib/db")]);
  const session = await auth();

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
              emailEnabled={authProviderConfig.emailEnabled}
              googleEnabled={authProviderConfig.googleEnabled}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  const [accountUser, orders, quoteRequests, favoriteCount, conversationCount] = await Promise.all([
    db.user.findUnique({
      where: { id: session.user.id },
      select: {
        name: true,
        email: true,
        image: true,
        username: true,
        bio: true,
        instagramUrl: true,
        tiktokUrl: true,
        partyfulUrl: true,
        partyPhotoUrls: true
      }
    }),
    db.order.findMany({
      where: { buyerId: session.user.id },
      include: {
        vendorProfile: true,
        review: true
      },
      orderBy: { createdAt: "desc" }
    }),
    db.quoteRequest.findMany({
      where: { buyerId: session.user.id },
      include: {
        vendor: true,
        quote: true
      },
      orderBy: { createdAt: "desc" }
    }),
    db.favorite.count({ where: { buyerId: session.user.id } }),
    db.conversation.count({
      where: {
        OR: [{ buyerId: session.user.id }, { vendorId: session.user.id }]
      }
    })
  ]);

  const displayName = accountUser?.name || session.user.name || "ShopFia Member";
  const handle = accountUser?.username ? `@${accountUser.username}` : "@choose-your-handle";
  const avatarStyle = accountUser?.image
    ? {
        backgroundImage: `url(${accountUser.image})`,
        backgroundPosition: "center",
        backgroundSize: "cover"
      }
    : undefined;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
  const partyPhotos =
    accountUser?.partyPhotoUrls && accountUser.partyPhotoUrls.length > 0
      ? accountUser.partyPhotoUrls
      : [
          "/demo/fairfield-lemon-tablescape.png",
          "/demo/vacaville-cookie-tulips.png",
          "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=900&q=80",
          "https://images.unsplash.com/photo-1464366400600-7168b8af9bc3?auto=format&fit=crop&w=900&q=80"
        ];
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
      detail: "Profiles, listings, and payouts"
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
    }
  ];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-[2rem] border border-white/70 bg-white/90 shadow-soft">
        <div className="bg-[linear-gradient(135deg,rgba(234,184,179,0.34),rgba(255,255,255,0.8),rgba(253,230,208,0.45))] p-5 md:p-7">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex flex-wrap items-center gap-4">
              <div
                className="grid h-24 w-24 place-items-center rounded-full border-4 border-white bg-accent text-2xl font-semibold shadow-soft"
                style={avatarStyle}
              >
                {accountUser?.image ? <span className="sr-only">{displayName}</span> : initials}
              </div>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-muted-foreground">Creator profile</p>
                  <h1 className="text-3xl font-semibold tracking-tight">{displayName}</h1>
                  <p className="text-sm font-medium text-muted-foreground">{handle}</p>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {accountUser?.bio ||
                    "Add a short bio so vendors and party guests can understand your style, event aesthetic, and what you love creating."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {accountUser?.instagramUrl ? (
                    <Link href={accountUser.instagramUrl} className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs" target="_blank">
                      <Instagram className="h-3.5 w-3.5" />
                      Instagram
                    </Link>
                  ) : null}
                  {accountUser?.tiktokUrl ? (
                    <Link href={accountUser.tiktokUrl} className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs" target="_blank">
                      <Music2 className="h-3.5 w-3.5" />
                      TikTok
                    </Link>
                  ) : null}
                  {accountUser?.partyfulUrl ? (
                    <Link href={accountUser.partyfulUrl} className="inline-flex items-center gap-2 rounded-full border bg-white px-3 py-1.5 text-xs" target="_blank">
                      <Sparkles className="h-3.5 w-3.5" />
                      Partyful
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
            <form
              action={async () => {
                "use server";
                const { signOut } = await import("@/auth");
                await signOut({ redirectTo: "/explore" });
              }}
            >
              <Button variant="secondary">Sign out</Button>
            </form>
          </div>
        </div>

        <div id="settings" className="grid gap-4 border-t border-border/60 p-5 md:grid-cols-[1.2fr_0.8fr]">
          <form
            action={async (formData) => {
              "use server";
              await updateAccountProfileAction(formData);
            }}
            className="grid gap-3"
          >
            <div className="flex items-center gap-2 font-semibold">
              <UserRound className="h-4 w-4 text-primary" />
              Edit profile
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input name="name" defaultValue={accountUser?.name ?? ""} placeholder="Display name" />
              <Input name="username" defaultValue={accountUser?.username ?? ""} placeholder="username" />
            </div>
            <Textarea name="bio" defaultValue={accountUser?.bio ?? ""} placeholder="About your party style, favorite themes, or what you are planning..." className="min-h-[90px]" />
            <Input name="image" defaultValue={accountUser?.image ?? ""} placeholder="Avatar image URL" />
            <div className="grid gap-3 sm:grid-cols-3">
              <Input name="instagramUrl" defaultValue={accountUser?.instagramUrl ?? ""} placeholder="Instagram URL" />
              <Input name="tiktokUrl" defaultValue={accountUser?.tiktokUrl ?? ""} placeholder="TikTok URL" />
              <Input name="partyfulUrl" defaultValue={accountUser?.partyfulUrl ?? ""} placeholder="Partyful URL" />
            </div>
            <Button type="submit" className="w-full sm:w-fit">Save profile</Button>
          </form>

          <div className="grid gap-3 rounded-[1.5rem] bg-muted/60 p-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2 font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" />
              Profile goals
            </div>
            <p>Make your account feel social, trusted, and creator-led. Use a clear handle, a warm bio, and visual links that show your event style.</p>
            <p className="text-xs">Full file uploads can connect to Cloudinary later; this MVP stores image URLs so the visual profile and moodboard flow works now.</p>
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-5">
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

      <section id="my-parties" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">My Parties</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              A visual gallery for celebrations, inspiration, and vendor-credit moments.
            </p>
          </div>
          <form
            action={async (formData) => {
              "use server";
              await addPartyPhotoAction(formData);
            }}
            className="flex w-full gap-2 sm:w-auto"
          >
            <Input name="imageUrl" placeholder="Paste image URL" className="min-w-0 sm:w-72" />
            <Button type="submit">Add photo</Button>
          </form>
        </div>

        <div className="grid auto-rows-[180px] grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
          {partyPhotos.map((photo, index) => (
            <div
              key={`${photo}-${index}`}
              className={`relative overflow-hidden rounded-[1.4rem] border border-white/80 bg-muted shadow-sm ${
                index === 0 ? "col-span-2 row-span-2" : ""
              }`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url(${photo})` }}
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/45 to-transparent p-3 text-xs text-white">
                {index === 0 ? "Featured party moodboard" : "Saved inspiration"}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
