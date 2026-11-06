"use client";
import { useState } from "react";
import { PARTY_OCCASIONS, PARTY_AUDIENCES, GRADUATION_LEVELS, PARTY_HOLIDAYS, occasionTag } from "@/lib/party-occasions";
import { Input } from "@/components/ui/input";
import { PartySelect as ClassificationSelect } from "@/components/parties/party-select";
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
function HolidayField({ initial }: { initial: string }) {
  const [query, setQuery] = useState(initial);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const matches = PARTY_HOLIDAYS.filter((name) => name.toLowerCase().includes(query.toLowerCase()));
  const choose = (name: string) => { setQuery(name); setOpen(false); setActive(0); };
  return <div className="relative grid gap-2" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
    <label htmlFor="party-holiday" className="text-sm font-medium">Holiday <span className="text-[#a34d65]" aria-hidden="true">*</span><span className="sr-only"> (required)</span></label>
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
    <label className="grid gap-2 rounded-2xl border bg-white p-4 text-sm font-medium">Party theme (optional)<Input className="h-12 rounded-xl" name="theme" defaultValue={theme ?? ""} maxLength={100} placeholder="e.g. Rainbow, Sports, Little Pumpkin…" /><span className="text-xs font-normal text-muted-foreground">Enter any theme to help people find your party.</span></label>
    <section aria-label="Party category and celebration" className="space-y-4 rounded-2xl border bg-white p-4">
      <label className="grid gap-2 text-sm font-medium"><span>Party category <span className="text-[#a34d65]" aria-hidden="true">*</span><span className="sr-only"> (required)</span></span><ClassificationSelect name="occasion" label="Party category" value={category} onChange={onCategoryChange} required placeholder="Choose a category" options={PARTY_OCCASIONS.map((name) => ({ value: name, label: name === "Birthday Celebration" ? "Adult Birthday" : name }))} /></label>
      {["Kids’ Birthday", "Birthday Celebration"].includes(category) ? <label className="flex items-center gap-3 text-sm font-medium">Age <span className="text-[#a34d65]" aria-hidden="true">*</span>
        <ClassificationSelect key={category} name="birthdayAge" label="Age being celebrated" required defaultValue={age} compact placeholder="Age" options={Array.from({length: 120}, (_, index) => ({value: String(index + 1), label: String(index + 1)}))} />
      </label> : null}
      {["Baby Shower", "Gender Reveal", "Kids’ Birthday", "Birthday Celebration", "Graduation"].includes(category) ? <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Gender</legend><div className="flex flex-wrap gap-x-4 gap-y-2">
        {(audience === "Mixed group" ? ["Boy", "Girl", "Not specified", "Mixed group"] : ["Boy", "Girl", "Not specified"]).map((value) => <label key={value} className="flex cursor-pointer items-center gap-2 text-sm"><input type="radio" name="partyAudience" value={value} defaultChecked={audience === value} className="h-4 w-4 accent-[#a34d65]" />{value}</label>)}
      </div></fieldset> : null}
    </section>
    <fieldset className="grid grid-cols-2 gap-3 rounded-2xl border bg-white p-4"><legend className="px-1 text-sm font-medium">Party month and year <span className="text-[#a34d65]" aria-hidden="true">*</span><span className="sr-only"> (required)</span></legend>
      <label className="grid gap-1 text-sm">Month<ClassificationSelect name="eventMonth" label="Party month" required defaultValue={validDate ? String(validDate.getUTCMonth() + 1).padStart(2, "0") : ""} placeholder="Month" options={months.map((name, i) => ({ value: String(i + 1).padStart(2, "0"), label: name }))} /></label>
      <label className="grid gap-1 text-sm">Year<ClassificationSelect name="eventYear" label="Party year" required defaultValue={String(validDate?.getUTCFullYear() ?? new Date().getFullYear())} placeholder="Year" options={Array.from({ length: new Date().getFullYear() - 1894 }, (_, i) => { const year = String(new Date().getFullYear() + 5 - i); return { value: year, label: year }; })} /></label>
    </fieldset>
    {category === "Graduation" ? <label className="grid gap-2 text-sm font-medium"><span>Graduation level <span className="text-[#a34d65]" aria-hidden="true">*</span><span className="sr-only"> (required)</span></span><ClassificationSelect name="graduationLevel" label="Graduation level" required defaultValue={graduation} placeholder="Choose a level" options={choices(GRADUATION_LEVELS)} /></label> : null}
    {category === "Holiday Event" ? <HolidayField initial={holiday} /> : null}

  </div>;
}
