"use client";

import { Search, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Category = { id: string; name: string };
type Filters = {
  q?: string;
  city?: string;
  categoryId?: string;
  eventCategoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  radius?: number;
  availableWeekend?: "true" | "false";
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
  return (
    <form action="/explore" className="space-y-4 rounded-3xl border bg-white/80 p-4 shadow-soft backdrop-blur">
      <div className="grid gap-3 lg:grid-cols-[2fr_1.2fr_auto]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            defaultValue={filters.q}
            placeholder="Search vendors, events, categories, tags..."
            className="pl-9"
          />
        </div>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="city"
            defaultValue={filters.city}
            placeholder="City or zip"
            className="pl-9"
          />
        </div>
        <Button type="submit" className="w-full lg:w-auto">
          Explore
        </Button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-8">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Service</label>
          <select
            name="categoryId"
            defaultValue={filters.categoryId ?? ""}
            className="flex h-10 w-full rounded-2xl border bg-white px-3 text-sm"
          >
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Event</label>
          <select
            name="eventCategoryId"
            defaultValue={filters.eventCategoryId ?? ""}
            className="flex h-10 w-full rounded-2xl border bg-white px-3 text-sm"
          >
            <option value="">All events</option>
            {eventCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Min Price ($)</label>
          <Input name="minPrice" type="number" min={0} step="0.01" defaultValue={filters.minPrice} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Max Price ($)</label>
          <Input name="maxPrice" type="number" min={0} step="0.01" defaultValue={filters.maxPrice} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Minimum Rating</label>
          <Input name="minRating" type="number" step="0.1" min={0} max={5} defaultValue={filters.minRating} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Radius (miles vendors travel)</label>
          <Input name="radius" type="number" min={1} max={200} defaultValue={filters.radius} />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">This weekend</label>
          <select
            name="availableWeekend"
            defaultValue={filters.availableWeekend ?? ""}
            className="flex h-10 w-full rounded-2xl border bg-white px-3 text-sm"
          >
            <option value="">Any</option>
            <option value="true">Available this weekend</option>
            <option value="false">Unavailable this weekend</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Sort</label>
          <select
            name="sort"
            defaultValue={filters.sort ?? "recommended"}
            className="flex h-10 w-full rounded-2xl border bg-white px-3 text-sm"
          >
            <option value="recommended">Recommended</option>
            <option value="distance">Distance</option>
            <option value="top-rated">Top rated</option>
            <option value="newest">Newest</option>
          </select>
        </div>
      </div>
    </form>
  );
}
