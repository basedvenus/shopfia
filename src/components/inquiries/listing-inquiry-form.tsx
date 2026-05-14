"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { createPublicInquiryAction } from "@/app/actions/inquiries";
import { PlaceAutocompleteInput } from "@/components/location/place-autocomplete-input";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type ListingInquiryFormProps = {
  defaultEmail?: string | null;
  defaultName?: string | null;
  listingId?: string | null;
  offeringId: string;
  vendorProfileId: string;
};

export function ListingInquiryForm({
  defaultEmail,
  defaultName,
  listingId,
  offeringId,
  vendorProfileId
}: ListingInquiryFormProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        if (isPending) return;
        setStatus(null);
        startTransition(async () => {
          const result = await createPublicInquiryAction(formData);
          if (!result.success) {
            setStatus({
              tone: "error",
              message: result.error ?? "Your inquiry could not be sent. Please try again."
            });
            return;
          }

          setStatus({
            tone: "success",
            message: "Inquiry sent. Opening your ShopFia message thread..."
          });
          formRef.current?.reset();
          window.setTimeout(() => {
            router.push(`/messages?conversationId=${result.conversationId}`);
          }, 550);
        });
      }}
      className="space-y-4"
    >
      <input type="hidden" name="vendorProfileId" value={vendorProfileId} />
      <input type="hidden" name="offeringId" value={offeringId} />
      <input type="hidden" name="listingId" value={listingId ?? ""} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" required>
          <Input name="name" placeholder="Your name" defaultValue={defaultName ?? ""} required />
        </Field>
        <Field label="Email" helper="Email or phone is required.">
          <Input name="email" type="email" placeholder="you@example.com" defaultValue={defaultEmail ?? ""} />
        </Field>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Phone">
          <Input name="phone" placeholder="Optional phone" />
        </Field>
        <Field label="Event Date" required>
          <Input name="eventDate" type="date" required />
        </Field>
      </div>

      <Field label="Event Location">
        <PlaceAutocompleteInput
          fieldNames={{
            input: "eventLocation",
            formattedAddress: "locationFormattedAddress",
            city: "locationCity",
            state: "locationState",
            zipCode: "locationZipCode",
            lat: "locationLat",
            lng: "locationLng",
            placeId: "locationPlaceId"
          }}
          placeholder="Venue, city, neighborhood, or address"
        />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Budget">
          <Input name="budgetDollars" type="number" min={0} step="0.01" placeholder="Optional budget" />
        </Field>
        <Field label="Guest Count">
          <Input name="guestCount" type="number" min={1} placeholder="Optional guest count" />
        </Field>
      </div>

      <Field label="Inquiry Details" required>
        <Textarea
          name="message"
          placeholder="Tell the vendor what you are planning, your style, timing, quantities, or inspiration..."
          className="min-h-[130px]"
          required
        />
      </Field>

      <ImageUploadField
        name="inspirationUrls"
        label="Pinterest / inspiration upload (Optional)"
        helperText="Optional. Add one visual reference to help explain the look."
      />

      {status ? (
        <p
          className={`rounded-[1rem] px-3 py-2 text-sm ${
            status.tone === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-[#f8ece9] text-muted-foreground"
          }`}
        >
          {status.message}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? "Sending..." : "Send Inquiry"}
      </Button>
    </form>
  );
}

function Field({
  children,
  helper,
  label,
  required
}: {
  children: ReactNode;
  helper?: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">
        {label}
        {required ? <span className="ml-1 text-primary">*</span> : null}
      </span>
      {children}
      {helper ? <span className="text-xs leading-5 text-muted-foreground">{helper}</span> : null}
    </label>
  );
}
