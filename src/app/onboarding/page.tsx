import { CategoryAudience, UserRole } from "@prisma/client";
import { upsertVendorProfileAction, upsertOfferingAction } from "@/app/actions/vendor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { ServiceAreaPicker } from "@/components/vendor/service-area-picker";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VendorOnboardingPage() {
  const [{ requireRole }, { db }, { getMarketplaceFeeConfig }] = await Promise.all([
    import("@/lib/auth/guards"),
    import("@/lib/db"),
    import("@/lib/services/marketplace-fees")
  ]);
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

      <Card id="profile">
        <CardHeader><CardTitle>1. Vendor Profile</CardTitle></CardHeader>
        <CardContent>
          <form action={upsertVendorProfileAction} className="grid gap-3 md:grid-cols-2">
            <Input name="name" placeholder="Business name" defaultValue={existingVendor?.name} required />
            <Input name="slug" placeholder="public-profile-slug" defaultValue={existingVendor?.slug} required />
            <Input name="username" placeholder="Vendor username, e.g. blushbatch" defaultValue={existingVendor?.username ?? ""} />
            <Input name="website" placeholder="Website or social link" defaultValue={existingVendor?.website ?? ""} />
            <Input name="city" placeholder="City" defaultValue={existingVendor?.city} required />
            <Input name="state" placeholder="State" defaultValue={existingVendor?.state ?? ""} />
            <Input name="zipCode" placeholder="Zip code" defaultValue={existingVendor?.zipCode ?? ""} />
            <Input
              name="serviceRadiusMiles"
              type="number"
              min={1}
              max={200}
              placeholder="Travel radius in miles"
              defaultValue={existingVendor?.serviceRadiusMiles ?? 25}
            />
            <div className="md:col-span-2">
              <Textarea
                name="bio"
                placeholder="Describe your business style, specialties, and the kinds of celebrations you create..."
                defaultValue={existingVendor?.bio ?? ""}
                className="min-h-[100px]"
              />
            </div>
            <div className="md:col-span-2">
              <ServiceAreaPicker defaultValue={existingVendor?.serviceAreaNotes} />
            </div>
            <div className="md:col-span-2">
              <Textarea
                name="availabilityNotes"
                placeholder="Booking availability, contact preferences, travel notes, or lead time..."
                defaultValue={existingVendor?.availabilityNotes ?? ""}
                className="min-h-[90px]"
              />
            </div>
            <label className="md:col-span-2 flex items-center gap-2 rounded-2xl border bg-white px-3 py-3 text-sm">
              <input
                type="checkbox"
                name="weekendAvailable"
                defaultChecked={existingVendor?.weekendAvailable ?? true}
              />
              Available for weekend parties
            </label>
            <div>
              <ImageUploadField
                name="logoUrl"
                label="Vendor logo"
                defaultValue={existingVendor?.logoUrl}
                rounded="full"
                helperText="Click to upload a business logo or vendor image."
              />
            </div>
            <div>
              <ImageUploadField
                name="photoUrls"
                label="Cover/banner image"
                defaultValue={existingVendor?.coverPhoto ?? existingVendor?.photos[0]}
                helperText="This becomes the hero image on your public profile and dashboard."
              />
            </div>
            <div className="md:col-span-2">
              <ImageUploadField
                name="photoUrls"
                label="Portfolio image"
                defaultValue={existingVendor?.photos[1]}
                helperText="Optional detail shot for your profile gallery."
              />
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
            <div className="md:col-span-2">
              <Button type="submit">Save vendor profile</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card id="services">
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
