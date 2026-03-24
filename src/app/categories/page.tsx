import Link from "next/link";
import { CategoryAudience } from "@prisma/client";
import { Card, CardContent } from "@/components/ui/card";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await db.category.findMany({
    include: { _count: { select: { offerings: true, vendors: true } } },
    orderBy: [{ audience: "asc" }, { name: "asc" }]
  });
  const vendorCategories = categories.filter((c) => c.audience === CategoryAudience.VENDOR);
  const buyerCategories = categories.filter((c) => c.audience === CategoryAudience.BUYER);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Categories</h1>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Vendor Categories</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vendorCategories.map((category) => (
            <Link key={category.id} href={`/explore?categoryId=${category.id}`}>
              <Card className="h-full transition hover:-translate-y-0.5">
                <CardContent className="p-4">
                  <h2 className="font-semibold">{category.name}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {category._count.vendors} vendors · {category._count.offerings} offerings
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Buyer Categories</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {buyerCategories.map((category) => (
            <Card key={category.id} className="h-full">
              <CardContent className="p-4">
                <h2 className="font-semibold">{category.name}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Planning preference category
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
