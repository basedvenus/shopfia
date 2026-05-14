"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { PlaceDetails, PlaceSuggestion } from "@/lib/places";

type LocationFieldNames = {
  input: string;
  formattedAddress?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  lat?: string;
  lng?: string;
  placeId?: string;
  label?: string;
};

type PlaceAutocompleteInputProps = {
  className?: string;
  defaultPlace?: Partial<PlaceDetails> | null;
  defaultValue?: string;
  fieldNames: LocationFieldNames;
  helperText?: string;
  label?: string;
  placeholder?: string;
  required?: boolean;
};

const defaultHiddenFieldNames = {
  formattedAddress: "formattedAddress",
  city: "locationCity",
  state: "locationState",
  zipCode: "locationZipCode",
  lat: "locationLat",
  lng: "locationLng",
  placeId: "googlePlaceId",
  label: "locationLabel"
};

export function PlaceAutocompleteInput({
  className,
  defaultPlace,
  defaultValue,
  fieldNames,
  helperText,
  label,
  placeholder = "Search vendors, venues, or locations",
  required
}: PlaceAutocompleteInputProps) {
  const hiddenFieldNames = { ...defaultHiddenFieldNames, ...fieldNames };
  const initialValue = defaultValue ?? defaultPlace?.formattedAddress ?? "";
  const [inputValue, setInputValue] = useState(initialValue);
  const [selectedPlace, setSelectedPlace] = useState<Partial<PlaceDetails> | null>(
    defaultPlace ?? (initialValue ? { formattedAddress: initialValue } : null)
  );
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  useEffect(() => {
    const query = inputValue.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    if (selectedPlace?.formattedAddress === query) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    let ignore = false;
    const timeout = window.setTimeout(async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(query)}`);
        const data = (await response.json()) as { suggestions?: PlaceSuggestion[] };
        if (!ignore) {
          setSuggestions(data.suggestions ?? []);
          setIsOpen(true);
        }
      } catch (error) {
        console.error("[places] client autocomplete failed", error);
        if (!ignore) setSuggestions([]);
      } finally {
        if (!ignore) setIsLoading(false);
      }
    }, 180);

    return () => {
      ignore = true;
      window.clearTimeout(timeout);
    };
  }, [inputValue, selectedPlace?.formattedAddress]);

  async function selectSuggestion(suggestion: PlaceSuggestion) {
    setInputValue(suggestion.description);
    setIsOpen(false);
    setSuggestions([]);
    setIsLoading(true);

    try {
      const response = await fetch(`/api/places/details?placeId=${encodeURIComponent(suggestion.placeId)}`);
      const data = (await response.json()) as { place?: PlaceDetails };
      const place = data.place;
      if (place) {
        setSelectedPlace(place);
        setInputValue(place.formattedAddress);
      } else {
        setSelectedPlace({
          formattedAddress: suggestion.description,
          placeId: suggestion.placeId,
          types: suggestion.types
        });
      }
    } catch (error) {
      console.error("[places] client details failed", error);
      setSelectedPlace({
        formattedAddress: suggestion.description,
        placeId: suggestion.placeId,
        types: suggestion.types
      });
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div ref={containerRef} className={className}>
      {label ? (
        <label className="mb-1 block text-sm font-medium">
          {label}
          {required ? <span className="text-destructive"> *</span> : null}
        </label>
      ) : null}
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          name={fieldNames.input}
          value={inputValue}
          required={required}
          autoComplete="off"
          placeholder={placeholder}
          className="pl-9 pr-9"
          onChange={(event) => {
            const nextValue = event.target.value;
            setInputValue(nextValue);
            setSelectedPlace(null);
            setIsOpen(true);
          }}
          onFocus={() => {
            if (suggestions.length > 0) setIsOpen(true);
          }}
        />
        {isLoading ? (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : null}
        {isOpen && suggestions.length > 0 ? (
          <div className="absolute left-0 right-0 top-[calc(100%+0.45rem)] z-50 overflow-hidden rounded-[1.2rem] border bg-white shadow-soft">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.placeId}
                type="button"
                onClick={() => void selectSuggestion(suggestion)}
                className="flex w-full gap-3 px-4 py-3 text-left transition hover:bg-primary/5"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{suggestion.mainText}</span>
                  {suggestion.secondaryText ? (
                    <span className="block truncate text-xs text-muted-foreground">
                      {suggestion.secondaryText}
                    </span>
                  ) : null}
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {helperText ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{helperText}</p> : null}
      <input type="hidden" name={hiddenFieldNames.formattedAddress} value={selectedPlace?.formattedAddress ?? ""} />
      <input type="hidden" name={hiddenFieldNames.city} value={selectedPlace?.city ?? ""} />
      <input type="hidden" name={hiddenFieldNames.state} value={selectedPlace?.state ?? ""} />
      <input type="hidden" name={hiddenFieldNames.zipCode} value={selectedPlace?.zipCode ?? ""} />
      <input type="hidden" name={hiddenFieldNames.lat} value={selectedPlace?.lat ?? ""} />
      <input type="hidden" name={hiddenFieldNames.lng} value={selectedPlace?.lng ?? ""} />
      <input type="hidden" name={hiddenFieldNames.placeId} value={selectedPlace?.placeId ?? ""} />
      <input type="hidden" name={hiddenFieldNames.label} value={selectedPlace?.formattedAddress ?? inputValue} />
    </div>
  );
}
