import { NextResponse } from "next/server";
import {
  getGooglePlacesApiKey,
  normalizeGoogleSuggestion,
  type GoogleAutocompleteResponse
} from "@/lib/places";
import { enforceRequestRateLimit } from "@/lib/security/request";
import { securityLog } from "@/lib/security/audit-log";

const GOOGLE_PLACES_TIMEOUT_MS = 4500;

export async function GET(request: Request) {
  const limited = enforceRequestRateLimit(request, [
    { key: "places-autocomplete:ip:{ip}", limit: 60, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const url = new URL(request.url);
  const input = (url.searchParams.get("input") ?? url.searchParams.get("q") ?? "").trim();

  if (input.length < 2) {
    return NextResponse.json({ suggestions: [], source: "google" });
  }

  if (input.length > 120) {
    return NextResponse.json({ error: "Search is too long.", suggestions: [] }, { status: 400 });
  }

  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Location search needs a Google Places API key to show suggestions.", suggestions: [] },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": [
            "suggestions.placePrediction.placeId",
            "suggestions.placePrediction.text",
            "suggestions.placePrediction.structuredFormat",
            "suggestions.placePrediction.types"
          ].join(",")
        },
        body: JSON.stringify({
          input,
          includedRegionCodes: ["us"],
          includeQueryPredictions: false,
          languageCode: "en"
        }),
        next: { revalidate: 60 * 60 * 24 },
        signal: AbortSignal.timeout(GOOGLE_PLACES_TIMEOUT_MS)
      }
    );
    const data = (await response.json()) as GoogleAutocompleteResponse;

    if (!response.ok || data.error) {
      securityLog("places_autocomplete_failed", {
        status: data.error?.status,
        error: data.error?.message
      });
      return NextResponse.json(
        { error: data.error?.message ?? "Location suggestions could not be loaded.", suggestions: [] },
        { status: 502 }
      );
    }

    return NextResponse.json({
      suggestions: (data.suggestions ?? [])
        .map((suggestion) => suggestion.placePrediction)
        .filter((prediction): prediction is NonNullable<typeof prediction> => Boolean(prediction))
        .slice(0, 8)
        .map(normalizeGoogleSuggestion),
      source: "google"
    });
  } catch (error) {
    securityLog("places_autocomplete_request_failed", {
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      { error: "Location suggestions timed out. Please try again.", suggestions: [] },
      { status: 504 }
    );
  }
}
