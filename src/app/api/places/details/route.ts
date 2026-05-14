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

  const params = new URLSearchParams({
    place_id: placeId,
    fields: "place_id,formatted_address,geometry,address_component,name,types",
    key: apiKey
  });

  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
      {
        next: { revalidate: 60 * 60 * 24 * 14 },
        signal: AbortSignal.timeout(GOOGLE_PLACES_TIMEOUT_MS)
      }
    );
    const data = (await response.json()) as GooglePlaceDetailsResponse;

    if (!response.ok || data.status !== "OK" || !data.result) {
      console.error("[places] details failed", {
        placeId,
        status: data.status,
        error: data.error_message
      });
      return NextResponse.json(
        { error: data.error_message ?? "Place details could not be loaded." },
        { status: 502 }
      );
    }

    return NextResponse.json({ place: normalizeGoogleDetails(data.result), source: "google" });
  } catch (error) {
    console.error("[places] details request failed", { placeId, error });
    return NextResponse.json(
      { error: "Place details timed out. Please try again." },
      { status: 504 }
    );
  }
}
