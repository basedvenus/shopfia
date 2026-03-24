import { CategoryAudience, UserRole } from "@prisma/client";
import { requireRole } from "@/lib/auth/guards";
import { upsertVendorProfileAction, upsertOfferingAction } from "@/app/actions/vendor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FeePreviewCard } from "@/components/vendor/fee-preview-card";
import { db } from "@/lib/db";
import { getMarketplaceFeeConfig } from "@/lib/services/marketplace-fees";
import { basisPointsToPercent, formatCurrency, formatPercent } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorOnboardingPage() {
  const session = await requireRole([UserRole.BUYER, UserRole.VENDOR, UserRole.ADMIN]);
  const [categories, existingVendor, feeConfig] = await Promise.all([
    db.category.findMany({ where: { audience: CategoryAudience.VENDOR }, orderBy: { name: "asc" } }),
    db.vendorProfile.findUnique({
      where: { userId: session.user.id },
      include: { categories: true, offerings: { take: 1 } }
    }),
    getMarketplaceFeeConfig()
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Become a vendor</h1>
        <p className="text-sm text-muted-foreground">
          Free to join, free to open a shop, and no monthly subscription by default.
        </p>
      </div>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader><CardTitle>Seller fee model</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <div className="rounded-2xl bg-muted/70 p-4">
              <div className="font-medium text-foreground">Listing fee</div>
              <div>{formatCurrency(feeConfig.listingFeeFlatCents)} per published listing for {feeConfig.listingDurationDays} days.</div>
            </div>
            <div className="rounded-2xl bg-muted/70 p-4">
              <div className="font-medium text-foreground">Transaction fee</div>
              <div>{formatPercent(basisPointsToPercent(feeConfig.transactionFeeBasisPoints))}% on item subtotal, shipping, and gift wrap/add-ons.</div>
            </div>
            <div className="rounded-2xl bg-muted/70 p-4">
              <div className="font-medium text-foreground">Payment processing fee</div>
              <div>
                {formatPercent(basisPointsToPercent(feeConfig.paymentProcessingBasisPoints))}% + {formatCurrency(feeConfig.paymentProcessingFlatCents)} per paid order.
              </div>
            </div>
            <div className="rounded-2xl bg-muted/70 p-4">
              <div className="font-medium text-foreground">Offsite Ads fee</div>
              <div>
                {feeConfig.offsiteAdsEnabled
                  ? `Only when applicable: ${formatPercent(basisPointsToPercent(feeConfig.offsiteAdsStandardBasisPoints))}% standard or ${formatPercent(basisPointsToPercent(feeConfig.offsiteAdsHighVolumeBasisPoints))}% high-volume.`
                  : "Currently disabled by admin."}
              </div>
            </div>
          </CardContent>
        </Card>

        <FeePreviewCard
          listingFeeCents={feeConfig.listingFeeFlatCents}
          transactionFeePercent={basisPointsToPercent(feeConfig.transactionFeeBasisPoints)}
          paymentProcessingPercent={basisPointsToPercent(feeConfig.paymentProcessingBasisPoints)}
          paymentProcessingFlatCents={feeConfig.paymentProcessingFlatCents}
          offsiteAdsStandardPercent={basisPointsToPercent(feeConfig.offsiteAdsStandardBasisPoints)}
          offsiteAdsHighVolumePercent={basisPointsToPercent(feeConfig.offsiteAdsHighVolumeBasisPoints)}
          offsiteAdsEnabled={feeConfig.offsiteAdsEnabled}
        />
      </section>

      <Card>
        <CardHeader><CardTitle>1. Vendor Profile</CardTitle></CardHeader>
        <CardContent>
          <form action={upsertVendorProfileAction} className="grid gap-3 md:grid-cols-2">
            <Input name="name" placeholder="Business name" defaultValue={existingVendor?.name} required />
            <Input name="slug" placeholder="public-slug" defaultValue={existingVendor?.slug} required />
            <Input name="city" placeholder="City" defaultValue={existingVendor?.city} required />
            <Input name="state" placeholder="State" defaultValue={existingVendor?.state ?? ""} />
            <Input name="zipCode" placeholder="Zip code" defaultValue={existingVendor?.zipCode ?? ""} />
            <Input
              name="serviceRadiusMiles"
              type="number"
              min={1}
              defaultValue={existingVendor?.serviceRadiusMiles ?? 15}
              required
            />
            <label className="flex items-center gap-2 rounded-2xl border bg-white px-3 py-2 text-sm">
              <input
                type="checkbox"
                name="weekendAvailable"
                defaultChecked={existingVendor?.weekendAvailable ?? true}
              />
              Available this weekend
            </label>
            <div className="md:col-span-2">
              <Textarea name="bio" placeholder="Business bio" defaultValue={existingVendor?.bio ?? ""} className="min-h-[100px]" />
            </div>
            <div className="md:col-span-2">
              <Textarea name="serviceAreaNotes" placeholder="Pickup/delivery/service-area notes" defaultValue={existingVendor?.serviceAreaNotes ?? ""} className="min-h-[80px]" />
            </div>
            <div className="md:col-span-2">
              <Textarea name="availabilityNotes" placeholder="Availability notes" defaultValue={existingVendor?.availabilityNotes ?? ""} className="min-h-[80px]" />
            </div>
            <div className="md:col-span-2 rounded-2xl border p-3">
              <label className="mb-2 block text-sm font-medium">Categories</label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {categories.map((category) => {
                  const checked = existingVendor?.categories.some((c) => c.categoryId === category.id);
                  return (
                    <label key={category.id} className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
                      <input type="checkbox" name="categoryIds" value={category.id} defaultChecked={checked} />
                      {category.name}
                    </label>
                  );
                })}
              </div>
            </div>
            <div className="md:col-span-2 rounded-2xl border p-3">
              <label className="mb-2 block text-sm font-medium">Photo URLs (paste one per field)</label>
              <div className="grid gap-2">
                {[0, 1, 2].map((i) => (
                  <Input key={i} name="photoUrls" placeholder={`https://... photo ${i + 1}`} defaultValue={existingVendor?.photos[i] ?? ""} />
                ))}
              </div>
            </div>
            <div className="md:col-span-2">
              <Button type="submit">Save vendor profile</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. Add First Offering</CardTitle></CardHeader>
        <CardContent>
          <form action={upsertOfferingAction} className="grid gap-3 md:grid-cols-2">
            <select name="type" className="h-10 rounded-2xl border bg-white px-3">
              <option value="SERVICE">Service</option>
              <option value="PRODUCT">Product</option>
            </select>
            <Input name="title" placeholder="Offering title" required />
            <Input name="slug" placeholder="offering-slug" required />
            <select name="categoryId" className="h-10 rounded-2xl border bg-white px-3" required>
              <option value="">Select category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <Input name="basePriceCents" type="number" min={0} placeholder="Base price (cents)" />
            <Input name="durationMinutes" type="number" min={15} placeholder="Duration minutes (service)" />
            <Input name="turnaroundDays" type="number" min={0} placeholder="Turnaround days" />
            <Input name="inventoryCount" type="number" min={0} placeholder="Inventory count (product)" />
            <div className="md:col-span-2">
              <Textarea name="description" placeholder="Describe the service/product..." className="min-h-[120px]" required />
            </div>
            <div className="md:col-span-2 rounded-2xl border p-3">
              <label className="mb-2 block text-sm font-medium">Tags</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {[0, 1, 2, 3].map((i) => (
                  <Input key={i} name="tags" placeholder={`Tag ${i + 1}`} />
                ))}
              </div>
            </div>
            <div className="md:col-span-2 rounded-2xl border p-3">
              <label className="mb-2 block text-sm font-medium">Photo URLs</label>
              <div className="grid gap-2 sm:grid-cols-2">
                {[0, 1].map((i) => (
                  <Input key={i} name="photos" placeholder={`https://... photo ${i + 1}`} />
                ))}
              </div>
            </div>
            <label className="md:col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="allowInstantBook" />
              Enable instant booking (for simple offerings)
            </label>
            <label className="md:col-span-2 flex items-center gap-2 text-sm">
              <input type="checkbox" name="autoRenewListing" />
              Auto-renew listing inventory and charge another {formatCurrency(feeConfig.listingFeeFlatCents)} when renewal applies
            </label>
            <div className="md:col-span-2">
              <Button type="submit">Save offering</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
