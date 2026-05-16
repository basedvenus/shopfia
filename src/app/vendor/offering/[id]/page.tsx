import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { CategoryAudience } from "@prisma/client";
import { auth } from "@/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OfferingSetupForm } from "@/components/vendor/offering-setup-form";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type PricedOption = {
  addonComponentIds?: string[];
  componentIds?: string[];
  description?: string;
  name: string;
  priceCents?: number;
};

type ServiceComponent = {
  category?: string;
  description?: string;
  id: string;
  priceCents?: number;
  title: string;
};

export default async function VendorOfferingEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/account?next=login");
  }

  const [offering, categories, eventCategories] = await Promise.all([
    db.offering.findUnique({
      where: { id },
      include: {
        categories: { select: { categoryId: true } },
        eventCategories: { select: { categoryId: true } },
        vendor: { select: { id: true, name: true, slug: true, userId: true } }
      }
    }),
    db.category.findMany({ where: { audience: CategoryAudience.VENDOR }, orderBy: { name: "asc" } }),
    db.category.findMany({ where: { audience: CategoryAudience.BUYER }, orderBy: { name: "asc" } })
  ]);

  if (!offering) {
    notFound();
  }

  if (offering.vendor.userId !== session.user.id) {
    notFound();
  }

  const sortedCategories = sortVendorCategories(categories);
  const sortedEventCategories = sortEventCategories(eventCategories);

  return (
    <div className="space-y-6">
      <Link
        href="/vendor/dashboard#services"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to services
      </Link>

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Edit service
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">
          Update {offering.title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Changes update your vendor dashboard, public storefront, listing page, and discovery feeds.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Service Details</CardTitle>
        </CardHeader>
        <CardContent>
          <OfferingSetupForm
            categories={sortedCategories.map((category) => ({
              id: category.id,
              name: displayCategoryName(category.name)
            }))}
            eventCategories={sortedEventCategories.map((category) => ({
              id: category.id,
              name: category.name
            }))}
            offering={{
              addons: getPricedOptions(offering.addonsJson),
              basePriceCents: offering.basePriceCents,
              categoryId: offering.categoryId,
              categoryIds: [
                offering.categoryId,
                ...offering.categories.map((category) => category.categoryId)
              ].filter((categoryId, index, categoryIds) => categoryIds.indexOf(categoryId) === index),
              components: getServiceComponents(offering.faqJson),
              description: offering.description,
              eventCategoryIds: offering.eventCategories.map((eventCategory) => eventCategory.categoryId),
              id: offering.id,
              messageForPricing: offering.messageForPricing,
              packages: getPricedOptions(offering.variantsJson),
              photos: offering.photos,
              photoCrops: getImageCrops(offering.photoCrops),
              slug: offering.slug,
              title: offering.title,
              type: offering.type
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function getPricedOptions(value: unknown): PricedOption[] {
  if (!Array.isArray(value)) return [];

  return value.reduce<PricedOption[]>((options, item) => {
    if (!item || typeof item !== "object") return options;
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name.trim() : "";
    if (!name) return options;
    const description = typeof record.description === "string" ? record.description.trim() : "";
    const priceCents = typeof record.priceCents === "number" ? record.priceCents : undefined;
    const componentIds = Array.isArray(record.componentIds)
      ? record.componentIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    const addonComponentIds = Array.isArray(record.addonComponentIds)
      ? record.addonComponentIds.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      : [];
    options.push({ name, description, priceCents, componentIds, addonComponentIds });
    return options;
  }, []);
}

function getServiceComponents(value: unknown): ServiceComponent[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const components = (value as Record<string, unknown>).serviceComponents;
  if (!Array.isArray(components)) return [];

  return components.reduce<ServiceComponent[]>((items, item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return items;
    const record = item as Record<string, unknown>;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    const title = typeof record.title === "string" ? record.title.trim() : "";
    if (!id || !title) return items;
    items.push({
      id,
      title,
      description: typeof record.description === "string" ? record.description.trim() : "",
      priceCents: typeof record.priceCents === "number" ? record.priceCents : undefined,
      category: typeof record.category === "string" ? record.category.trim() : ""
    });
    return items;
  }, []);
}

function getImageCrops(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const record = item as Record<string, unknown>;
      const x = Number(record.x);
      const y = Number(record.y);
      const zoom = Number(record.zoom);
      if (![x, y, zoom].every(Number.isFinite)) return null;
      return { x, y, zoom };
    })
    .filter((crop): crop is { x: number; y: number; zoom: number } => Boolean(crop));
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

const eventCategoryOrder = [
  "Baby Shower",
  "Birthday Party",
  "Wedding",
  "Corporate Event",
  "Holiday Party",
  "Graduation Party"
];

function displayCategoryName(name: string) {
  return name === "Party Favors and Gifts" ? "Party Favors & Gifts" : name;
}

function sortVendorCategories<T extends { name: string }>(categories: T[]) {
  return sortByOrder(categories, categoryOrder);
}

function sortEventCategories<T extends { name: string }>(categories: T[]) {
  return sortByOrder(
    categories.filter((category) => eventCategoryOrder.includes(category.name)),
    eventCategoryOrder
  );
}

function sortByOrder<T extends { name: string }>(items: T[], order: string[]) {
  return [...items].sort((left, right) => {
    const leftIndex = order.indexOf(displayCategoryName(left.name));
    const rightIndex = order.indexOf(displayCategoryName(right.name));

    if (leftIndex !== -1 || rightIndex !== -1) {
      return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
        (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex);
    }

    return displayCategoryName(left.name).localeCompare(displayCategoryName(right.name));
  });
}
