"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const SOLANO_AREA_OPTIONS = [
  "Fairfield, CA",
  "Vacaville, CA",
  "Benicia, CA",
  "Suisun City, CA",
  "Vallejo, CA",
  "Dixon, CA",
  "Napa, CA",
  "American Canyon, CA",
  "Cordelia, Fairfield, CA",
  "Green Valley, Fairfield, CA"
];

export function ServiceAreaPicker({ defaultValue }: { defaultValue?: string | null }) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const initial = (defaultValue ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const [selected, setSelected] = useState<string[]>(initial);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const suggestions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return SOLANO_AREA_OPTIONS.filter((option) => {
      return (
        !selected.includes(option) &&
        (!normalized || option.toLowerCase().includes(normalized))
      );
    }).slice(0, 5);
  }, [query, selected]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function addArea(area: string) {
    setSelected((current) => [...current, area]);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="grid gap-2" ref={wrapperRef}>
      <label className="text-sm font-medium">Service Areas</label>
      <div className="relative">
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Start typing Fairfield, Vacaville, Benicia..."
          className="flex h-10 w-full rounded-2xl border bg-white px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary"
        />
        {open && suggestions.length > 0 ? (
          <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border bg-white shadow-soft">
            {suggestions.map((area) => (
              <button
                key={area}
                type="button"
                className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => addArea(area)}
              >
                {area}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {selected.map((area) => (
          <span key={area} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs">
            {area}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setSelected((current) => current.filter((item) => item !== area))}
            >
              x
            </button>
          </span>
        ))}
      </div>
      {open && query.trim() && suggestions.length === 0 ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => addArea(query.trim())}>
          Add {query.trim()}
        </Button>
      ) : null}
      <input type="hidden" name="serviceAreaNotes" value={selected.join(", ")} />
    </div>
  );
}
