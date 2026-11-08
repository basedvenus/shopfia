import { BusinessProfileForm, BusinessDescription } from "@/components/vendor/business-profile-form";
import { VENDOR_CATEGORY_NAMES } from "@/lib/vendor-categories";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FieldShell, SubmitButton } from "@/components/ui/validated-form";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { OnboardingServiceAreas } from "@/components/vendor/onboarding-service-areas";
import { notFound } from "next/navigation";

import type { VendorProfile } from "@prisma/client";

function previewVendor(): (VendorProfile & { categories: { categoryId: string }[] }) | null { return null; }

export default async function BusinessDetailsPreview() {
  if (process.env.NODE_ENV !== "development") notFound();
  const existingVendor = previewVendor();
  const initialStorefrontName = "Your business name";
  const initialStorefrontUsername = "your-business";
  const resolvedSearchParams = {profileError: undefined, newBusiness: "1"};
  const businessLogoUploadEndpoint = undefined;
  const businessCoverUploadEndpoint = undefined;
  const sortedCategories = VENDOR_CATEGORY_NAMES.map((name, index) => ({name, id: `preview-category-${index}`}));
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
          Add your business details, photos, and service areas. You can add services after saving.
        </p>
      </div>

      <Card id="profile">
        <CardHeader>
          <CardTitle>Business storefront</CardTitle>
        </CardHeader>
        <CardContent>
          {resolvedSearchParams?.profileError ? (
            <div className="mb-4 rounded-[1.2rem] border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {resolvedSearchParams.profileError}
            </div>
          ) : null}
          <BusinessProfileForm
            action={async () => { "use server"; return {error: "This is a preview. No business details were saved."}; }}
            className="grid gap-4 md:grid-cols-2"
            errorIntro="Your business storefront is almost there. Fix the highlighted field and save again."
          >
            <input type="hidden" name="preserveAvailability" value="1" />
            <input type="hidden" name="availabilityNotes" value={existingVendor?.availabilityNotes ?? ""} />
            {existingVendor ? <input type="hidden" name="businessId" value={existingVendor.id} /> : null}
            {resolvedSearchParams?.newBusiness ? <input type="hidden" name="newBusiness" value="1" /> : null}
            <div>
              <ImageUploadField
                name="logoUrl"
                label="Vendor logo (Optional)"
                defaultValue={existingVendor?.logoUrl}
                defaultCrop={existingVendor?.logoCrop as { x: number; y: number; zoom: number } | null}
                rounded="full"
                uploadEndpoint={businessLogoUploadEndpoint}
                helperText="Start with the mark hosts will remember."
              />
            </div>
            <div>
              <ImageUploadField
                name="photoUrls"
                label="Cover/banner image (Optional)"
                defaultValue={existingVendor?.coverPhoto ?? existingVendor?.photos[0]}
                defaultCrop={existingVendor?.coverPhotoCrop as { x: number; y: number; zoom: number } | null}
                uploadEndpoint={businessCoverUploadEndpoint}
                helperText="Optional. This becomes the hero image on your storefront."
              />
            </div>
            <FieldShell
              label="Business name"
              required
              helperText="Your public business name. This is separate from your personal display name."
            >
              <Input
                name="name"
                placeholder="Your business name"
                defaultValue={existingVendor?.name ?? initialStorefrontName}
                data-required-label="Business name"
                required
              />
            </FieldShell>
            <FieldShell
              label="Business username"
              required
              helperText="Your business username, separate from your personal username."
            >
              <Input
                name="username"
                placeholder="Your business username"
                defaultValue={existingVendor?.username ?? existingVendor?.slug ?? initialStorefrontUsername ?? ""}
                data-required-label="Business username"
                required
              />
            </FieldShell>
            <FieldShell label="Instagram Link" optional>
              <Input name="instagramUrl" type="url" placeholder="https://instagram.com/yourbusiness" defaultValue={existingVendor?.instagramUrl ?? ""} />
            </FieldShell>
            <FieldShell label="TikTok Link" optional>
              <Input name="tiktokUrl" type="url" placeholder="https://tiktok.com/@yourbusiness" defaultValue={existingVendor?.tiktokUrl ?? ""} />
            </FieldShell>
            <FieldShell label="Website" optional>
              <Input name="website" type="url" placeholder="https://yourbusiness.com" defaultValue={existingVendor?.website ?? ""} />
            </FieldShell>
            <OnboardingServiceAreas business={existingVendor ?? {city:"Los Angeles",state:"CA",formattedAddress:"Los Angeles, CA",locationLat:34.0522,locationLng:-118.2437,serviceRadiusMiles:25}} />
            <div className="md:col-span-2">
              <FieldShell label="Business Description" optional helperText="A few warm details help hosts understand your style and specialties.">
                <BusinessDescription defaultValue={existingVendor?.bio ?? ""} />
              </FieldShell>
            </div>
            <FieldShell
              label="Storefront URL"
              required
              helperText="Your business web address, separate from your personal profile at shopfia.app/profiles/your-username. Choose an available ending; reserved paths cannot be used."
            >
              <div className="flex overflow-hidden rounded-full border bg-white focus-within:ring-2 focus-within:ring-ring">
                <span className="inline-flex items-center border-r bg-muted/60 px-3 text-sm text-muted-foreground">
                  shopfia.app/
                </span>
                <Input
                  name="slug"
                  placeholder="your-storefront"
                  defaultValue={existingVendor?.slug ?? initialStorefrontUsername ?? ""}
                  className="border-0 focus-visible:ring-0"
                  data-required-label="Storefront URL"
                  required
                />
              </div>
            </FieldShell>
            <div className="md:col-span-2 rounded-[1.5rem] border p-4">
              <label className="mb-1 block text-sm font-medium">Categories <span className="text-destructive">*</span></label>
              <p className="mb-3 text-xs leading-5 text-muted-foreground">
                Choose at least one category so hosts know where your storefront belongs.
              </p>
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
            <div id="profile-save" className="md:col-span-2 scroll-mt-28 rounded-[1.2rem] border border-border bg-[#fbf7f5] p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold">Profile details complete?</p>
                  <p className="text-xs leading-5 text-muted-foreground">
                    Save your business to continue to your dashboard.
                  </p>
                </div>
                <SubmitButton type="submit" pendingText="Saving business...">
                  Save business
                </SubmitButton>
              </div>
            </div>
          </BusinessProfileForm>
        </CardContent>
      </Card>

    </div>
  );
}

const categoryOrder: string[] = [...VENDOR_CATEGORY_NAMES];

function displayCategoryName(name: string) {
  return name;
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

