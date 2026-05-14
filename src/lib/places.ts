export type PlaceSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText?: string;
  types: string[];
  source: "google" | "fallback";
};

export type PlaceDetails = {
  placeId: string;
  formattedAddress: string;
  city: string;
  state: string;
  zipCode?: string;
  lat: number;
  lng: number;
  name?: string;
  types: string[];
  source: "google" | "fallback";
};

const fallbackPlaces: PlaceDetails[] = [
  {
    placeId: "fallback-fairfield-ca",
    formattedAddress: "Fairfield, CA, USA",
    city: "Fairfield",
    state: "CA",
    lat: 38.2494,
    lng: -122.04,
    types: ["locality", "political"],
    source: "fallback"
  },
  {
    placeId: "fallback-vacaville-ca",
    formattedAddress: "Vacaville, CA, USA",
    city: "Vacaville",
    state: "CA",
    lat: 38.3566,
    lng: -121.9877,
    types: ["locality", "political"],
    source: "fallback"
  },
  {
    placeId: "fallback-vallejo-ca",
    formattedAddress: "Vallejo, CA, USA",
    city: "Vallejo",
    state: "CA",
    lat: 38.1041,
    lng: -122.2566,
    types: ["locality", "political"],
    source: "fallback"
  },
  {
    placeId: "fallback-benicia-ca",
    formattedAddress: "Benicia, CA, USA",
    city: "Benicia",
    state: "CA",
    lat: 38.0494,
    lng: -122.1586,
    types: ["locality", "political"],
    source: "fallback"
  },
  {
    placeId: "fallback-suisun-city-ca",
    formattedAddress: "Suisun City, CA, USA",
    city: "Suisun City",
    state: "CA",
    lat: 38.2382,
    lng: -122.0402,
    types: ["locality", "political"],
    source: "fallback"
  },
  {
    placeId: "fallback-backyard-garden-fairfield",
    formattedAddress: "Backyard Garden in Fairfield, CA, USA",
    city: "Fairfield",
    state: "CA",
    lat: 38.2494,
    lng: -122.04,
    name: "Backyard Garden in Fairfield",
    types: ["establishment", "point_of_interest"],
    source: "fallback"
  }
];

export function getGooglePlacesApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
}

export function getFallbackPlaceSuggestions(input: string): PlaceSuggestion[] {
  const query = normalizeSearch(input);
  const tokens = query.split(" ").filter(Boolean);

  return fallbackPlaces
    .filter((place) => {
      if (!tokens.length) return true;
      const haystack = normalizeSearch(`${place.name ?? ""} ${place.formattedAddress}`);
      return tokens.every((token) => haystack.includes(token));
    })
    .slice(0, 6)
    .map((place) => ({
      placeId: place.placeId,
      description: place.formattedAddress,
      mainText: place.name ?? place.city,
      secondaryText: place.name ? `${place.city}, ${place.state}` : place.state,
      types: place.types,
      source: "fallback"
    }));
}

export function getFallbackPlaceDetails(placeId: string) {
  return fallbackPlaces.find((place) => place.placeId === placeId) ?? null;
}

export function normalizeGoogleSuggestion(prediction: GoogleAutocompletePrediction): PlaceSuggestion {
  return {
    placeId: prediction.place_id,
    description: prediction.description,
    mainText: prediction.structured_formatting?.main_text ?? prediction.description,
    secondaryText: prediction.structured_formatting?.secondary_text,
    types: prediction.types ?? [],
    source: "google"
  };
}

export function normalizeGoogleDetails(result: GooglePlaceDetailsResult): PlaceDetails {
  const components = result.address_components ?? [];
  const city =
    findAddressComponent(components, "locality") ??
    findAddressComponent(components, "postal_town") ??
    findAddressComponent(components, "sublocality") ??
    findAddressComponent(components, "administrative_area_level_2") ??
    result.name ??
    "";
  const state = findAddressComponent(components, "administrative_area_level_1", "short_name") ?? "";
  const zipCode = findAddressComponent(components, "postal_code", "short_name");

  return {
    placeId: result.place_id,
    formattedAddress: result.formatted_address ?? result.name ?? "",
    city,
    state,
    zipCode,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    name: result.name,
    types: result.types ?? [],
    source: "google"
  };
}

function normalizeSearch(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function findAddressComponent(
  components: GoogleAddressComponent[],
  type: string,
  key: "long_name" | "short_name" = "long_name"
) {
  return components.find((component) => component.types.includes(type))?.[key];
}

type GoogleAutocompletePrediction = {
  description: string;
  place_id: string;
  structured_formatting?: {
    main_text?: string;
    secondary_text?: string;
  };
  types?: string[];
};

export type GoogleAutocompleteResponse = {
  predictions?: GoogleAutocompletePrediction[];
  status?: string;
  error_message?: string;
};

type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GooglePlaceDetailsResult = {
  address_components?: GoogleAddressComponent[];
  formatted_address?: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  name?: string;
  place_id: string;
  types?: string[];
};

export type GooglePlaceDetailsResponse = {
  result?: GooglePlaceDetailsResult;
  status?: string;
  error_message?: string;
};
