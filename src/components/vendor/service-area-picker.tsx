"use client";

import { useState } from "react";
import { PlaceAutocompleteInput } from "@/components/location/place-autocomplete-input";

export function ServiceAreaPicker({ defaultValue }: { defaultValue?: string | null }) {
  // Keep previously saved comma-separated labels intact; new selections use semicolons.
  const [selected, setSelected] = useState<string[]>(() => (defaultValue ?? "").split(/[;\n]+/).map(area => area.trim()).filter(Boolean));
  const [searchKey, setSearchKey] = useState(0);
  return (
    <div className="grid gap-2">
      <PlaceAutocompleteInput
        key={searchKey}
        label="Service areas (optional)"
        placeholder="Search for a city or region"
        helperText="Select each city or region you serve. You can add more than one."
        searchType="regions"
        omitHiddenFields
        fieldNames={{input:"serviceAreaSearch"}}
        onPlaceSelect={(place) => {
          setSelected(current => current.includes(place.formattedAddress) ? current : [...current, place.formattedAddress]);
          setSearchKey(current => current + 1);
        }}
      />
      <div className="flex flex-wrap gap-2">
        {selected.map(area => (
          <span key={area} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs">
            {area}
            <button type="button" aria-label={`Remove ${area}`} className="text-muted-foreground hover:text-foreground" onClick={() => setSelected(current => current.filter(item => item !== area))}>×</button>
          </span>
        ))}
      </div>
      <input type="hidden" name="serviceAreaNotes" value={selected.join("; ")} />
    </div>
  );
}
