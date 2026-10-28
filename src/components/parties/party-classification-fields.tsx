"use client";
import { PARTY_OCCASIONS, PARTY_AUDIENCES, GRADUATION_LEVELS, PARTY_HOLIDAYS, PARTY_THEMES, occasionTag } from "@/lib/party-occasions";
import { Input } from "@/components/ui/input";
const selectClass = "h-12 min-w-0 w-full rounded-2xl border bg-white px-3 text-sm";
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function PartyClassificationFields({ category, onCategoryChange, tags, eventDate, theme }: { category: string; onCategoryChange: (value: string) => void; tags: string[]; eventDate?: Date | string | null; theme?: string | null }) {
  const date = eventDate ? new Date(eventDate) : null;
  const validDate = date && Number.isFinite(date.getTime()) ? date : null;
  const age = tags.find((tag) => /^age\d+$/.test(tag))?.slice(3) ?? "";
  const audience = PARTY_AUDIENCES.find((name) => tags.includes(`audience${occasionTag(name)}`)) ?? "Not specified";
  const graduation = GRADUATION_LEVELS.find((name) => tags.includes(`graduation${occasionTag(name)}`)) ?? "";
  const holiday = PARTY_HOLIDAYS.find((name) => tags.includes(`holiday${occasionTag(name)}`)) ?? "";
  return <div className="grid min-w-0 gap-4">
    <input type="hidden" name="classificationVersion" value="1" />
    <label className="grid gap-2 text-sm font-medium">Party category · Required<select name="occasion" value={category} onChange={(event) => onCategoryChange(event.target.value)} required className={selectClass}><option value="">Choose a category</option>{PARTY_OCCASIONS.map((name) => <option key={name} value={name}>{name === "Birthday Celebration" ? "Adult Birthday" : name}</option>)}</select></label>
    <fieldset className="grid grid-cols-2 gap-3"><legend className="mb-2 text-sm font-medium">Party month and year · Required</legend>
      <label className="grid gap-1 text-sm">Month<select name="eventMonth" aria-label="Party month" required defaultValue={validDate ? String(validDate.getUTCMonth() + 1).padStart(2, "0") : ""} className={selectClass}><option value="">Month</option>{months.map((name, i) => <option key={name} value={String(i + 1).padStart(2, "0")}>{name}</option>)}</select></label>
      <label className="grid gap-1 text-sm">Year<select name="eventYear" aria-label="Party year" required defaultValue={validDate?.getUTCFullYear() ?? new Date().getFullYear()} className={selectClass}><option value="">Year</option>{Array.from({ length: new Date().getFullYear() - 1894 }, (_, i) => new Date().getFullYear() + 5 - i).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
    </fieldset>
    {["Kids’ Birthday", "Birthday Celebration"].includes(category) ? <label key={category} className="grid gap-2 text-sm font-medium">Age being celebrated · Required<Input name="birthdayAge" type="number" min={1} max={120} step={1} required defaultValue={age} placeholder={category === "Kids’ Birthday" ? "e.g. 1" : "e.g. 27"} /></label> : null}
    {["Baby Shower", "Gender Reveal", "Kids’ Birthday", "Birthday Celebration", "Graduation"].includes(category) ? <label className="grid gap-2 text-sm font-medium">{category === "Baby Shower" || category === "Gender Reveal" ? "Celebrating" : "Party audience"}<select name="partyAudience" defaultValue={audience} className={selectClass}>{PARTY_AUDIENCES.map((name) => <option key={name}>{name}</option>)}</select></label> : null}
    {category === "Graduation" ? <label className="grid gap-2 text-sm font-medium">Graduation level · Required<select name="graduationLevel" required defaultValue={graduation} className={selectClass}><option value="">Choose a level</option>{GRADUATION_LEVELS.map((name) => <option key={name}>{name}</option>)}</select></label> : null}
    <label className="grid gap-2 text-sm font-medium">Holiday {category === "Holiday Event" ? "· Required" : "(optional)"}<Input name="partyHoliday" list="party-holiday-options" defaultValue={holiday} required={category === "Holiday Event"} placeholder="Search and select a holiday" autoComplete="off" /><datalist id="party-holiday-options">{PARTY_HOLIDAYS.map((name) => <option key={name} value={name} />)}</datalist></label>
    <label className="grid gap-2 text-sm font-medium">Party theme (optional)<Input name="theme" list="party-theme-options" defaultValue={theme ?? ""} maxLength={100} placeholder="Search themes or enter your theme" /><datalist id="party-theme-options">{PARTY_THEMES.map((name) => <option key={name} value={name} />)}</datalist><span className="text-xs font-normal text-muted-foreground">Your theme appears inside the party. Discovery labels come from the selections above.</span></label>
  </div>;
}
