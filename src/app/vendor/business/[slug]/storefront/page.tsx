import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { StorefrontCustomizer } from "@/components/vendor/storefront-customizer";
import { sanitizeStorefrontSections, storefrontUrl } from "@/lib/businesses";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function StorefrontCustomizerPage({
  params,
  searchParams
}: {
  params: Promise<{ slug: string }>;
  searchParams?: Promise<{ customizeError?: string; draft?: string; published?: string }>;
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams ?? Promise.resolve({} as { customizeError?: string; draft?: string; published?: string })
  ]);
  const session = await auth();
  if (!session?.user?.id) redirect("/account?next=login");

  const business = await db.vendorProfile.findFirst({
    where:
      session.user.role === "ADMIN"
        ? { slug }
        : {
            slug,
            OR: [
              { userId: session.user.id },
              { managers: { some: { userId: session.user.id } } }
            ]
          },
    select: {
      availabilityNotes: true,
      bio: true,
      city: true,
      coverPhoto: true,
      id: true,
      instagramUrl: true,
      logoUrl: true,
      name: true,
      photos: true,
      serviceAreaNotes: true,
      serviceRadiusMiles: true,
      slug: true,
      startingPriceCents: true,
      state: true,
      storefrontAboutHeading: true,
      storefrontAboutImage: true,
      storefrontButtonStyle: true,
      storefrontFontStyle: true,
      storefrontHiddenSections: true,
      storefrontHiddenOfferingIds: true,
      storefrontImageShape: true,
      storefrontLayout: true,
      storefrontPalette: true,
      storefrontSectionOrder: true,
      storefrontTagline: true,
      storefrontTextTone: true,
      storefrontDraftJson: true,
      storefrontFaqJson: true,
      storefrontPoliciesJson: true,
      storefrontBookingJson: true,
      storefrontFeaturedOfferingIds: true,
      storefrontOfferingOrder: true,
      tiktokUrl: true,
      website: true,
      categories: { select: { categoryId: true, category: { select: { name: true } } } },
      offerings: {
        orderBy: { createdAt: "desc" },
        select: {
          active: true,
          basePriceCents: true,
          categoryId: true,
          description: true,
          id: true,
          messageForPricing: true,
          photos: true,
          title: true,
          turnaroundDays: true
        }
      }
    }
  });

  if (!business) redirect("/vendor/dashboard");

  return (
    <StorefrontCustomizer
      business={{
        ...business,
        storefrontSectionOrder: sanitizeStorefrontSections(business.storefrontSectionOrder)
      }}
      publicUrl={storefrontUrl(business.slug)}
      saved={Boolean(resolvedSearchParams.published)}
      draftSaved={Boolean(resolvedSearchParams.draft)}
      errorMessage={resolvedSearchParams.customizeError}
    />
  );
}
