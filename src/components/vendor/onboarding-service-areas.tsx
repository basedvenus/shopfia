"use client";
import { useState } from "react";
import { PlaceAutocompleteInput } from "@/components/location/place-autocomplete-input";
import { ServiceRadiusMap } from "@/components/location/service-radius-map";
import type { PlaceDetails } from "@/lib/places";

type Location = { city?: string; state?: string | null; zipCode?: string | null; formattedAddress?: string | null; googlePlaceId?: string | null; locationLat?: number | null; locationLng?: number | null; serviceRadiusMiles?: number; serviceAreaNotes?: string | null };
export function OnboardingServiceAreas({ business }: { business?: Location | null }) {
  const [place, setPlace] = useState<Partial<PlaceDetails>>({city:business?.city, state:business?.state ?? undefined, zipCode:business?.zipCode ?? undefined, formattedAddress:business?.formattedAddress ?? [business?.city,business?.state].filter(Boolean).join(", "), placeId:business?.googlePlaceId ?? undefined, lat:business?.locationLat ?? undefined, lng:business?.locationLng ?? undefined});
  const [radius, setRadius] = useState(business?.serviceRadiusMiles ?? 25);
  return <div className="grid gap-4 md:col-span-2">
    <PlaceAutocompleteInput label="City" placeholder="Type your city" searchType="cities" required requireSelection syncAddressFields defaultValue={place.formattedAddress} defaultPlace={place} fieldNames={{input:"formattedAddress", city:"locationCity", state:"locationState", zipCode:"locationZipCode", lat:"locationLat", lng:"locationLng", placeId:"googlePlaceId"}} onPlaceSelect={setPlace} onInputChange={() => setPlace({})} />
    <section className="grid gap-3" aria-label="Service Areas">
      <h2 className="text-sm font-medium">Service Areas</h2>
      {place.lat != null && place.lng != null ? <ServiceRadiusMap key={`${place.lat}:${place.lng}`} lat={place.lat} lng={place.lng} radius={radius} onChange={setRadius} /> : <p className="rounded-2xl border bg-muted/40 p-5 text-sm text-muted-foreground">Choose your city to see the map and adjust the area you serve.</p>}
      <label className="grid gap-2 text-sm">Coverage: {radius} miles<input type="range" aria-label="Service area radius" min={1} max={200} value={radius} onChange={event => setRadius(Number(event.target.value))} className="w-full accent-[#c74d7f]" /></label>
      <input type="hidden" name="serviceRadiusMiles" value={radius} />
      <input type="hidden" name="serviceAreaNotes" value={business?.serviceAreaNotes ?? ""} />
    </section>
  </div>;
}
