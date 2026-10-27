"use client";
import { useState } from "react";
import { COUNTY_STATES, US_COUNTIES, getCounty } from "@/lib/party-location";
export function CountySelector({ initialFips, required = false, stateName = "countyState", countyName = "countyFips" }: { initialFips?: string | null; required?: boolean; stateName?: string; countyName?: string }) {
  const [state, setState] = useState(getCounty(initialFips)?.state ?? "");
  const [county, setCounty] = useState(initialFips ?? "");
  return <div className="grid min-w-0 gap-3 sm:grid-cols-2">
    <label className="grid min-w-0 gap-2 text-sm font-medium">State<select name={stateName} aria-label="County state" required={required} value={state} onChange={(event) => { setState(event.target.value); setCounty(""); }} className="h-12 min-w-0 rounded-2xl border bg-white px-3"><option value="">Choose state</option>{COUNTY_STATES.map((code) => <option key={code} value={code}>{code}</option>)}</select></label>
    <label className="grid min-w-0 gap-2 text-sm font-medium">County{required ? " (required)" : ""}<select name={countyName} aria-label="County" required={required} disabled={!state} value={county} onChange={(event) => setCounty(event.target.value)} className="h-12 min-w-0 rounded-2xl border bg-white px-3"><option value="">Choose county</option>{US_COUNTIES.filter((item) => item.state === state).sort((a,b) => a.name.localeCompare(b.name)).map((item) => <option key={item.fips} value={item.fips}>{item.name}</option>)}</select></label>
  </div>;
}
