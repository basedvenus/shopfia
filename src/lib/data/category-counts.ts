import { publicOfferingWhere, publicVendorWhere } from "@/lib/public-marketplace";

type CategoryCountDb = {
  offering: {
    count(args: unknown): Promise<number>;
  };
  vendorProfile: {
    count(args: unknown): Promise<number>;
  };
};

export async function getExploreCategoryCounts(db: CategoryCountDb, categoryId: string) {
  const [vendors, offerings, eventOfferings] = await Promise.all([
    db.vendorProfile.count({
      where: publicVendorWhere({
        OR: [
          { categories: { some: { categoryId } } },
          {
            offerings: {
              some: publicOfferingWhere({
                active: true,
                OR: [
                  { categoryId },
                  { categories: { some: { categoryId } } }
                ]
              })
            }
          }
        ]
      })
    }),
    db.offering.count({
      where: publicOfferingWhere({
        active: true,
        OR: [
          { categoryId },
          { categories: { some: { categoryId } } },
          { vendor: { categories: { some: { categoryId } } } }
        ]
      })
    }),
    db.offering.count({
      where: publicOfferingWhere({
        active: true,
        eventCategories: { some: { categoryId } }
      })
    })
  ]);

  return { eventOfferings, offerings, vendors };
}
