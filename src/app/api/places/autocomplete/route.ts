import { NextResponse } from "next/server";
import {
  getFallbackPlaceSuggestions,
  getGooglePlacesApiKey,
  normalizeGoogleSuggestion,
  type GoogleAutocompleteResponse
} from "@/lib/places";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = (url.searchParams.get("input") ?? url.searchParams.get("q") ?? "").trim();

  if (input.length < 2) {
    return NextResponse.json({ suggestions: getFallbackPlaceSuggestions(input) });
  }

  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return NextResponse.json({ suggestions: getFallbackPlaceSuggestions(input), source: "fallback" });
  }

  const params = new URLSearchParams({
    input,
    key: apiKey,
    components: "country:us"
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
    { next: { revalidate: 60 * 60 * 24 } }
  );
  const data = (await response.json()) as GoogleAutocompleteResponse;

  if (!response.ok || data.status === "REQUEST_DENIED") {
    console.error("[places] autocomplete failed", {
      status: data.status,
      error: data.error_message
    });
    return NextResponse.json({ suggestions: getFallbackPlaceSuggestions(input), source: "fallback" });
  }

  const suggestions = (data.predictions ?? []).slice(0, 8).map(normalizeGoogleSuggestion);
  return NextResponse.json({
    suggestions: suggestions.length ? suggestions : getFallbackPlaceSuggestions(input),
    source: suggestions.length ? "google" : "fallback"
  });
}
