"use client";
import { useState } from "react";
import { PARTY_OCCASIONS, PARTY_AUDIENCES, GRADUATION_LEVELS, PARTY_HOLIDAYS, occasionTag } from "@/lib/party-occasions";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
type Choice = { value: string; label: string };
function ClassificationSelect({ name, label, options, value, defaultValue, onChange, required, placeholder = "Choose an option" }: { name: string; label: string; options: Choice[]; value?: string; defaultValue?: string; onChange?: (value: string) => void; required?: boolean; placeholder?: string }) {
  const [selected, setSelected] = useState(defaultValue ?? "");
  return <Select name={name} value={value ?? selected} onValueChange={onChange ?? setSelected} required={required}>
    <SelectTrigger aria-label={label} className="h-12 min-w-0 bg-white text-left"><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent position="popper" sideOffset={5} className="z-[100] max-h-64 w-[var(--radix-select-trigger-width)] overflow-y-auto border-[#eadbd7] bg-white text-[#382d2d]">
      {options.map((option) => <SelectItem key={option.value} value={option.value} className="data-[highlighted]:bg-[#fff0eb] data-[state=checked]:bg-[#fff7f4]">{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}
function HolidayField({ initial }: { initial: string }) {
  const [query, setQuery] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = PARTY_HOLIDAYS.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  const choose = (name: string) => { setQuery(name); setOpen(false); setActive(0); };
  return <div className="relative grid gap-2" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor="party-holiday" className="text-sm font-medium">Holiday · Required</label>
    <Input id="party-holiday" name="partyHoliday" role="combobox" aria-expanded={open} aria-controls="party-holiday-options" aria-autocomplete="list" aria-activedescendant={open && matches[active] ? `party-holiday-${active}` : undefined} value={query} required autoComplete="off" placeholder="Search and select a holiday" onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setOpen(true); setActive(0); }} onKeyDown={(event) => {
      if (event.key === "Escape") setOpen(false);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActive((index) => Math.max(0, Math.min(matches.length - 1, index + (event.key === "ArrowDown" ? 1 : -1)))); }
      if (event.key === "Enter" && open) { event.preventDefault(); if (matches[active]) choose(matches[active]); }
    }} />
    {open ? <div id="party-holiday-options" role="listbox" className="absolute left-0 right-0 top-full z-40 mt-1 max-h-60 overflow-y-auto rounded-2xl border border-[#eadbd7] bg-white p-1 shadow-soft">{matches.length ? matches.map((name, i) => <button key={name} id={`party-holiday-${i}`} type="button" role="option" aria-selected={i === active} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(name)} className={`block w-full rounded-xl px-3 py-2 text-left text-sm hover:bg-[#fff0eb] ${i === active ? "bg-[#fff7f4]" : ""}`}>{name}</button>) : <p className="p-3 text-sm text-muted-foreground">No matching holidays. Select Other if yours isn’t listed.</p>}</div> : null}
  </div>;
}
const choices = (names: readonly string[]) => names.map((name) => ({ value: name, label: name }));
export function PartyClassificationFields({ category, onCategoryChange, tags, eventDate, theme }: { category: string; onCategoryChange: (value: string) => void; tags: string[]; eventDate?: Date | string | null; theme?: string | null }) {
  const date = eventDate ? new Date(eventDate) : null;
  const validDate = date && Number.isFinite(date.getTime()) ? date : null;
  const age = tags.find((tag) => /^age\d+$/.test(tag))?.slice(3) ?? "";
  const audience = PARTY_AUDIENCES.find((name) => tags.includes(`audience${occasionTag(name)}`)) ?? "Not specified";
  const graduation = GRADUATION_LEVELS.find((name) => tags.includes(`graduation${occasionTag(name)}`)) ?? "";
  const holiday = PARTY_HOLIDAYS.find((name) => tags.includes(`holiday${occasionTag(name)}`)) ?? "";
  return <div className="grid min-w-0 gap-4">
    <input type="hidden" name="classificationVersion" value="1" />
    <label className="grid gap-2 text-sm font-medium">Party category · Required<ClassificationSelect name="occasion" label="Party category" value={category} onChange={onCategoryChange} required placeholder="Choose a category" options={PARTY_OCCASIONS.map((name) => ({ value: name, label: name === "Birthday Celebration" ? "Adult Birthday" : name }))} /></label>
    <fieldset className="grid grid-cols-2 gap-3"><legend className="mb-2 text-sm font-medium">Party month and year · Required</legend>
      <label className="grid gap-1 text-sm">Month<ClassificationSelect name="eventMonth" label="Party month" required defaultValue={validDate ? String(validDate.getUTCMonth() + 1).padStart(2, "0") : ""} placeholder="Month" options={months.map((name, i) => ({ value: String(i + 1).padStart(2, "0"), label: name }))} /></label>
      <label className="grid gap-1 text-sm">Year<ClassificationSelect name="eventYear" label="Party year" required defaultValue={String(validDate?.getUTCFullYear() ?? new Date().getFullYear())} placeholder="Year" options={Array.from({ length: new Date().getFullYear() - 1894 }, (_, i) => { const year = String(new Date().getFullYear() + 5 - i); return { value: year, label: year }; })} /></label>
    </fieldset>
    {["Kids’ Birthday", "Birthday Celebration"].includes(category) ? <label key={category} className="grid gap-2 text-sm font-medium">Age being celebrated · Required<Input name="birthdayAge" type="number" min={1} max={120} step={1} required defaultValue={age} placeholder={category === "Kids’ Birthday" ? "e.g. 1" : "e.g. 27"} /></label> : null}
    {["Baby Shower", "Gender Reveal", "Kids’ Birthday", "Birthday Celebration", "Graduation"].includes(category) ? <label className="grid gap-2 text-sm font-medium">{category === "Kids’ Birthday" || category === "Birthday Celebration" ? "Birthday for" : "Celebrating"}<ClassificationSelect name="partyAudience" label={category.includes("Birthday") ? "Birthday for" : "Celebrating"} defaultValue={audience} options={choices(PARTY_AUDIENCES)} /></label> : null}
    {category === "Graduation" ? <label className="grid gap-2 text-sm font-medium">Graduation level · Required<ClassificationSelect name="graduationLevel" label="Graduation level" required defaultValue={graduation} placeholder="Choose a level" options={choices(GRADUATION_LEVELS)} /></label> : null}
    {category === "Holiday Event" ? <HolidayField initial={holiday} /> : null}
    <label className="grid gap-2 text-sm font-medium">Party theme (optional)<Input name="theme" defaultValue={theme ?? ""} maxLength={100} placeholder="e.g. Rainbow, Sports, Little Pumpkin…" /><span className="text-xs font-normal text-muted-foreground">Enter any theme to help people find your party.</span></label>
  </div>;
}
