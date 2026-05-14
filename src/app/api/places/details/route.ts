import { NextResponse } from "next/server";
import {
  getGooglePlacesApiKey,
  normalizeGoogleDetails,
  type GooglePlaceDetailsResponse
} from "@/lib/places";

const GOOGLE_PLACES_TIMEOUT_MS = 4500;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const placeId = (url.searchParams.get("placeId") ?? "").trim();

  if (!placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }

  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: "Location search needs a Google Places API key to select this place." },
      { status: 503 }
    );
  }

  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`,
      {
        headers: {
          "X-Goog-Api-Key": apiKey,
          "X-Goog-FieldMask": [
            "id",
            "formattedAddress",
            "location",
            "addressComponents",
            "displayName",
            "types"
          ].join(",")
        },
        next: { revalidate: 60 * 60 * 24 * 14 },
        signal: AbortSignal.timeout(GOOGLE_PLACES_TIMEOUT_MS)
      }
    );
    const data = (await response.json()) as GooglePlaceDetailsResponse;

    if (!response.ok || data.error || !data.id || !data.location) {
      console.error("[places] details failed", {
        placeId,
        status: data.error?.status,
        error: data.error?.message
      });
      return NextResponse.json(
        { error: data.error?.message ?? "Place details could not be loaded." },
        { status: 502 }
      );
    }

    return NextResponse.json({ place: normalizeGoogleDetails(data), source: "google" });
  } catch (error) {
    console.error("[places] details request failed", { placeId, error });
    return NextResponse.json(
      { error: "Place details timed out. Please try again." },
      { status: 504 }
    );
  }
}
