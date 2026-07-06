"use client";

import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { Check, Plus, Sparkles, X } from "lucide-react";
import { upsertOfferingAction } from "@/app/actions/vendor";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FieldShell, SubmitButton, ValidatedForm } from "@/components/ui/validated-form";

type CategoryOption = {
  id: string;
  name: string;
};

type PricedRow = {
  addonComponentIds?: string[];
  componentIds?: string[];
  description?: string;
  id: string;
  name?: string;
  priceCents?: number;
};

function createRow(): PricedRow {
  return { id: crypto.randomUUID() };
}

type PricedOption = {
  addonComponentIds?: string[];
  componentIds?: string[];
  description?: string;
  name: string;
  priceCents?: number;
};

type ServiceComponent = {
  category?: string;
  description?: string;
  id: string;
  priceCents?: number;
  title: string;
};

type ExistingOffering = {
  addons: PricedOption[];
  basePriceCents: number | null;
  categoryId: string;
  categoryIds?: string[];
  components?: ServiceComponent[];
  description: string;
  eventCategoryIds: string[];
  id: string;
  messageForPricing: boolean;
  packages: PricedOption[];
  photos: string[];
  photoCrops?: Array<{ x: number; y: number; zoom: number }>;
  slug: string;
  title: string;
  type: "PRODUCT" | "SERVICE" | "RENTAL" | "CUSTOM_ORDER";
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function OfferingSetupForm({
  categories,
  eventCategories,
  offering
}: {
  categories: CategoryOption[];
  eventCategories: CategoryOption[];
  offering?: ExistingOffering;
}) {
  const [title, setTitle] = useState(offering?.title ?? "");
  const [messageForPricing, setMessageForPricing] = useState(offering?.messageForPricing ?? false);
  const [hasPackages, setHasPackages] = useState(Boolean(offering?.packages.length || offering?.components?.length));
  const [packages, setPackages] = useState<PricedRow[]>(
    offering?.packages.length ? offering.packages.map(optionToRow) : [createRow()]
  );
  const [components, setComponents] = useState<ServiceComponent[]>(
    offering?.components?.length ? offering.components : []
  );
  const generatedSlug = useMemo(() => slugify(title), [title]);
  const selectedCategoryIds = offering?.categoryIds?.length
    ? offering.categoryIds
    : offering?.categoryId
      ? [offering.categoryId]
      : [];

  return (
    <ValidatedForm
      action={upsertOfferingAction}
      className="space-y-6"
      errorIntro="Your offering is almost ready. Fix the highlighted field and save again."
    >
      {offering ? <input type="hidden" name="id" value={offering.id} /> : null}
      <input type="hidden" name="slug" value={generatedSlug || offering?.slug || "new-offering"} />

      <section className="grid gap-4 md:grid-cols-[0.8fr_1.2fr]">
        <div className="rounded-[1.5rem] bg-[#fbf7f5] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {offering ? "Edit service" : "First service"}
          </p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em]">
            {offering ? "Keep this storefront tile current and easy to inquire about." : "Build a storefront tile hosts can understand at a glance."}
          </h3>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Start simple: what you make, what it looks like, and whether pricing starts publicly
            or begins with a message.
          </p>
        </div>

        <div className="grid gap-3">
          <FieldShell label="Offering Type" required helperText="Choose the closest format for how clients book this offering.">
            <select
              name="type"
              className="h-11 rounded-2xl border bg-white px-3 text-sm"
              data-required-label="Offering Type"
              defaultValue={offering?.type ?? "SERVICE"}
              required
            >
              <option value="PRODUCT">Product</option>
              <option value="SERVICE">Service</option>
              <option value="RENTAL">Rental</option>
              <option value="CUSTOM_ORDER">Custom Experience</option>
            </select>
          </FieldShell>

          <FieldShell label="Offering Title" required helperText="Example: Luxury Balloon Garland or Custom Cookie Set.">
            <Input
              name="title"
              placeholder="Luxury balloon garland, custom cookie set, floral tablescape..."
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              data-required-label="Offering Title"
              required
            />
          </FieldShell>

          <div className="rounded-[1.4rem] border bg-white p-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Service categories <span className="text-primary">*</span>
              </label>
              <p className="text-sm leading-6 text-muted-foreground">
                Choose every category this belongs in. This helps your offering appear in the right discovery feeds.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2" data-required-label="Service Categories">
              {categories.map((category) => (
                <label
                  key={category.id}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-[#fbf7f5] px-3 py-2 text-sm transition hover:border-primary/45"
                >
                  <input
                    type="checkbox"
                    name="categoryIds"
                    value={category.id}
                    defaultChecked={selectedCategoryIds.includes(category.id)}
                  />
                  {category.name}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-[1.4rem] border bg-white p-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Event types</label>
              <p className="text-sm leading-6 text-muted-foreground">
                Optional. Pick every event this offering fits. These tags power Shop by Event feeds automatically.
              </p>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {eventCategories.map((category) => (
                <label
                  key={category.id}
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-[#fbf7f5] px-3 py-2 text-sm transition hover:border-primary/45"
                >
                  <input
                    type="checkbox"
                    name="eventCategoryIds"
                    value={category.id}
                    defaultChecked={offering?.eventCategoryIds.includes(category.id)}
                  />
                  {category.name}
                </label>
              ))}
            </div>
          </div>

          <FieldShell label="Description" required helperText="Tell hosts what is included, your style, and what makes this offering special.">
            <Textarea
              name="description"
              placeholder="Describe the style, what is included, and what kinds of parties this is best for..."
              className="min-h-[130px]"
              data-required-label="Description"
              defaultValue={offering?.description ?? ""}
              required
            />
          </FieldShell>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <ImageUploadField
          name="photos"
          label="Cover photo (Optional)"
          defaultValue={offering?.photos[0]}
          defaultCrop={offering?.photoCrops?.[0]}
          helperText="Use a real example or styled image that represents this offering."
        />
        <ImageUploadField
          name="photos"
          label="Detail photo (Optional)"
          defaultValue={offering?.photos[1]}
          defaultCrop={offering?.photoCrops?.[1]}
          helperText="Optional closeup, setup shot, or inspiration image."
        />
      </section>

      <section className="rounded-[1.5rem] border border-border/80 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Pricing</h3>
            <p className="text-sm text-muted-foreground">
              Show a starting point, or keep premium/custom work inquiry-first.
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-full bg-[#fbf7f5] px-3 py-2 text-sm">
            <input
              type="checkbox"
              name="messageForPricing"
              checked={messageForPricing}
              onChange={(event) => setMessageForPricing(event.target.checked)}
            />
            Message for pricing
          </label>
        </div>

        {!messageForPricing ? (
          <div className="mt-4 max-w-sm">
            <FieldShell label="Starting price" optional>
              <Input
                name="startingPrice"
                inputMode="decimal"
                placeholder="$250 (optional)"
                defaultValue={formatCentsAsDollars(offering?.basePriceCents)}
              />
            </FieldShell>
          </div>
        ) : (
          <div className="mt-4 rounded-[1.2rem] bg-[#fbf7f5] p-4 text-sm text-muted-foreground">
            Public profiles will show “Message for pricing” instead of a public starting price.
          </div>
        )}
      </section>

      <section className="rounded-[1.5rem] border border-border/80 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Packages and menu items</h3>
            <p className="text-sm text-muted-foreground">
              Optional. Use this only if clients choose from packages, flavors, add-ons, rentals, or bundled services.
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-full bg-[#fbf7f5] px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={hasPackages}
              onChange={(event) => setHasPackages(event.target.checked)}
            />
            Add packages or menu items
          </label>
        </div>

        {!hasPackages ? (
          <div className="mt-4 rounded-[1.2rem] bg-[#fbf7f5] p-4 text-sm leading-6 text-muted-foreground">
            Most vendors can skip this for now. Your offering can publish with a title, category,
            description, and starting price.
          </div>
        ) : (
          <div className="mt-4 space-y-5">
            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Menu items</h4>
                  <p className="text-sm text-muted-foreground">
                    Add optional pieces such as cake flavors, dessert add-ons, decor items, or rental components.
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => setComponents((current) => [...current, createComponent()])}>
                  <Plus className="h-4 w-4" />
                  Add menu item
                </Button>
              </div>

              {components.length > 0 ? (
                <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {components.map((component) => (
                    <ComponentFields
                      key={component.id}
                      component={component}
                      onChange={(nextComponent) =>
                        setComponents((current) =>
                          current.map((item) => (item.id === component.id ? nextComponent : item))
                        )
                      }
                      onRemove={() => {
                        setComponents((current) => current.filter((item) => item.id !== component.id));
                        setPackages((current) =>
                          current.map((row) => ({
                            ...row,
                            addonComponentIds: row.addonComponentIds?.filter((id) => id !== component.id),
                            componentIds: row.componentIds?.filter((id) => id !== component.id)
                          }))
                        );
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[1.2rem] border border-dashed border-primary/25 bg-[#fbf7f5] p-4 text-sm text-muted-foreground">
                  No menu items yet. Add one if this offering has selectable pieces.
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h4 className="text-sm font-semibold">Packages</h4>
                  <p className="text-sm text-muted-foreground">
                    Optional bundles clients can inquire about, like tasting boxes, dessert tables, or full-service styling.
                  </p>
                </div>
                <Button type="button" variant="secondary" onClick={() => setPackages((current) => [...current, createRow()])}>
                  <Plus className="h-4 w-4" />
                  Add package
                </Button>
              </div>

              <div className="mt-4 space-y-3">
                {packages.map((row, index) => (
                  <PackageBuilderCard
                    key={row.id}
                    components={components}
                    descriptionName="packageDescriptions"
                    defaultDescription={row.description}
                    defaultName={row.name}
                    defaultPrice={formatCentsAsDollars(row.priceCents)}
                    nameName="packageNames"
                    priceName="packagePrices"
                    row={row}
                    setPackages={setPackages}
                    title={`Package ${index + 1}`}
                    onRemove={packages.length > 1 ? () => setPackages((current) => current.filter((item) => item.id !== row.id)) : undefined}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      <SubmitButton type="submit" size="lg" pendingText="Saving offering...">
        {offering ? "Update offering" : "Save offering"}
      </SubmitButton>
    </ValidatedForm>
  );
}

function ComponentFields({
  component,
  onChange,
  onRemove
}: {
  component: ServiceComponent;
  onChange: (component: ServiceComponent) => void;
  onRemove?: () => void;
}) {
  return (
    <div className="rounded-[1.25rem] border bg-[#fbf7f5] p-3">
      <input type="hidden" name="componentIds" value={component.id} />
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          Menu item
        </div>
        {onRemove ? (
          <button type="button" className="rounded-full p-1 text-muted-foreground hover:bg-white hover:text-foreground" onClick={onRemove}>
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="grid gap-2">
        <Input
          name="componentTitles"
          placeholder="Vanilla bean cake, fresh florals, delivery..."
          value={component.title}
          onChange={(event) => onChange({ ...component, title: event.target.value })}
        />
        <Input
          name="componentDescriptions"
          placeholder="Optional short note"
          value={component.description ?? ""}
          onChange={(event) => onChange({ ...component, description: event.target.value })}
        />
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            name="componentCategories"
            placeholder="Flavor, decor, delivery..."
            value={component.category ?? ""}
            onChange={(event) => onChange({ ...component, category: event.target.value })}
          />
          <Input
            name="componentPrices"
            inputMode="decimal"
            placeholder="$50 optional"
            value={formatCentsAsDollars(component.priceCents) ?? ""}
            onChange={(event) =>
              onChange({ ...component, priceCents: dollarsInputToCents(event.target.value) })
            }
          />
        </div>
      </div>
    </div>
  );
}

function PackageBuilderCard({
  components,
  defaultDescription,
  defaultName,
  defaultPrice,
  descriptionName,
  nameName,
  onRemove,
  priceName,
  row,
  setPackages,
  title
}: {
  components: ServiceComponent[];
  defaultDescription?: string;
  defaultName?: string;
  defaultPrice?: string;
  descriptionName: string;
  nameName: string;
  onRemove?: () => void;
  priceName: string;
  row: PricedRow;
  setPackages: Dispatch<SetStateAction<PricedRow[]>>;
  title: string;
}) {
  const selectedIds = row.componentIds ?? [];
  const addonIds = row.addonComponentIds ?? [];
  const calculatedTotal = components
    .filter((component) => selectedIds.includes(component.id))
    .reduce((total, component) => total + (component.priceCents ?? 0), 0);
  const availableAddons = components.filter(
    (component) => component.title.trim() && !selectedIds.includes(component.id)
  );

  return (
    <div className="rounded-[1.35rem] border bg-[#fbf7f5] p-4">
      <input type="hidden" name="packageComponentIds" value={JSON.stringify(selectedIds)} />
      <input type="hidden" name="packageAddonComponentIds" value={JSON.stringify(addonIds)} />
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold">{title}</div>
          <div className="text-xs text-muted-foreground">
            Included items total: {calculatedTotal ? formatCurrency(calculatedTotal) : "$0"}.
            Override the package price if you want a custom bundle rate.
          </div>
        </div>
        {onRemove ? (
          <button type="button" className="rounded-full p-1 text-muted-foreground hover:bg-white hover:text-foreground" onClick={onRemove}>
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_1.2fr_0.55fr]">
        <Input name={nameName} placeholder="Dessert table package" defaultValue={defaultName} />
        <Input
          name={descriptionName}
          placeholder="A sweet starter setup for intimate parties"
          defaultValue={defaultDescription}
        />
        <Input
          name={priceName}
          inputMode="decimal"
          placeholder={calculatedTotal ? formatCentsAsDollars(calculatedTotal) : "$250"}
          defaultValue={defaultPrice}
        />
      </div>
      <div className="mt-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Includes
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {components.filter((component) => component.title.trim()).map((component) => {
            const active = selectedIds.includes(component.id);
            return (
              <button
                key={component.id}
                type="button"
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-white text-muted-foreground hover:border-primary/30"
                }`}
                onClick={() =>
                  setPackages((current) =>
                    current.map((item) =>
                      item.id === row.id
                        ? {
                            ...item,
                            addonComponentIds: item.addonComponentIds?.filter((id) => id !== component.id),
                            componentIds: active
                              ? selectedIds.filter((id) => id !== component.id)
                              : [...selectedIds, component.id]
                          }
                        : item
                    )
                  )
                }
              >
                {active ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                {component.title}
              </button>
            );
          })}
        </div>
      </div>
      {availableAddons.length > 0 ? (
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Optional add-ons for this package
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {availableAddons.map((component) => {
              const active = addonIds.includes(component.id);
              return (
                <button
                  key={component.id}
                  type="button"
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-primary/40 bg-white text-primary"
                      : "border-border bg-white/70 text-muted-foreground hover:border-primary/30"
                  }`}
                  onClick={() =>
                    setPackages((current) =>
                      current.map((item) =>
                        item.id === row.id
                          ? {
                              ...item,
                              addonComponentIds: active
                                ? addonIds.filter((id) => id !== component.id)
                                : [...addonIds, component.id]
                            }
                          : item
                      )
                    )
                  }
                >
                  {active ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                  {component.title}
                  {component.priceCents ? <span className="text-muted-foreground">+{formatCurrency(component.priceCents)}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function optionToRow(option: PricedOption): PricedRow {
  return {
    addonComponentIds: option.addonComponentIds ?? [],
    componentIds: option.componentIds ?? [],
    description: option.description,
    id: crypto.randomUUID(),
    name: option.name,
    priceCents: option.priceCents
  };
}

function createComponent(): ServiceComponent {
  return { id: crypto.randomUUID(), title: "" };
}

function formatCentsAsDollars(value?: number | null) {
  if (value == null) return undefined;
  return String(value / 100);
}

function dollarsInputToCents(value: string) {
  const normalized = value.replace(/[$,]/g, "").trim();
  if (!normalized) return undefined;
  const numericValue = Number(normalized);
  return Number.isFinite(numericValue) ? Math.round(numericValue * 100) : undefined;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(value / 100);
}
