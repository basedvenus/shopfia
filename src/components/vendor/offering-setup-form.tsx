"use client";

import { useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
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
  description?: string;
  id: string;
  name?: string;
  priceCents?: number;
};

function createRow(): PricedRow {
  return { id: crypto.randomUUID() };
}

type PricedOption = {
  description?: string;
  name: string;
  priceCents?: number;
};

type ExistingOffering = {
  addons: PricedOption[];
  basePriceCents: number | null;
  categoryId: string;
  description: string;
  eventCategoryIds: string[];
  id: string;
  messageForPricing: boolean;
  packages: PricedOption[];
  photos: string[];
  photoCrops?: Array<{ x: number; y: number; zoom: number }>;
  slug: string;
  tags: string[];
  title: string;
  type: "SERVICE" | "PRODUCT" | "CUSTOM_ORDER";
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
  const [hasPackages, setHasPackages] = useState(Boolean(offering?.packages.length));
  const [packages, setPackages] = useState<PricedRow[]>(
    offering?.packages.length ? offering.packages.map(optionToRow) : [createRow()]
  );
  const [addons, setAddons] = useState<PricedRow[]>(
    offering?.addons.length ? offering.addons.map(optionToRow) : [createRow()]
  );
  const generatedSlug = useMemo(() => slugify(title), [title]);
  const tagValues = [...(offering?.tags ?? []), "", "", "", ""].slice(0, 4);

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
          <FieldShell label="Offering Type" required helperText="Choose the closest fit for what hosts are booking or buying.">
            <select
              name="type"
              className="h-11 rounded-2xl border bg-white px-3 text-sm"
              data-required-label="Offering Type"
              defaultValue={offering?.type ?? "SERVICE"}
              required
            >
              <option value="SERVICE">Service</option>
              <option value="PRODUCT">Physical Product</option>
              <option value="CUSTOM_ORDER">Custom Order</option>
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

          <FieldShell label="Service Category" required helperText="This controls where your listing appears under Shop by Category.">
            <select
              name="categoryId"
              className="h-11 rounded-2xl border bg-white px-3 text-sm"
              data-required-label="Service Category"
              defaultValue={offering?.categoryId ?? ""}
              required
            >
              <option value="">Choose the closest category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </FieldShell>

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
            <h3 className="font-semibold">Hashtags</h3>
            <p className="text-sm text-muted-foreground">
              Add words hosts might search for: pastel, garden party, baby shower, florals.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          {tagValues.map((tag, index) => (
            <Input key={index} name="tags" placeholder={`Tag ${index + 1}`} defaultValue={tag} />
          ))}
        </div>
      </section>

      <section className="rounded-[1.5rem] border border-border/80 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Packages and options</h3>
            <p className="text-sm text-muted-foreground">
              Useful for tiers, bundles, rental durations, cake sizes, floral upgrades, and bounce house packages.
            </p>
          </div>
          <label className="flex items-center gap-2 rounded-full bg-[#fbf7f5] px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={hasPackages}
              onChange={(event) => setHasPackages(event.target.checked)}
            />
            This has packages
          </label>
        </div>

        {hasPackages ? (
          <div className="mt-4 space-y-3">
            {packages.map((row, index) => (
              <PricedOptionFields
                key={row.id}
                descriptionName="packageDescriptions"
                defaultDescription={row.description}
                defaultName={row.name}
                defaultPrice={formatCentsAsDollars(row.priceCents)}
                nameName="packageNames"
                priceName="packagePrices"
                title={`Package ${index + 1}`}
                onRemove={packages.length > 1 ? () => setPackages((current) => current.filter((item) => item.id !== row.id)) : undefined}
              />
            ))}
            <Button type="button" variant="secondary" onClick={() => setPackages((current) => [...current, createRow()])}>
              <Plus className="h-4 w-4" />
              Add package
            </Button>
          </div>
        ) : null}
      </section>

      <section className="rounded-[1.5rem] border border-border/80 bg-white p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="font-semibold">Optional add-ons</h3>
            <p className="text-sm text-muted-foreground">
              Add upsells like delivery, setup, candles, extra florals, rush orders, or balloon upgrades.
            </p>
          </div>
          <Button type="button" variant="secondary" onClick={() => setAddons((current) => [...current, createRow()])}>
            <Plus className="h-4 w-4" />
            Add add-on
          </Button>
        </div>

        <div className="mt-4 space-y-3">
          {addons.map((row, index) => (
            <PricedOptionFields
              key={row.id}
              descriptionName="addonDescriptions"
              defaultDescription={row.description}
              defaultName={row.name}
              defaultPrice={formatCentsAsDollars(row.priceCents)}
              nameName="addonNames"
              priceName="addonPrices"
              title={`Add-on ${index + 1}`}
              optional
              onRemove={addons.length > 1 ? () => setAddons((current) => current.filter((item) => item.id !== row.id)) : undefined}
            />
          ))}
        </div>
      </section>

      <SubmitButton type="submit" size="lg" pendingText="Saving offering...">
        {offering ? "Update offering" : "Save offering"}
      </SubmitButton>
    </ValidatedForm>
  );
}

function PricedOptionFields({
  defaultDescription,
  defaultName,
  defaultPrice,
  descriptionName,
  nameName,
  onRemove,
  optional = false,
  priceName,
  title
}: {
  defaultDescription?: string;
  defaultName?: string;
  defaultPrice?: string;
  descriptionName: string;
  nameName: string;
  onRemove?: () => void;
  optional?: boolean;
  priceName: string;
  title: string;
}) {
  return (
    <div className="rounded-[1.2rem] border bg-[#fbf7f5] p-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold">{title}</div>
        {onRemove ? (
          <button type="button" className="rounded-full p-1 text-muted-foreground hover:bg-white hover:text-foreground" onClick={onRemove}>
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="grid gap-2 md:grid-cols-[1fr_1.2fr_0.55fr]">
        <Input name={nameName} placeholder={optional ? "Delivery" : "Deluxe Package"} defaultValue={defaultName} />
        <Input
          name={descriptionName}
          placeholder={optional ? "Local delivery and setup" : "5 hours, balloons included"}
          defaultValue={defaultDescription}
        />
        <Input name={priceName} inputMode="decimal" placeholder="$150" defaultValue={defaultPrice} />
      </div>
    </div>
  );
}

function optionToRow(option: PricedOption): PricedRow {
  return {
    description: option.description,
    id: crypto.randomUUID(),
    name: option.name,
    priceCents: option.priceCents
  };
}

function formatCentsAsDollars(value?: number | null) {
  if (value == null) return undefined;
  return String(value / 100);
}
