import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CategoryAudience } from "@prisma/client";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OfferingSetupForm } from "@/components/vendor/offering-setup-form";
import { businessManagerWhere } from "@/lib/businesses";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewBusinessServicePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/account?next=login");
  }

  const [business, categories, eventCategories] = await Promise.all([
    db.vendorProfile.findFirst({
      where: {
        slug,
        ...businessManagerWhere(session.user.id, session.user.role)
      },
      select: { id: true, name: true, slug: true }
    }),
    db.category.findMany({ where: { audience: CategoryAudience.VENDOR }, orderBy: { name: "asc" } }),
    db.category.findMany({ where: { audience: CategoryAudience.BUYER }, orderBy: { name: "asc" } })
  ]);

  if (!business) {
    redirect("/vendor/dashboard");
  }

  return (
    <div className="space-y-6">
      <Link
        href={`/vendor/business/${business.slug}#services`}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to services
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Add service</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">Create a service for {business.name}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          This service will appear in the business dashboard, storefront, Explore, and category results after it is saved.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Details</CardTitle>
        </CardHeader>
        <CardContent>
          <OfferingSetupForm
            businessId={business.id}
            categories={categories.map((category) => ({ id: category.id, name: displayCategoryName(category.name) }))}
            eventCategories={eventCategories.map((category) => ({ id: category.id, name: category.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function displayCategoryName(name: string) {
  return name === "Children's Entertainment" ? "Kids Entertainment" : name;
}
