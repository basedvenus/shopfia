/** Foundational vendor types shared by registration, search, services, and party tagging. */
export const VENDOR_CATEGORIES = [
  { name: "Backdrops", iconName: "image" },
  { name: "Balloons", iconName: "party-popper" },
  { name: "Cakes & Desserts", iconName: "cake" },
  { name: "Stores & Local Shops", iconName: "store" },
  { name: "Catering & Beverages", iconName: "utensils-crossed" },
  { name: "Entertainment", iconName: "music" },
  { name: "Florals", iconName: "flower-2" },
  { name: "Party Rentals", iconName: "sofa" },
  { name: "Styling & Decor", iconName: "sparkles" },
  { name: "Photography & Video", iconName: "camera" },
  { name: "Music & DJs", iconName: "music" },
  { name: "Event Planning", iconName: "calendar" },
  { name: "Other Event Services", iconName: "sparkles" }
] as const;
export const VENDOR_CATEGORY_NAMES = VENDOR_CATEGORIES.map((category) => category.name) as [typeof VENDOR_CATEGORIES[number]["name"], ...typeof VENDOR_CATEGORIES[number]["name"][]];

export function normalizeVendorCategoryName(name: string) {
  return ["Children's Entertainment", "Children’s Entertainment", "Kids Entertainment"].includes(name) ? "Entertainment" : name;
}

/** Preserve existing saved search links and forms opened before the category merge. */
export function normalizeVendorCategoryId(id: string) {
  return id === "cmm8wteb5000599moyu2w5541" ? "standard-vendor-entertainment" : id;
}
