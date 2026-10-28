import { describe, expect, it } from "vitest";
import { classificationTags, ordinalAge, partyDiscoveryLabels, partySearchTags, validatePartyClassificationForm } from "@/lib/party-occasions";
const details = { category: "Birthday Celebration", month: "10", age: "27", audience: "Girl", graduation: "", holiday: "Halloween" };
describe("controlled party classification", () => {
  it("generates an exact adult birthday age without a milestone selector", () => {
    const tags = classificationTags(details);
    expect(tags).toEqual(["birthdaycelebration", "fall", "age27", "adult", "audiencegirl"]);
    expect(partyDiscoveryLabels(tags, "Monsters and Martinis")).toEqual(["Adult Birthday", "27th Birthday", "Fall", "Girl"]);
  });
  it.each([[1,"1st"],[2,"2nd"],[3,"3rd"],[11,"11th"],[12,"12th"],[13,"13th"],[21,"21st"],[27,"27th"]])("formats age %s", (age, expected) => expect(ordinalAge(Number(age))).toBe(expected));
  it("derives first birthday and winter without turning the creative theme into a discovery tag", () => {
    const tags = classificationTags({ ...details, category: "Kids’ Birthday", month: "12", age: "1", holiday: "" });
    expect(partyDiscoveryLabels(tags, "Autumn ONEderland")).toEqual(["Kids’ Birthday", "1st Birthday", "Winter", "Girl"]);
    expect(tags).not.toContain("autumnonederland");
  });
  it.each(["winter baby shower", "first birthday", "27th birthday", "Halloween birthday"])("searches readable structured labels: %s", (query) => expect(partySearchTags(query).length).toBeGreaterThan(0));
  it("requires category, month/year, and birthday age for the new composer", () => {
    const form = new FormData(); form.set("classificationVersion", "1");
    expect(validatePartyClassificationForm(form)).toContain("category");
    form.set("occasion", "Birthday Celebration");
    expect(validatePartyClassificationForm(form)).toContain("month and year");
    form.set("eventMonth", "10"); form.set("eventYear", "2026");
    expect(validatePartyClassificationForm(form)).toContain("age");
    form.set("birthdayAge", "27"); expect(validatePartyClassificationForm(form)).toBeNull();
    form.set("partyAudience", "random hashtag"); expect(validatePartyClassificationForm(form)).toContain("audience");
  });
  it("generates a holiday label only for Holiday Event", () => {
    expect(classificationTags({ ...details, category: "Kids’ Birthday" })).not.toContain("holidayhalloween");
    expect(classificationTags({ ...details, category: "Holiday Event" })).toContain("holidayhalloween");
  });
  it("preserves compatibility with older party clients", () => expect(validatePartyClassificationForm(new FormData())).toBeNull());
});
