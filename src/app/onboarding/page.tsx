import type { ReactNode } from "react";
import { CategoryAudience, UserRole } from "@prisma/client";
import { upsertVendorProfileAction } from "@/app/actions/vendor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { OfferingSetupForm } from "@/components/vendor/offering-setup-form";
import { ServiceAreaPicker } from "@/components/vendor/service-area-picker";

export const dynamic = "force-dynamic";

export default async function VendorOnboardingPage() {
  const [{ requireRole }, { db }] = await Promise.all([
    import("@/lib/auth/guards"),
    import("@/lib/db")
  ]);
  const session = await requireRole([UserRole.BUYER, UserRole.VENDOR, UserRole.ADMIN]);
  const [categories, existingVendor] = await Promise.all([
    db.category.findMany({ where: { audience: CategoryAudience.VENDOR }, orderBy: { name: "asc" } }),
    db.vendorProfile.findUnique({
      where: { userId: session.user.id },
      include: { categories: true, offerings: { take: 1 } }
    })
  ]);
  const sortedCategories = sortVendorCategories(categories);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Vendor storefront setup
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
          Build your beautiful ShopFia storefront.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Add the visual identity, social links, service areas, and first listing hosts need to understand your style.
        </p>
      </div>

      <Card id="profile">
        <CardHeader>
          <CardTitle>1. Vendor Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={upsertVendorProfileAction} className="grid gap-4 md:grid-cols-2">
            <div>
              <ImageUploadField
                name="logoUrl"
                label="Vendor logo"
                defaultValue={existingVendor?.logoUrl}
                rounded="full"
                helperText="Start with the mark hosts will remember."
              />
            </div>
            <div>
              <ImageUploadField
                name="photoUrls"
                label="Cover/banner image"
                defaultValue={existingVendor?.coverPhoto ?? existingVendor?.photos[0]}
                helperText="Optional. This becomes the hero image on your storefront."
              />
            </div>
            <Field label="Business Name">
              <Input name="name" placeholder="Solano Flora & Table" defaultValue={existingVendor?.name} required />
            </Field>
            <Field label="Vendor Username">
              <Input name="username" placeholder="solanoflora" defaultValue={existingVendor?.username ?? existingVendor?.slug ?? ""} />
            </Field>
            <Field label="Instagram Link">
              <Input name="instagramUrl" type="url" placeholder="https://instagram.com/yourbusiness" defaultValue={existingVendor?.instagramUrl ?? ""} />
            </Field>
            <Field label="TikTok Link">
              <Input name="tiktokUrl" type="url" placeholder="https://tiktok.com/@yourbusiness" defaultValue={existingVendor?.tiktokUrl ?? ""} />
            </Field>
            <Field label="Website (optional)">
              <Input name="website" type="url" placeholder="https://yourbusiness.com" defaultValue={existingVendor?.website ?? ""} />
            </Field>
            <Field label="City">
              <Input name="city" placeholder="Fairfield" defaultValue={existingVendor?.city} required />
            </Field>
            <Field label="State">
              <Input name="state" placeholder="CA" defaultValue={existingVendor?.state ?? ""} />
            </Field>
            <Field label="Zip Code">
              <Input name="zipCode" placeholder="94533" defaultValue={existingVendor?.zipCode ?? ""} />
            </Field>
            <div className="md:col-span-2">
              <Field label="Business Description">
                <Textarea
                  name="bio"
                  placeholder="Describe your style, specialties, and the types of celebrations you love creating..."
                  defaultValue={existingVendor?.bio ?? ""}
                  className="min-h-[120px]"
                />
              </Field>
            </div>
            <div>
              <Field label="Travel Radius">
                <Input
                  name="serviceRadiusMiles"
                  type="number"
                  min={1}
                  max={200}
                  placeholder="25 miles"
                  defaultValue={existingVendor?.serviceRadiusMiles ?? 25}
                />
              </Field>
            </div>
            <div className="flex items-end">
              <label className="flex min-h-11 w-full items-center gap-2 rounded-2xl border bg-white px-3 py-3 text-sm">
                <input
                  type="checkbox"
                  name="weekendAvailable"
                  defaultChecked={existingVendor?.weekendAvailable ?? true}
                />
                Available for weekend parties
              </label>
            </div>
            <div className="md:col-span-2">
              <ServiceAreaPicker defaultValue={existingVendor?.serviceAreaNotes} />
            </div>
            <div className="md:col-span-2">
              <Field label="Booking Notes">
                <Textarea
                  name="availabilityNotes"
                  placeholder="Booking availability, contact preferences, travel notes, or lead time..."
                  defaultValue={existingVendor?.availabilityNotes ?? ""}
                  className="min-h-[90px]"
                />
              </Field>
            </div>
            <div className="md:col-span-2 rounded-[1.5rem] border p-4">
              <label className="mb-3 block text-sm font-medium">Categories</label>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {sortedCategories.map((category) => {
                  const checked = existingVendor?.categories.some((c) => c.categoryId === category.id);
                  return (
                    <label key={category.id} className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
                      <input type="checkbox" name="categoryIds" value={category.id} defaultChecked={checked} />
                      {displayCategoryName(category.name)}
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
        <CardHeader>
          <CardTitle>2. Add First Offering</CardTitle>
        </CardHeader>
        <CardContent>
          <OfferingSetupForm
            categories={sortedCategories.map((category) => ({
              id: category.id,
              name: displayCategoryName(category.name)
            }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}

const categoryOrder = [
  "Cakes & Desserts",
  "Decor & Installation",
  "Event Planning",
  "Florals",
  "Food & Beverage",
  "Kids Activities",
  "Party Favors & Gifts",
  "Styled Setups"
];

function displayCategoryName(name: string) {
  return name === "Party Favors and Gifts" ? "Party Favors & Gifts" : name;
}

function sortVendorCategories<T extends { name: string }>(categories: T[]) {
  return [...categories].sort((left, right) => {
    const leftIndex = categoryOrder.indexOf(displayCategoryName(left.name));
    const rightIndex = categoryOrder.indexOf(displayCategoryName(right.name));

    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    }

    return displayCategoryName(left.name).localeCompare(displayCategoryName(right.name));
  });
}
