import { NextResponse } from "next/server";
import {
  getGooglePlacesApiKey,
  normalizeGoogleDetails,
  type GooglePlaceDetailsResponse
} from "@/lib/places";
import { enforceRequestRateLimit } from "@/lib/security/request";
import { securityLog } from "@/lib/security/audit-log";

const GOOGLE_PLACES_TIMEOUT_MS = 4500;

export async function GET(request: Request) {
  const limited = enforceRequestRateLimit(request, [
    { key: "places-details:ip:{ip}", limit: 80, intervalMs: 60_000 }
  ]);
  if (limited) return limited;

  const url = new URL(request.url);
  const placeId = (url.searchParams.get("placeId") ?? "").trim();

  if (!placeId || placeId.length > 180 || !/^[A-Za-z0-9_:-]+$/.test(placeId)) {
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
      securityLog("places_details_failed", {
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
    securityLog("places_details_request_failed", {
      placeId,
      error: error instanceof Error ? error.message : "unknown"
    });
    return NextResponse.json(
      { error: "Place details timed out. Please try again." },
      { status: 504 }
    );
  }
}
