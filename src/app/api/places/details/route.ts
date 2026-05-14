import { NextResponse } from "next/server";
import {
  getFallbackPlaceDetails,
  getGooglePlacesApiKey,
  normalizeGoogleDetails,
  type GooglePlaceDetailsResponse
} from "@/lib/places";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const placeId = (url.searchParams.get("placeId") ?? "").trim();

  if (!placeId) {
    return NextResponse.json({ error: "placeId is required" }, { status: 400 });
  }

  const fallback = getFallbackPlaceDetails(placeId);
  if (fallback) {
    return NextResponse.json({ place: fallback, source: "fallback" });
  }

  const apiKey = getGooglePlacesApiKey();
  if (!apiKey) {
    return NextResponse.json({ error: "Google Places is not configured." }, { status: 503 });
  }

  const params = new URLSearchParams({
    place_id: placeId,
    fields: "place_id,formatted_address,geometry,address_component,name,type",
    key: apiKey
  });

  const response = await fetch(
    `https://maps.googleapis.com/maps/api/place/details/json?${params.toString()}`,
    { next: { revalidate: 60 * 60 * 24 * 14 } }
  );
  const data = (await response.json()) as GooglePlaceDetailsResponse;

  if (!response.ok || data.status !== "OK" || !data.result) {
    console.error("[places] details failed", {
      placeId,
      status: data.status,
      error: data.error_message
    });
    return NextResponse.json({ error: "Place details could not be loaded." }, { status: 502 });
  }

  return NextResponse.json({ place: normalizeGoogleDetails(data.result), source: "google" });
}
