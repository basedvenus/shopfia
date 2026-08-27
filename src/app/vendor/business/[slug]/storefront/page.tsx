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
  searchParams?: Promise<{ published?: string }>;
}) {
  const [{ slug }, resolvedSearchParams] = await Promise.all([
    params,
    Promise.resolve(searchParams ?? ({} as { published?: string }))
  ]);
  const session = await auth();
  if (!session?.user?.id) redirect("/account?next=login");

  const business = await db.vendorProfile.findFirst({
    where: session.user.role === "ADMIN" ? { slug } : { slug, userId: session.user.id },
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
      storefrontImageShape: true,
      storefrontLayout: true,
      storefrontPalette: true,
      storefrontSectionOrder: true,
      storefrontTagline: true,
      tiktokUrl: true,
      website: true,
      offerings: {
        where: { active: true },
        orderBy: { createdAt: "desc" },
        select: { basePriceCents: true, id: true, title: true },
        take: 6
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
    />
  );
}
