import { BusinessProfileForm, BusinessDescription } from "@/components/vendor/business-profile-form";
import { VENDOR_CATEGORY_NAMES } from "@/lib/vendor-categories";
import { CategoryAudience, UserRole } from "@prisma/client";
import { upsertVendorProfileAction } from "@/app/actions/vendor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldShell, SubmitButton } from "@/components/ui/validated-form";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { PlaceAutocompleteInput } from "@/components/location/place-autocomplete-input";
import { businessManagerWhere } from "@/lib/businesses";
import { notFound } from "next/navigation";
import { ServiceAreaPicker } from "@/components/vendor/service-area-picker";

export const dynamic = "force-dynamic";

export default async function VendorOnboardingPage({
  searchParams
}: {
  searchParams?: Promise<{ business?: string; newBusiness?: string; offeringError?: string; profileError?: string; storefrontName?: string | string[] }>;
}) {
  const [{ requireRole }, { db }] = await Promise.all([
    import("@/lib/auth/guards"),
    import("@/lib/db")
  ]);
  const session = await requireRole([UserRole.BUYER, UserRole.VENDOR, UserRole.ADMIN]);
  const resolvedSearchParams = await searchParams;
  const initialStorefrontName = resolvedSearchParams?.newBusiness && typeof resolvedSearchParams.storefrontName === "string"
    ? resolvedSearchParams.storefrontName.trim().slice(0, 80)
    : undefined;
  const editingBusinessSlug = resolvedSearchParams?.newBusiness ? null : resolvedSearchParams?.business;
  const [categories, existingVendor] = await Promise.all([
    db.category.findMany({ where: { audience: CategoryAudience.VENDOR }, orderBy: { name: "asc" } }),
    db.vendorProfile.findFirst({
      where: editingBusinessSlug
        ? {
            slug: editingBusinessSlug,
            ...businessManagerWhere(session.user.id, session.user.role)
          }
        : resolvedSearchParams?.newBusiness
          ? { id: "__new_business__" }
          : {
              userId: session.user.id
            },
      select: {
        id: true,
        availabilityNotes: true,
        bio: true,
        city: true,
        coverPhoto: true,
        coverPhotoCrop: true,
        formattedAddress: true,
        googlePlaceId: true,
        instagramUrl: true,
        locationLat: true,
        locationLng: true,
        logoCrop: true,
        logoUrl: true,
        name: true,
        photos: true,
        serviceAreaNotes: true,
        serviceRadiusMiles: true,
        slug: true,
        state: true,
        tiktokUrl: true,
        username: true,
        website: true,
        weekendAvailable: true,
        zipCode: true,
        categories: { select: { categoryId: true } },
        offerings: { select: { id: true }, take: 1 }
      }
    })
  ]);
  if (editingBusinessSlug && !existingVendor) notFound();
  const sortedCategories = sortVendorCategories(categories);
  const businessMediaUploadEndpoint = existingVendor ? `/api/vendor/business/${existingVendor.id}/media` : undefined;
  const businessLogoUploadEndpoint = businessMediaUploadEndpoint ? `${businessMediaUploadEndpoint}?target=logo` : undefined;
  const businessCoverUploadEndpoint = businessMediaUploadEndpoint ? `${businessMediaUploadEndpoint}?target=cover` : undefined;

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
            action={upsertVendorProfileAction}
            className="grid gap-4 md:grid-cols-2"
            errorIntro="Your business storefront is almost there. Fix the highlighted field and save again."
          >
            <input type="hidden" name="preserveAvailability" value="1" />
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
              label="Storefront name"
              required
              helperText="Your public business name. This is separate from your personal display name."
            >
              <Input
                name="name"
                placeholder="Enter your storefront name"
                defaultValue={existingVendor?.name ?? initialStorefrontName}
                data-required-label="Storefront name"
                required
              />
            </FieldShell>
            <FieldShell
              label="Storefront handle"
              required
              helperText="Your business's own @handle for tags, separate from your personal @username. Set its web address below."
            >
              <Input
                name="username"
                placeholder="Enter your storefront handle"
                defaultValue={existingVendor?.username ?? existingVendor?.slug ?? ""}
                data-required-label="Storefront handle"
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
            <div className="md:col-span-2">
              <PlaceAutocompleteInput
                syncAddressFields
                required
                requireSelection
                searchType="cities"
                label="City"
                helperText="Start typing and select your business city from the suggestions."
                placeholder="Search for your city"
                defaultValue={existingVendor?.formattedAddress ?? [existingVendor?.city, existingVendor?.state].filter(Boolean).join(", ")}
                defaultPlace={{
                  formattedAddress: existingVendor?.formattedAddress ?? undefined,
                  city: existingVendor?.city,
                  state: existingVendor?.state ?? undefined,
                  zipCode: existingVendor?.zipCode ?? undefined,
                  lat: existingVendor?.locationLat ?? undefined,
                  lng: existingVendor?.locationLng ?? undefined,
                  placeId: existingVendor?.googlePlaceId ?? undefined
                }}
                fieldNames={{
                  input: "formattedAddress",
                  formattedAddress: "formattedAddress",
                  city: "locationCity",
                  state: "locationState",
                  zipCode: "locationZipCode",
                  lat: "locationLat",
                  lng: "locationLng",
                  placeId: "googlePlaceId"
                }}
              />
            </div>
            <FieldShell label="State" optional>
              <Input name="state" readOnly placeholder="Filled from your city" defaultValue={existingVendor?.state ?? ""} />
            </FieldShell>
            <FieldShell label="Zip Code" optional>
              <Input name="zipCode" placeholder="ZIP code" defaultValue={existingVendor?.zipCode ?? ""} />
            </FieldShell>
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
                  defaultValue={existingVendor?.slug ?? ""}
                  className="border-0 focus-visible:ring-0"
                  data-required-label="Storefront URL"
                  required
                />
              </div>
            </FieldShell>
            <div>
              <FieldShell label="Travel Radius" optional helperText="We default to 25 miles if you leave this as-is.">
                <Input
                  name="serviceRadiusMiles"
                  type="number"
                  min={1}
                  max={200}
                  placeholder="25 miles"
                  defaultValue={existingVendor?.serviceRadiusMiles ?? 25}
                />
              </FieldShell>
            </div>
            <div className="md:col-span-2">
              <ServiceAreaPicker defaultValue={existingVendor?.serviceAreaNotes} />
            </div>
            <div className="md:col-span-2">
              <FieldShell label="Booking Notes" optional>
                <Textarea
                  name="availabilityNotes"
                  placeholder="Booking availability, contact preferences, travel notes, or lead time..."
                  defaultValue={existingVendor?.availabilityNotes ?? ""}
                  className="min-h-[90px]"
                />
              </FieldShell>
            </div>
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

