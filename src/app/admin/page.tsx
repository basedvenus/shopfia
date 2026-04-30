import { UserRole } from "@prisma/client";
import {
  removeOfferingAction,
  setVendorModerationAction,
  updateMarketplaceFeeConfigAction
} from "@/app/actions/admin";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { basisPointsToPercent, centsToDollars } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const [{ requireRole }, { db }, { getMarketplaceFeeConfig }] = await Promise.all([
    import("@/lib/auth/guards"),
    import("@/lib/db"),
    import("@/lib/services/marketplace-fees")
  ]);
  await requireRole([UserRole.ADMIN]);
  const [users, vendors, listings, categories, inquiries, reports, feeConfig] = await Promise.all([
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.vendorProfile.findMany({ include: { user: true }, orderBy: { createdAt: "desc" }, take: 20 }),
    db.listing.findMany({
      include: {
        shop: {
          include: {
            vendorProfile: true
          }
        },
        offering: true
      },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    db.category.findMany({ orderBy: { name: "asc" } }),
    db.inquiry.findMany({
      include: {
        vendorProfile: true,
        listing: true,
        offering: true
      },
      orderBy: { createdAt: "desc" },
      take: 20
    }),
    db.report.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    getMarketplaceFeeConfig()
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin</h1>

      <section className="grid gap-4 md:grid-cols-5">
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Users</div><div className="text-2xl font-semibold">{users.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Vendors</div><div className="text-2xl font-semibold">{vendors.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Listings</div><div className="text-2xl font-semibold">{listings.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Inquiries</div><div className="text-2xl font-semibold">{inquiries.length}</div></CardContent></Card>
        <Card><CardContent className="p-4"><div className="text-sm text-muted-foreground">Categories</div><div className="text-2xl font-semibold">{categories.length}</div></CardContent></Card>
      </section>

      <Card>
        <CardHeader><CardTitle>Marketplace fee settings</CardTitle></CardHeader>
        <CardContent>
          <form action={updateMarketplaceFeeConfigAction} className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Input
              name="listingFeeFlat"
              type="number"
              min={0}
              step="0.01"
              defaultValue={centsToDollars(feeConfig.listingFeeFlatCents)}
              placeholder="Listing fee"
            />
            <Input
              name="listingDurationDays"
              type="number"
              min={1}
              defaultValue={feeConfig.listingDurationDays}
              placeholder="Listing duration days"
            />
            <Input
              name="transactionFeePercent"
              type="number"
              min={0}
              step="0.1"
              defaultValue={basisPointsToPercent(feeConfig.transactionFeeBasisPoints)}
              placeholder="Transaction fee %"
            />
            <Input
              name="paymentProcessingPercent"
              type="number"
              min={0}
              step="0.1"
              defaultValue={basisPointsToPercent(feeConfig.paymentProcessingBasisPoints)}
              placeholder="Payment processing fee %"
            />
            <Input
              name="paymentProcessingFlat"
              type="number"
              min={0}
              step="0.01"
              defaultValue={centsToDollars(feeConfig.paymentProcessingFlatCents)}
              placeholder="Payment processing flat"
            />
            <Input
              name="offsiteAdsStandardPercent"
              type="number"
              min={0}
              step="0.1"
              defaultValue={basisPointsToPercent(feeConfig.offsiteAdsStandardBasisPoints)}
              placeholder="Offsite ads standard %"
            />
            <Input
              name="offsiteAdsHighVolumePercent"
              type="number"
              min={0}
              step="0.1"
              defaultValue={basisPointsToPercent(feeConfig.offsiteAdsHighVolumeBasisPoints)}
              placeholder="Offsite ads high-volume %"
            />
            <div className="flex flex-col justify-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="offsiteAdsEnabled" defaultChecked={feeConfig.offsiteAdsEnabled} />
                Offsite ads enabled
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="transactionFeeRefundable"
                  defaultChecked={feeConfig.transactionFeeRefundable}
                />
                Transaction fee refundable
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  name="paymentProcessingFeeRefundable"
                  defaultChecked={feeConfig.paymentProcessingFeeRefundable}
                />
                Payment processing fee refundable
              </label>
            </div>
            <div className="md:col-span-2 xl:col-span-4">
              <Button type="submit">Save fee settings</Button>
            </div>
            <Input
              name="rankingReviewCountWeight"
              type="number"
              min={0}
              step="0.1"
              defaultValue={feeConfig.rankingReviewCountWeight}
              placeholder="Review count weight"
            />
            <Input
              name="rankingAverageRatingWeight"
              type="number"
              min={0}
              step="0.1"
              defaultValue={feeConfig.rankingAverageRatingWeight}
              placeholder="Average rating weight"
            />
            <Input
              name="rankingRecentReviewsWeight"
              type="number"
              min={0}
              step="0.1"
              defaultValue={feeConfig.rankingRecentReviewsWeight}
              placeholder="Recent reviews weight"
            />
            <Input
              name="rankingCompletionRateWeight"
              type="number"
              min={0}
              step="0.1"
              defaultValue={feeConfig.rankingCompletionRateWeight}
              placeholder="Completion rate weight"
            />
            <Input
              name="rankingResponseRateWeight"
              type="number"
              min={0}
              step="0.1"
              defaultValue={feeConfig.rankingResponseRateWeight}
              placeholder="Response rate weight"
            />
            <Input
              name="rankingOnTimeDeliveryWeight"
              type="number"
              min={0}
              step="0.1"
              defaultValue={feeConfig.rankingOnTimeDeliveryWeight}
              placeholder="On-time delivery weight"
            />
            <Input
              name="rankingRecencyWindowDays"
              type="number"
              min={1}
              defaultValue={feeConfig.rankingRecencyWindowDays}
              placeholder="Recency window days"
            />
            <Input
              name="rankingMinimumReviewsForBoost"
              type="number"
              min={0}
              defaultValue={feeConfig.rankingMinimumReviewsForBoost}
              placeholder="Minimum reviews for boost"
            />
            <Input
              name="fraudReviewVelocityThreshold"
              type="number"
              min={1}
              defaultValue={feeConfig.fraudReviewVelocityThreshold}
              placeholder="Fraud velocity threshold"
            />
            <Input
              name="fraudLowRatingSpikeThreshold"
              type="number"
              min={1}
              defaultValue={feeConfig.fraudLowRatingSpikeThreshold}
              placeholder="Low-rating spike threshold"
            />
            <div className="md:col-span-2 xl:col-span-4 rounded-2xl bg-muted/40 p-3 text-sm text-muted-foreground">
              Reviews drive ranking: more verified reviews, stronger ratings, more recent activity, and better completion rates improve visibility.
            </div>
            <div className="md:col-span-2 xl:col-span-4">
              <Button type="submit">Save ranking settings</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Vendors</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {vendors.map((vendor) => (
            <div key={vendor.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3">
              <div>
                <div className="font-medium">{vendor.name}</div>
                <div className="text-xs text-muted-foreground">
                  {vendor.user.email} · {vendor.verified ? "Approved" : "Pending/Suspended"}
                </div>
              </div>
              <div className="flex gap-2">
                <form action={setVendorModerationAction}>
                  <input type="hidden" name="vendorId" value={vendor.id} />
                  <input type="hidden" name="mode" value="approve" />
                  <Button size="sm" variant="secondary">Approve</Button>
                </form>
                <form action={setVendorModerationAction}>
                  <input type="hidden" name="vendorId" value={vendor.id} />
                  <input type="hidden" name="mode" value="suspend" />
                  <Button size="sm" variant="ghost">Suspend</Button>
                </form>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Listings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {listings.map((listing) => (
            <div key={listing.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3">
              <div>
                <div className="font-medium">{listing.title}</div>
                <div className="text-xs text-muted-foreground">
                  {listing.shop?.vendorProfile?.name ?? "Unknown vendor"} · {listing.category} · {listing.status}
                </div>
              </div>
              {listing.offeringId ? (
                <form action={removeOfferingAction}>
                  <input type="hidden" name="offeringId" value={listing.offeringId} />
                  <Button size="sm" variant="ghost">Remove listing</Button>
                </form>
              ) : null}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Inquiries</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {inquiries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No inquiries yet.</p>
          ) : (
            inquiries.map((inquiry) => (
              <div key={inquiry.id} className="rounded-2xl border p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-medium">{inquiry.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {inquiry.status} · {new Date(inquiry.createdAt).toLocaleString()}
                  </div>
                </div>
                <div className="mt-1 text-muted-foreground">{inquiry.email}{inquiry.phone ? ` · ${inquiry.phone}` : ""}</div>
                <div className="mt-1 text-muted-foreground">
                  Vendor: {inquiry.vendorProfile.name}
                  {inquiry.listing ? ` · Listing: ${inquiry.listing.title}` : ""}
                </div>
                <div className="mt-1 text-muted-foreground">Location: {inquiry.eventLocation}</div>
                {inquiry.message ? <div className="mt-2">{inquiry.message}</div> : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Reports</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {reports.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports.</p>
          ) : (
            reports.map((r) => (
              <div key={r.id} className="rounded-2xl border p-3 text-sm">
                <div className="font-medium">{r.targetType} · {r.status}</div>
                <div className="text-muted-foreground">{r.reason}</div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
