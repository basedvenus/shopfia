import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { StorefrontCustomizer } from "@/components/editor-preview/storefront-customizer";
import { db } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function EditorReview({ searchParams }: { searchParams?: Promise<{ templates?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/account?next=login");
  const query = await searchParams;
  const business = await db.vendorProfile.findFirst({
    where: session.user.role === "ADMIN" ? { slug: "moonmatcha" } : { slug: "moonmatcha", OR: [{ userId: session.user.id }, { managers: { some: { userId: session.user.id } } }] },
    select: {
      averageRating: true,
      reviewCount: true,
      availabilityNotes: true,
      bio: true,
      city: true,
      coverPhoto: true,
      coverPhotoCrop: true,
      id: true,
      instagramUrl: true,
      logoCrop: true,
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
      storefrontInstagramFeedEnabled: true,
      storefrontInstagramFeedUrl: true,
      storefrontLayout: true,
      storefrontPalette: true,
      storefrontSectionOrder: true,
      storefrontTagline: true,
      storefrontTextTone: true,
      storefrontDraftJson: true,
      storefrontFaqJson: true,
      storefrontPoliciesJson: true,
      storefrontSectionLabels: true,
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
  if (!business) notFound();
  return <StorefrontCustomizer previewOnly initialTemplateLibraryOpen={query?.templates === "1"} business={{ ...business, id: "preview-only" }} publicUrl="https://www.shopfia.app/moonmatcha" />;
}
