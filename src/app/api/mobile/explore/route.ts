import { NextResponse } from "next/server";
import { getExploreData } from "@/lib/data/explore";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params: Record<string, string | string[]> = {};

  url.searchParams.forEach((value, key) => {
    const existing = params[key];
    if (Array.isArray(existing)) {
      existing.push(value);
    } else if (existing) {
      params[key] = [existing, value];
    } else {
      params[key] = value;
    }
  });

  const data = await getExploreData(params);

  return NextResponse.json({
    categories: data.categories,
    eventCategories: data.eventCategories,
    filters: data.filters,
    offerings: data.offerings,
    parties: data.parties,
    vendors: data.vendors
  });
}
