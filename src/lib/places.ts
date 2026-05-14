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
    placeId: prediction.placeId,
    description: prediction.text.text,
    mainText: prediction.structuredFormat?.mainText?.text ?? prediction.text.text,
    secondaryText: prediction.structuredFormat?.secondaryText?.text,
    types: prediction.types ?? [],
    source: "google"
  };
}

export function normalizeGoogleDetails(result: GooglePlaceDetailsResult): PlaceDetails {
  const components = result.addressComponents ?? [];
  const city =
    findAddressComponent(components, "locality") ??
    findAddressComponent(components, "postal_town") ??
    findAddressComponent(components, "sublocality") ??
    findAddressComponent(components, "administrative_area_level_2") ??
    result.displayName?.text ??
    "";
  const state = findAddressComponent(components, "administrative_area_level_1", "shortText") ?? "";
  const zipCode = findAddressComponent(components, "postal_code", "shortText");

  return {
    placeId: result.id,
    formattedAddress: result.formattedAddress ?? result.displayName?.text ?? "",
    city,
    state,
    zipCode,
    lat: result.location.latitude,
    lng: result.location.longitude,
    name: result.displayName?.text,
    types: result.types ?? [],
    source: "google"
  };
}

function findAddressComponent(
  components: GoogleAddressComponent[],
  type: string,
  key: "longText" | "shortText" = "longText"
) {
  return components.find((component) => component.types.includes(type))?.[key];
}

type GoogleAutocompletePrediction = {
  placeId: string;
  text: {
    text: string;
  };
  structuredFormat?: {
    mainText?: {
      text: string;
    };
    secondaryText?: {
      text: string;
    };
  };
  types?: string[];
};

export type GoogleAutocompleteResponse = {
  suggestions?: Array<{
    placePrediction?: GoogleAutocompletePrediction;
  }>;
  error?: {
    message?: string;
    status?: string;
  };
};

type GoogleAddressComponent = {
  longText: string;
  shortText: string;
  types: string[];
};

type GooglePlaceDetailsResult = {
  addressComponents?: GoogleAddressComponent[];
  displayName?: {
    text: string;
    languageCode?: string;
  };
  formattedAddress?: string;
  id: string;
  location: {
    latitude: number;
    longitude: number;
  };
  types?: string[];
};

export type GooglePlaceDetailsResponse = GooglePlaceDetailsResult & {
  error?: {
    message?: string;
    status?: string;
  };
};
