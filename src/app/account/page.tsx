import Link from "next/link";
import { redirect } from "next/navigation";
import { acceptQuoteAndCreatePaymentIntentAction } from "@/app/actions/quotes";
import { createReviewAction } from "@/app/actions/reviews";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SignInPanel } from "@/components/account/sign-in-panel";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const [{ auth }, { db }] = await Promise.all([import("@/auth"), import("@/lib/db")]);
  const session = await auth();
  const authSecret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  const googleEnabled = Boolean(
    authSecret &&
      (process.env.AUTH_GOOGLE_ID ?? process.env.GOOGLE_CLIENT_ID) &&
      (process.env.AUTH_GOOGLE_SECRET ?? process.env.GOOGLE_CLIENT_SECRET)
  );
  const emailEnabled = Boolean(
    process.env.EMAIL_SERVER_HOST &&
      process.env.EMAIL_SERVER_PORT &&
      process.env.EMAIL_SERVER_USER &&
      process.env.EMAIL_SERVER_PASSWORD &&
      process.env.EMAIL_FROM
  );

  if (!session?.user?.id) {
    return (
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader><CardTitle>Sign in to ShopFia</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Sign in to favorite vendors, message, request quotes, and book.
            </p>
            <SignInPanel googleEnabled={googleEnabled} emailEnabled={emailEnabled} />
          </CardContent>
        </Card>
      </div>
    );
  }

  const [orders, quoteRequests] = await Promise.all([
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
    })
  ]);

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Account</h1>
          <p className="text-sm text-muted-foreground">{session.user.email}</p>
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
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
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

        <Card>
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
    </div>
  );
}
