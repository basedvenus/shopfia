import { notFound } from "next/navigation";
import VendorProfilePage from "@/app/vendor/profile/[slug]/page";
import { isReservedStorefrontSlug } from "@/lib/businesses";

export const dynamic = "force-dynamic";

export default async function PublicStorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (isReservedStorefrontSlug(slug)) {
    notFound();
  }

  return <VendorProfilePage params={Promise.resolve({ slug })} />;
}
