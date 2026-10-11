export const PARTY_OCCASIONS = ["Baby Shower", "Gender Reveal", "Kids’ Birthday", "Birthday Celebration", "Just Because", "Celebration of Life", "Holiday Event", "Wedding", "Graduation", "Corporate Event"];

export function inferPartyOccasion(tags: string[], title: string) {
  const existing = PARTY_OCCASIONS.find((name) => tags.some((tag) => occasionTag(tag) === occasionTag(name)));
  if (existing) return existing;
  const text = [...tags, title].join(" ").toLowerCase();
  if (/baby.?shower/.test(text)) return "Baby Shower";
  if (/gender.?reveal/.test(text)) return "Gender Reveal";
  if (/kid.*birthday|child.*birthday/.test(text)) return "Kids’ Birthday";
  if (/birthday/.test(text)) return "Birthday Celebration";
  return "";
}

export function occasionTag(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function partyCategoryLabel(tag: string) {
  return PARTY_OCCASIONS.find((name) => occasionTag(name) === tag) ?? `#${tag}`;
}
