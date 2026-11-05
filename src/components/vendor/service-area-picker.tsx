"use client";

import { useEffect, useRef, useState } from "react";
import type { PlaceDetails } from "@/lib/places";
import { PlaceAutocompleteInput } from "@/components/location/place-autocomplete-input";

export function ServiceAreaPicker({ defaultValue, onAreasChange }: { defaultValue?: string | null; onAreasChange?: (areas:PlaceDetails[])=>void }) {
  // Keep previously saved comma-separated labels intact; new selections use semicolons.
  const [selected, setSelected] = useState<string[]>(() => (defaultValue ?? "").split(/[;\n]+/).map(area => area.trim()).filter(Boolean));
  const [searchKey, setSearchKey] = useState(0);
  const [locations,setLocations] = useState<Record<string,PlaceDetails>>({});
  const attempted = useRef(new Set<string>());
  useEffect(()=>{onAreasChange?.(selected.flatMap(label=>locations[label]?[locations[label]]:[]));},[selected,locations,onAreasChange]);
  useEffect(()=>{
    if(!onAreasChange)return;
    // Restore bubbles from saved area names without changing the saved selections.
    for(const label of selected) {
      if(locations[label]||attempted.current.has(label))continue;
      attempted.current.add(label);
      void (async()=>{
        try {
          const suggestionsResponse=await fetch(`/api/places/autocomplete?input=${encodeURIComponent(label)}&type=regions`);
          if(!suggestionsResponse.ok)return;
          const suggestions=await suggestionsResponse.json();
          const id=suggestions.suggestions?.[0]?.placeId;if(!id)return;
          const detailsResponse=await fetch(`/api/places/details?placeId=${encodeURIComponent(id)}`);
          if(!detailsResponse.ok)return;
          const details=await detailsResponse.json();
          if(details.place)setLocations(current=>({...current,[label]:details.place}));
        }catch{ /* Saved labels remain usable when a map lookup is unavailable. */ }
      })();
    }
  },[selected,locations,onAreasChange]);
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
          setLocations(current=>({...current,[place.formattedAddress]:place}));
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
