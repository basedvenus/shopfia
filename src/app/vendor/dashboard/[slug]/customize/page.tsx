import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LegacyStorefrontCustomizerRedirect({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  redirect(`/vendor/business/${slug}/storefront`);
}
