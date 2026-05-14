export type PlaceSuggestion = {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText?: string;
  types: string[];
  source: "google";
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
  source: "google";
};

export function getGooglePlacesApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
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
