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
  if (/^age\d+$/.test(tag)) return `${ordinalAge(Number(tag.slice(3)))} Birthday`;
  for (const [prefix, names] of [["audience", PARTY_AUDIENCES], ["holiday", PARTY_HOLIDAYS], ["graduation", GRADUATION_LEVELS]] as const) {
    const name = names.find((value) => `${prefix}${occasionTag(value)}` === tag);
    if (name) return name;
  }
  return PARTY_OCCASIONS.find((name) => occasionTag(name) === tag) ?? ["Spring", "Summer", "Fall", "Winter", "Child", "Teen", "Adult"].find((name) => occasionTag(name) === tag) ?? "";
}

export const PARTY_AUDIENCES = ["Girl", "Boy", "Mixed group", "Not specified"] as const;
export const GRADUATION_LEVELS = ["Preschool", "Kindergarten", "Elementary School", "Middle School", "High School", "College", "Graduate School", "Other"] as const;
export const PARTY_HOLIDAYS = ["New Year’s Eve", "New Year’s Day", "Lunar New Year", "Valentine’s Day", "Mardi Gras", "St. Patrick’s Day", "Nowruz", "Easter", "Passover", "Eid al-Fitr", "Eid al-Adha", "Mother’s Day", "Memorial Day", "Father’s Day", "Juneteenth", "Independence Day", "Labor Day", "Rosh Hashanah", "Yom Kippur", "Halloween", "Día de los Muertos", "Diwali", "Thanksgiving", "Hanukkah", "Christmas", "Kwanzaa", "Winter Solstice", "Summer Solstice", "Other"] as const;
export const PARTY_THEMES = ["Winter Wonderland", "Autumn ONEderland", "Little Pumpkin", "Princess", "Dinosaurs", "Garden Party", "Woodland", "Under the Sea", "Space", "Safari", "Butterflies", "Tea Party", "Disco", "Western", "Tropical", "Monsters and Martinis"];
export function ordinalAge(age: number) {
  const mod100 = age % 100;
  return `${age}${mod100 >= 11 && mod100 <= 13 ? "th" : age % 10 === 1 ? "st" : age % 10 === 2 ? "nd" : age % 10 === 3 ? "rd" : "th"}`;
}
export function seasonFromMonth(month: number) {
  return month >= 3 && month <= 5 ? "Spring" : month >= 6 && month <= 8 ? "Summer" : month >= 9 && month <= 11 ? "Fall" : "Winter";
}
export function classificationTags({ category, month, age, audience, graduation, holiday }: { category: string; month: string; age: string; audience: string; graduation: string; holiday: string }) {
  const tags = [occasionTag(category), occasionTag(seasonFromMonth(Number(month)))];
  if (["Kids’ Birthday", "Birthday Celebration"].includes(category) && age) {
    tags.push(`age${age}`);
    if (category === "Kids’ Birthday") tags.push(Number(age) < 13 ? "child" : "teen");
    else tags.push("adult");
  }
  if (["Baby Shower", "Gender Reveal", "Kids’ Birthday", "Graduation", "Birthday Celebration"].includes(category) && audience && audience !== "Not specified") tags.push(`audience${occasionTag(audience)}`);
  if (category === "Graduation" && graduation) tags.push(`graduation${occasionTag(graduation)}`);
  if (holiday) tags.push(`holiday${occasionTag(holiday)}`);
  return tags.filter(Boolean);
}
export function validatePartyClassificationForm(form: FormData) {
  if (form.get("classificationVersion") !== "1") return null;
  const category = String(form.get("occasion") ?? "");
  if (!PARTY_OCCASIONS.includes(category)) return "Choose a party category.";
  if (!/^(0[1-9]|1[0-2])$/.test(String(form.get("eventMonth") ?? "")) || !/^\d{4}$/.test(String(form.get("eventYear") ?? "")) || Number(form.get("eventYear")) < 1900 || Number(form.get("eventYear")) > 2200) return "Choose the party month and year.";
  if (["Kids’ Birthday", "Birthday Celebration"].includes(category) && !/^(?:[1-9]|[1-9]\d|1[01]\d|120)$/.test(String(form.get("birthdayAge") ?? ""))) return "Enter the age being celebrated, from 1 to 120.";
  const audience = String(form.get("partyAudience") ?? "");
  if (audience && !(PARTY_AUDIENCES as readonly string[]).includes(audience)) return "Choose an audience from the list.";
  if (category === "Graduation" && !(GRADUATION_LEVELS as readonly string[]).includes(String(form.get("graduationLevel") ?? ""))) return "Choose a graduation level.";
  const holiday = String(form.get("partyHoliday") ?? "");
  if ((category === "Holiday Event" || holiday) && !(PARTY_HOLIDAYS as readonly string[]).includes(holiday)) return "Choose a holiday from the suggestions.";
  return null;
}
export function partyDiscoveryLabels(tags: string[], title: string, eventDate?: Date | string | null) {
  const category = inferPartyOccasion(tags, title);
  const labels = [category === "Birthday Celebration" ? "Adult Birthday" : category];
  const age = tags.find((tag) => /^age\d+$/.test(tag));
  if (age) labels.push(`${ordinalAge(Number(age.slice(3)))} Birthday`);
  const holiday = PARTY_HOLIDAYS.find((name) => tags.includes(`holiday${occasionTag(name)}`));
  if (holiday) labels.push(holiday);
  const season = ["Spring", "Summer", "Fall", "Winter"].find((name) => tags.includes(occasionTag(name)));
  if (season) labels.push(season);
  else if (eventDate) { const date = new Date(eventDate); if (Number.isFinite(date.getTime())) labels.push(seasonFromMonth(date.getUTCMonth() + 1)); }
  const audience = PARTY_AUDIENCES.find((name) => tags.includes(`audience${occasionTag(name)}`));
  if (audience) labels.push(audience);
  const graduation = GRADUATION_LEVELS.find((name) => tags.includes(`graduation${occasionTag(name)}`));
  if (graduation) labels.splice(1, 0, graduation);
  return labels.filter(Boolean);
}
export function partySearchTags(query: string) {
  const text = query.toLowerCase();
  const matches: string[] = [];
  for (const category of PARTY_OCCASIONS) if (text.includes(category.toLowerCase())) matches.push(occasionTag(category));
  if (text.includes("adult birthday")) matches.push(occasionTag("Birthday Celebration"));
  for (const name of ["Spring", "Summer", "Fall", "Winter"]) if (new RegExp(`\\b${name.toLowerCase()}\\b`).test(text)) matches.push(occasionTag(name));
  for (const [prefix, names] of [["holiday", PARTY_HOLIDAYS], ["graduation", GRADUATION_LEVELS], ["audience", PARTY_AUDIENCES]] as const) for (const name of names) if (name !== "Other" && name !== "Not specified" && text.includes(name.toLowerCase())) matches.push(`${prefix}${occasionTag(name)}`);
  const age = text.match(/\b(\d{1,3})(?:st|nd|rd|th)?\s+birthday\b/);
  if (age) matches.push(`age${Number(age[1])}`);
  for (const [word, value] of [["first",1],["second",2],["third",3],["fourth",4],["fifth",5]] as const) if (text.includes(`${word} birthday`)) matches.push(`age${value}`);
  return [...new Set(matches)];
}
