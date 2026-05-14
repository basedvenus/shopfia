import { NextResponse } from "next/server";
import {
  getGooglePlacesApiKey,
  normalizeGoogleSuggestion,
  type GoogleAutocompleteResponse
} from "@/lib/places";

const GOOGLE_PLACES_TIMEOUT_MS = 4500;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const input = (url.searchParams.get("input") ?? url.searchParams.get("q") ?? "").trim();

  if (input.length < 2) {
    return NextResponse.json({ suggestions: [], source: "google" });
  }

  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Google Places is not configured.", suggestions: [] },
      { status: 503 }
    );
  }

  const params = new URLSearchParams({
    input,
    key: apiKey,
    components: "country:us",
    language: "en"
  });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params.toString()}`,
      {
        next: { revalidate: 60 * 60 * 24 },
        signal: AbortSignal.timeout(GOOGLE_PLACES_TIMEOUT_MS)
      }
    );
    const data = (await response.json()) as GoogleAutocompleteResponse;

    if (!response.ok || !["OK", "ZERO_RESULTS"].includes(data.status ?? "")) {
      console.error("[places] autocomplete failed", {
        status: data.status,
        error: data.error_message
      });
      return NextResponse.json(
        { error: data.error_message ?? "Location suggestions could not be loaded.", suggestions: [] },
        { status: 502 }
      );
    }

    return NextResponse.json({
      suggestions: (data.predictions ?? []).slice(0, 8).map(normalizeGoogleSuggestion),
      source: "google"
    });
  } catch (error) {
    console.error("[places] autocomplete request failed", error);
    return NextResponse.json(
      { error: "Location suggestions timed out. Please try again.", suggestions: [] },
      { status: 504 }
    );
  }
}
