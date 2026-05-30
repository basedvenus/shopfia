"use client";

import Link from "next/link";
import { SlidersHorizontal, Search, X } from "lucide-react";
import { useState } from "react";
import { PlaceAutocompleteInput } from "@/components/location/place-autocomplete-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Category = { id: string; name: string };
type Filters = {
  q?: string;
  city?: string;
  placeId?: string;
  locationLabel?: string;
  lat?: number;
  lng?: number;
  categoryId?: string;
  eventCategoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  radius?: number;
  availableWeekend?: "true" | "false";
  verified?: "true";
  sort?: "recommended" | "distance" | "top-rated" | "newest";
};

export function ExploreSearch({
  categories,
  eventCategories,
  filters
}: {
  categories: Category[];
  eventCategories: Category[];
  filters: Filters;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = [
    filters.categoryId,
    filters.eventCategoryId,
    filters.minPrice,
    filters.maxPrice,
    filters.minRating,
    filters.radius,
    filters.availableWeekend,
    filters.verified,
    filters.sort && filters.sort !== "recommended" ? filters.sort : undefined
  ].filter(Boolean).length;

  return (
    <form action="/explore" className="space-y-4 rounded-[1.6rem] border border-white/70 bg-white/85 p-4 shadow-soft md:p-5">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1.7fr)_minmax(260px,1fr)_auto_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={filters.q}
            placeholder="Search vendors, services, themes, or events..."
            className="h-12 rounded-full border-[#eadbd7] bg-white/90 pl-10 shadow-none"
          />
        </div>
        <PlaceAutocompleteInput
          defaultValue={filters.locationLabel ?? filters.city ?? ""}
          defaultPlace={{
            formattedAddress: filters.locationLabel ?? filters.city,
            placeId: filters.placeId,
            lat: filters.lat,
            lng: filters.lng
          }}
          fieldNames={{
            input: "city",
            placeId: "placeId",
            lat: "lat",
            lng: "lng",
            label: "locationLabel"
          }}
          placeholder="City, venue, or location"
          inputClassName="h-12 rounded-full border-[#eadbd7] bg-white/90 shadow-none"
        />
        <Button type="submit" className="h-12 w-full px-7 lg:w-auto">
          Explore
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-12 w-full border-[#eadbd7] bg-white/90 px-5 lg:w-auto"
          onClick={() => setFiltersOpen(true)}
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilterCount ? (
            <span className="ml-1 rounded-full bg-primary px-2 py-0.5 text-xs text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </Button>
      </div>

      <DiscoveryPills
        categories={categories}
        eventCategories={eventCategories}
        filters={filters}
      />

      <div className={cn("fixed inset-0 z-50", filtersOpen ? "block" : "hidden")}>
        <button
          aria-label="Close filters"
          className="absolute inset-0 bg-[#2a2421]/25 backdrop-blur-[2px]"
          type="button"
          onClick={() => setFiltersOpen(false)}
        />
        <aside className="absolute inset-x-0 bottom-0 max-h-[88vh] overflow-y-auto rounded-t-[2rem] border border-white/70 bg-[#fffaf7] p-5 shadow-[0_-18px_60px_rgba(68,51,45,0.18)] md:inset-y-0 md:left-auto md:right-0 md:h-full md:max-h-none md:w-[430px] md:rounded-l-[2rem] md:rounded-tr-none md:p-7">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Refine
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">Filters</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Narrow results after you start browsing.
              </p>
            </div>
            <Button
              aria-label="Close filters"
              type="button"
              variant="secondary"
              size="icon"
              className="border-[#eadbd7] bg-white"
              onClick={() => setFiltersOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4">
            <FilterField label="Service Category">
              <select
                name="categoryId"
                defaultValue={filters.categoryId ?? ""}
                className={filterSelectClassName}
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FilterField>
            <FilterField label="Event Type">
              <select
                name="eventCategoryId"
                defaultValue={filters.eventCategoryId ?? ""}
                className={filterSelectClassName}
              >
                <option value="">All events</option>
                {eventCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FilterField>
            <div className="grid gap-3 sm:grid-cols-2">
              <FilterField label="Min Price">
                <Input name="minPrice" type="number" min={0} step="0.01" defaultValue={filters.minPrice} placeholder="$250" className={filterInputClassName} />
              </FilterField>
              <FilterField label="Max Price">
                <Input name="maxPrice" type="number" min={0} step="0.01" defaultValue={filters.maxPrice} placeholder="$1,500" className={filterInputClassName} />
              </FilterField>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FilterField label="Rating">
                <Input name="minRating" type="number" step="0.1" min={0} max={5} defaultValue={filters.minRating} placeholder="4.5" className={filterInputClassName} />
              </FilterField>
              <FilterField label="Travel Radius">
                <Input name="radius" type="number" min={1} max={200} defaultValue={filters.radius} placeholder="25" className={filterInputClassName} />
              </FilterField>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FilterField label="Availability">
                <select
                  name="availableWeekend"
                  defaultValue={filters.availableWeekend ?? ""}
                  className={filterSelectClassName}
                >
                  <option value="">Any time</option>
                  <option value="true">This weekend</option>
                  <option value="false">Not this weekend</option>
                </select>
              </FilterField>
              <FilterField label="Sort">
                <select
                  name="sort"
                  defaultValue={filters.sort ?? "recommended"}
                  className={filterSelectClassName}
                >
                  <option value="recommended">Recommended</option>
                  <option value="distance">Distance</option>
                  <option value="top-rated">Top rated</option>
                  <option value="newest">Newest</option>
                </select>
              </FilterField>
            </div>
            <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#eadbd7] bg-white/80 px-4 py-3 text-sm font-semibold text-[#4b403c]">
              <span>Verified Vendors</span>
              <input
                name="verified"
                type="checkbox"
                value="true"
                defaultChecked={filters.verified === "true"}
                className="h-4 w-4 accent-primary"
              />
            </label>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <Button type="submit" className="h-12">
              Apply Filters
            </Button>
            <Button asChild variant="secondary" className="h-12 border-[#eadbd7] bg-white">
              <Link href={clearAdvancedHref(filters)}>Clear Filters</Link>
            </Button>
          </div>
        </aside>
      </div>
    </form>
  );
}

const filterInputClassName =
  "h-11 rounded-2xl border-[#eadbd7] bg-white/90 shadow-none focus-visible:ring-1 focus-visible:ring-primary/50";

const filterSelectClassName =
  "flex h-11 w-full rounded-2xl border border-[#eadbd7] bg-white/90 px-3 text-sm shadow-none outline-none focus:ring-1 focus:ring-primary/50";

function FilterField({
  children,
  label
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-semibold text-[#4b403c]">{label}</span>
      {children}
    </label>
  );
}

function DiscoveryPills({
  categories,
  eventCategories,
  filters
}: {
  categories: Category[];
  eventCategories: Category[];
  filters: Filters;
}) {
  const pills = [
    { label: "Baby Shower", kind: "event" },
    { label: "Weddings", eventName: "Wedding", kind: "event" },
    { label: "Florals", kind: "category" },
    { label: "Balloons", query: "balloons" },
    { label: "Cookies", query: "cookies" },
    { label: "Brunch", query: "brunch" },
    { label: "Luxury", query: "luxury" },
    { label: "Kids Parties", categoryName: "Children's Entertainment", kind: "category" },
    { label: "Outdoor Events", query: "outdoor" }
  ];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {pills.map((pill) => {
        const href = getPillHref(pill, categories, eventCategories, filters);
        return (
          <Link
            key={pill.label}
            href={href}
            className="whitespace-nowrap rounded-full border border-[#eadbd7] bg-white/75 px-4 py-2 text-sm font-medium text-[#5f534e] transition hover:border-primary/40 hover:bg-primary/10 hover:text-foreground"
          >
            {pill.label}
          </Link>
        );
      })}
    </div>
  );
}

function getPillHref(
  pill: {
    label: string;
    categoryName?: string;
    eventName?: string;
    kind?: string;
    query?: string;
  },
  categories: Category[],
  eventCategories: Category[],
  filters: Filters
) {
  const params = baseSearchParams(filters);
  const category = categories.find((item) => item.name === (pill.categoryName ?? pill.label));
  const event = eventCategories.find((item) => item.name === (pill.eventName ?? pill.label));

  if (pill.query) {
    params.set("q", pill.query);
  } else if (pill.kind === "event" && event) {
    params.set("eventCategoryId", event.id);
  } else if (pill.kind === "category" && category) {
    params.set("categoryId", category.id);
  } else {
    params.set("q", pill.label);
  }

  return `/explore?${params.toString()}`;
}

function clearAdvancedHref(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.city) params.set("city", filters.city);
  if (filters.locationLabel) params.set("locationLabel", filters.locationLabel);
  if (filters.placeId) params.set("placeId", filters.placeId);
  if (filters.lat != null) params.set("lat", String(filters.lat));
  if (filters.lng != null) params.set("lng", String(filters.lng));

  const query = params.toString();
  return query ? `/explore?${query}` : "/explore";
}

function baseSearchParams(filters: Filters) {
  const params = new URLSearchParams();
  if (filters.q) params.set("q", filters.q);
  if (filters.city) params.set("city", filters.city);
  if (filters.locationLabel) params.set("locationLabel", filters.locationLabel);
  if (filters.placeId) params.set("placeId", filters.placeId);
  if (filters.lat != null) params.set("lat", String(filters.lat));
  if (filters.lng != null) params.set("lng", String(filters.lng));
  return params;
}
