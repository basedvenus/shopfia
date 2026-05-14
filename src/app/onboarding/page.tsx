import { CategoryAudience, UserRole } from "@prisma/client";
import { upsertVendorProfileAction } from "@/app/actions/vendor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldShell, SubmitButton, ValidatedForm } from "@/components/ui/validated-form";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { PlaceAutocompleteInput } from "@/components/location/place-autocomplete-input";
import { OfferingSetupForm } from "@/components/vendor/offering-setup-form";
import { ServiceAreaPicker } from "@/components/vendor/service-area-picker";

export const dynamic = "force-dynamic";

export default async function VendorOnboardingPage({
  searchParams
}: {
  searchParams?: { offeringError?: string; profileError?: string };
}) {
  const [{ requireRole }, { db }] = await Promise.all([
    import("@/lib/auth/guards"),
    import("@/lib/db")
  ]);
  const session = await requireRole([UserRole.BUYER, UserRole.VENDOR, UserRole.ADMIN]);
  const [categories, eventCategories, existingVendor] = await Promise.all([
    db.category.findMany({ where: { audience: CategoryAudience.VENDOR }, orderBy: { name: "asc" } }),
    db.category.findMany({ where: { audience: CategoryAudience.BUYER }, orderBy: { name: "asc" } }),
    db.vendorProfile.findUnique({
      where: { userId: session.user.id },
      include: { categories: true, offerings: { take: 1 } }
    })
  ]);
  const sortedCategories = sortVendorCategories(categories);
  const sortedEventCategories = sortEventCategories(eventCategories);

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
          {searchParams?.profileError ? (
            <div className="mb-4 rounded-[1.2rem] border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {searchParams.profileError}
            </div>
          ) : null}
          <ValidatedForm
            action={upsertVendorProfileAction}
            className="grid gap-4 md:grid-cols-2"
            errorIntro="Your vendor profile is almost there. Fix the highlighted field and save again."
          >
            <div>
              <ImageUploadField
                name="logoUrl"
                label="Vendor logo (Optional)"
                defaultValue={existingVendor?.logoUrl}
                rounded="full"
                helperText="Start with the mark hosts will remember."
              />
            </div>
            <div>
              <ImageUploadField
                name="photoUrls"
                label="Cover/banner image (Optional)"
                defaultValue={existingVendor?.coverPhoto ?? existingVendor?.photos[0]}
                helperText="Optional. This becomes the hero image on your storefront."
              />
            </div>
            <FieldShell
              label="Business Name"
              required
              helperText="Use the public name hosts will recognize on your storefront."
            >
              <Input
                name="name"
                placeholder="Solano Flora & Table"
                defaultValue={existingVendor?.name}
                data-required-label="Business Name"
                required
              />
            </FieldShell>
            <FieldShell label="Vendor Username" required helperText="Example: solanoflora. This becomes part of your public storefront identity.">
              <Input
                name="username"
                placeholder="solanoflora"
                defaultValue={existingVendor?.username ?? existingVendor?.slug ?? ""}
                data-required-label="Vendor Username"
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
                label="Business Location"
                helperText="Choose a city, venue, neighborhood, or address so hosts can discover you nearby."
                placeholder="Fairfield, CA or Solano County Event Center"
                defaultValue={existingVendor?.formattedAddress ?? ""}
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
            <FieldShell label="City" required helperText="Enter the main city your business serves.">
              <Input
                name="city"
                placeholder="Fairfield"
                defaultValue={existingVendor?.city}
                data-required-label="City"
                required
              />
            </FieldShell>
            <FieldShell label="State" optional>
              <Input name="state" placeholder="CA" defaultValue={existingVendor?.state ?? ""} />
            </FieldShell>
            <FieldShell label="Zip Code" optional>
              <Input name="zipCode" placeholder="94533" defaultValue={existingVendor?.zipCode ?? ""} />
            </FieldShell>
            <div className="md:col-span-2">
              <FieldShell label="Business Description" optional helperText="A few warm details help hosts understand your style and specialties.">
                <Textarea
                  name="bio"
                  placeholder="Describe your style, specialties, and the types of celebrations you love creating..."
                  defaultValue={existingVendor?.bio ?? ""}
                  className="min-h-[120px]"
                />
              </FieldShell>
            </div>
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
              <label className="mb-1 block text-sm font-medium">Categories <span className="text-xs font-normal text-muted-foreground">Optional</span></label>
              <p className="mb-3 text-xs leading-5 text-muted-foreground">
                Pick categories now or add them later from your vendor dashboard.
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
            <div className="md:col-span-2">
              <SubmitButton type="submit" pendingText="Saving vendor profile...">
                Save vendor profile
              </SubmitButton>
            </div>
          </ValidatedForm>
        </CardContent>
      </Card>

      <Card id="services">
        <CardHeader>
          <CardTitle>2. Add First Offering</CardTitle>
        </CardHeader>
        <CardContent>
          {searchParams?.offeringError ? (
            <div className="mb-4 rounded-[1.2rem] border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {searchParams.offeringError}
            </div>
          ) : null}
          {existingVendor ? (
            <OfferingSetupForm
              categories={sortedCategories.map((category) => ({
                id: category.id,
                name: displayCategoryName(category.name)
              }))}
              eventCategories={sortedEventCategories.map((category) => ({
                id: category.id,
                name: category.name
              }))}
            />
          ) : (
            <div className="rounded-[1.5rem] border bg-[#fbf7f5] p-5">
              <h3 className="font-semibold">Save your vendor profile first.</h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Once your business profile is tied to your account, you will land in your vendor dashboard and can add offerings from there.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const categoryOrder = [
  "Cakes & Desserts",
  "Florals",
  "Decor & Installation",
  "Styled Setups",
  "Event Planning",
  "Party Favors & Gifts",
  "Food & Beverage",
  "Kids Activities"
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

const eventCategoryOrder = [
  "Baby Shower",
  "Birthday Party",
  "Wedding",
  "Corporate Event",
  "Holiday Party",
  "Graduation Party"
];

function sortEventCategories<T extends { name: string }>(categories: T[]) {
  return categories.filter((category) => eventCategoryOrder.includes(category.name)).sort((left, right) => {
    const leftIndex = eventCategoryOrder.indexOf(left.name);
    const rightIndex = eventCategoryOrder.indexOf(right.name);

    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    }

    return left.name.localeCompare(right.name);
  });
}
