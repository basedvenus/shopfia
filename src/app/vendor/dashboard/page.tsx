import Link from "next/link";
import { UserRole } from "@prisma/client";
import { updateOrderStatusAction } from "@/app/actions/orders";
import { updateSellerMarketplaceSettingsAction } from "@/app/actions/vendor";
import { respondToReviewAction } from "@/app/actions/reviews";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectStripeButton } from "@/components/vendor/connect-stripe-button";
import { Textarea } from "@/components/ui/textarea";
import { basisPointsToPercent, formatCurrency, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorDashboardPage() {
  const [{ requireRole }, { db }, { getMarketplaceFeeConfig }] = await Promise.all([
    import("@/lib/auth/guards"),
    import("@/lib/db"),
    import("@/lib/services/marketplace-fees")
  ]);
  const session = await requireRole([UserRole.VENDOR, UserRole.ADMIN]);
  const [vendor, feeConfig] = await Promise.all([
    db.vendorProfile.findUnique({
      where: { userId: session.user.id },
      include: {
        sellerRatingAggregate: true,
        rankingScore: true,
        offerings: { orderBy: { createdAt: "desc" } },
        shop: {
          include: {
            seller: true,
            listings: {
              include: { feeEvents: { orderBy: { createdAt: "desc" }, take: 3 } },
              orderBy: { createdAt: "desc" }
            }
          }
        },
        quoteRequests: {
          include: { quote: true, buyer: true },
          orderBy: { createdAt: "desc" },
          take: 10
        },
        orders: {
          include: {
            feeBreakdown: true,
            payout: true,
            review: {
              include: {
                response: true
              }
            }
          },
          orderBy: { createdAt: "desc" },
          take: 10
        }
      }
    }),
    getMarketplaceFeeConfig()
  ]);

  if (!vendor) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold">Vendor Dashboard</h1>
        <p className="text-sm text-muted-foreground">Create your vendor profile to access dashboard tools.</p>
        <Link href="/onboarding"><Button>Start onboarding</Button></Link>
      </div>
    );
  }

  const revenue = vendor.orders
    .filter((o) => ["paid", "in_progress", "completed"].includes(o.status))
    .reduce((sum, o) => sum + (o.feeBreakdown?.adjustedSellerNetPayoutCents ?? o.amountCents), 0);
  const pendingRequests = vendor.quoteRequests.filter((q) => ["SUBMITTED", "RESPONDED"].includes(q.status)).length;
  const upcomingBookings = vendor.orders.filter((o) => ["paid", "in_progress"].includes(o.status)).length;
  const seller = vendor.shop?.seller;

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{vendor.name} Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Stripe Connect: {vendor.stripeOnboardingComplete ? "Connected" : "Not connected"}
          </p>
        </div>
        <ConnectStripeButton connected={vendor.stripeOnboardingComplete} />
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Revenue</div><div className="text-2xl font-semibold">{formatCurrency(revenue)}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Total reviews</div><div className="text-2xl font-semibold">{vendor.sellerRatingAggregate?.totalReviews ?? vendor.reviewCount}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Average rating</div><div className="text-2xl font-semibold">{(vendor.sellerRatingAggregate?.weightedAverageRating ?? vendor.averageRating).toFixed(1)}</div></CardContent></Card>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Visibility score</div><div className="text-2xl font-semibold">{vendor.rankingScore?.score.toFixed(1) ?? "0.0"}</div><div className="text-xs text-muted-foreground">{vendor.rankingScore?.tierLabel ?? "New"}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Pending Requests</div><div className="text-2xl font-semibold">{pendingRequests}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Upcoming Bookings</div><div className="text-2xl font-semibold">{upcomingBookings}</div></CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Reviews = currency</CardTitle></CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>More completed orders through Fia lead to more verified reviews, which directly improves ranking and visibility.</p>
          <p>Complete orders to earn reviews. Reviews are only collected for bookings made through Fia.</p>
        </CardContent>
      </Card>

      <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <CardHeader><CardTitle>Fee summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <FeeRow label="Listing fee" value={formatCurrency(feeConfig.listingFeeFlatCents)} />
            <FeeRow label="Transaction fee" value={`${formatPercent(basisPointsToPercent(feeConfig.transactionFeeBasisPoints))}%`} />
            <FeeRow
              label="Payment processing fee"
              value={`${formatPercent(basisPointsToPercent(feeConfig.paymentProcessingBasisPoints))}% + ${formatCurrency(feeConfig.paymentProcessingFlatCents)}`}
            />
            <FeeRow
              label="Offsite Ads fee"
              value={
                feeConfig.offsiteAdsEnabled
                  ? seller?.offsiteAdsEnabled
                    ? `${seller.offsiteAdsTier === "HIGH_VOLUME" ? formatPercent(basisPointsToPercent(feeConfig.offsiteAdsHighVolumeBasisPoints)) : formatPercent(basisPointsToPercent(feeConfig.offsiteAdsStandardBasisPoints))}% when attributed`
                    : "Only when applicable"
                  : "Disabled"
              }
            />
            {seller ? (
              <form action={updateSellerMarketplaceSettingsAction} className="space-y-2 rounded-2xl border bg-muted/30 p-3">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="offsiteAdsEnabled" defaultChecked={seller.offsiteAdsEnabled} />
                  Enable Offsite Ads fee when attributed
                </label>
                <select
                  name="offsiteAdsTier"
                  defaultValue={seller.offsiteAdsTier}
                  className="h-9 rounded-xl border bg-white px-2 text-sm"
                >
                  <option value="STANDARD">Standard seller</option>
                  <option value="HIGH_VOLUME">High-volume seller</option>
                </select>
                <Button type="submit" size="sm" variant="secondary">Save seller fee settings</Button>
              </form>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Listing renewals</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {vendor.shop?.listings.length ? (
              vendor.shop.listings.map((listing) => (
                <div key={listing.id} className="rounded-2xl border p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium">{listing.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {listing.status} · Qty {listing.availableQuantity}/{listing.quantity} · Auto-renew {listing.autoRenew ? "On" : "Off"}
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Expires {listing.expiresAt ? new Date(listing.expiresAt).toLocaleDateString() : "Draft"}
                    </div>
                  </div>
                  {listing.feeEvents.length ? (
                    <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                      {listing.feeEvents.map((event) => (
                        <div key={event.id}>
                          {event.eventType} · {formatCurrency(event.amountCents)}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No listings published yet.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Manage Offerings</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <Link href="/onboarding"><Button size="sm">Add / edit offerings</Button></Link>
            {vendor.offerings.map((offering) => (
              <div key={offering.id} className="rounded-2xl border p-3 text-sm">
                <div className="font-medium">{offering.title}</div>
                <div className="text-muted-foreground">{offering.type} · {offering.active ? "Active" : "Inactive"}</div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Requests & Quotes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {vendor.quoteRequests.length === 0 ? (
              <p className="text-sm text-muted-foreground">No requests yet.</p>
            ) : (
              vendor.quoteRequests.map((qr) => (
                <div key={qr.id} className="rounded-2xl border p-3 text-sm">
                  <div className="font-medium">{qr.buyer.name ?? qr.buyer.email}</div>
                  <div className="text-muted-foreground">{qr.eventLocation}</div>
                  <div className="text-muted-foreground">Status: {qr.status}</div>
                  {qr.quote && <div className="mt-1">Quote: {formatCurrency(qr.quote.amountCents)}</div>}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Orders</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {vendor.orders.length === 0 ? (
            <p className="text-sm text-muted-foreground">No orders yet.</p>
          ) : (
            vendor.orders.map((order) => (
              <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3">
                <div className="min-w-[260px] space-y-2">
                  <div>
                    <div className="font-medium">{formatCurrency(order.buyerTotalCents || order.amountCents)}</div>
                    <div className="text-xs text-muted-foreground">{order.status}</div>
                    {order.status === "completed" && order.paymentSucceededAt ? (
                      <div className="text-xs text-primary">This order is now eligible for a review</div>
                    ) : null}
                  </div>
                  {order.feeBreakdown ? (
                    <div className="rounded-2xl bg-muted/40 p-3 text-xs">
                      <FeeRow label="Listing fee" value={formatCurrency(order.feeBreakdown.adjustedListingFeeCents)} />
                      <FeeRow label="Transaction fee" value={formatCurrency(order.feeBreakdown.adjustedTransactionFeeCents)} />
                      <FeeRow label="Payment processing fee" value={formatCurrency(order.feeBreakdown.adjustedPaymentProcessingFeeCents)} />
                      <FeeRow label="Offsite Ads fee" value={formatCurrency(order.feeBreakdown.adjustedOffsiteAdsFeeCents)} />
                      <FeeRow label="Net earnings" value={formatCurrency(order.feeBreakdown.adjustedSellerNetPayoutCents)} strong />
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">Fee details appear after payment succeeds.</div>
                  )}
                  {order.payout ? (
                    <div className="text-xs text-muted-foreground">
                      Payout: {order.payout.status.toLowerCase()} · {formatCurrency(order.payout.netAmountCents)}
                    </div>
                  ) : null}
                  {order.review ? (
                    <div className="rounded-2xl bg-white/70 p-3 text-xs">
                      <div className="font-medium">Verified Purchase · {order.review.rating}/5</div>
                      {order.review.body ? <div className="mt-1 text-muted-foreground">{order.review.body}</div> : null}
                      {order.review.response ? (
                        <div className="mt-2 rounded-xl bg-muted/40 p-2">
                          <div className="font-medium">Seller response</div>
                          <div className="text-muted-foreground">{order.review.response.body}</div>
                        </div>
                      ) : seller ? (
                        <form action={respondToReviewAction} className="mt-2 space-y-2">
                          <input type="hidden" name="reviewId" value={order.review.id} />
                          <Textarea name="body" placeholder="Reply to this review" className="min-h-[70px]" />
                          <Button type="submit" size="sm" variant="secondary">Respond</Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <form action={updateOrderStatusAction} className="flex items-center gap-2">
                  <input type="hidden" name="orderId" value={order.id} />
                  <select name="status" defaultValue={order.status} className="h-9 rounded-xl border bg-white px-2 text-sm">
                    {["paid", "in_progress", "completed", "canceled", "refunded"].map((status) => (
                      <option key={status} value={status}>{status}</option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" variant="secondary">Update</Button>
                </form>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FeeRow({
  label,
  value,
  strong = false
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? "font-semibold text-foreground" : "text-muted-foreground"}>{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
