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
  defaultName?: string | null;
  listingId?: string | null;
  offeringId: string;
  vendorProfileId: string;
};

const softInputClassName =
  "h-12 rounded-[1.15rem] border-[#eadbd7] bg-white/85 px-4 shadow-none focus-visible:ring-1 focus-visible:ring-primary/50";

export function ListingInquiryForm({
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
    >
      <input type="hidden" name="vendorProfileId" value={vendorProfileId} />
      <input type="hidden" name="offeringId" value={offeringId} />
      <input type="hidden" name="listingId" value={listingId ?? ""} />

      <div className="rounded-[1.75rem] border border-[#eadbd7] bg-[#fffaf8]/80 p-4 shadow-[0_18px_55px_rgba(80,55,45,0.07)] sm:p-5">
        <div className="grid gap-4">
          <Field label="Your Name" required>
            <Input
              name="name"
              placeholder="Your name"
              defaultValue={defaultName ?? ""}
              className={softInputClassName}
              required
            />
          </Field>

          <Field label="Event Date" required>
            <Input name="eventDate" type="date" className={softInputClassName} required />
          </Field>

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
              inputClassName={softInputClassName}
              placeholder="Venue, city, neighborhood, or address"
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Budget">
              <Input
                name="budgetDollars"
                type="number"
                min={0}
                step="0.01"
                placeholder="Optional budget"
                className={softInputClassName}
              />
            </Field>
            <Field label="Guest Count">
              <Input
                name="guestCount"
                type="number"
                min={1}
                placeholder="How many guests are you expecting?"
                className={softInputClassName}
              />
            </Field>
          </div>

          <Field label="Tell the vendor what you're envisioning..." required>
            <Textarea
              name="message"
              placeholder="Share the vibe, colors, quantities, timing, or anything you already know. A loose idea is perfect."
              className={`${softInputClassName} min-h-[145px] resize-y leading-6`}
              required
            />
          </Field>

          <div className="grid gap-3 rounded-[1.4rem] bg-white/55 p-3">
            <ImageUploadField
              name="inspirationUrls"
              label="Add inspiration"
              helperText="Optional. Add a photo or Pinterest reference to show the feeling you want."
              uploadLabel="Add inspiration photos"
              changeLabel="Change inspiration"
            />
            <Input
              name="inspirationUrls"
              type="url"
              placeholder="Add Pinterest link"
              className={softInputClassName}
            />
          </div>

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

          <Button type="submit" className="w-full rounded-full py-5" disabled={isPending}>
            {isPending ? "Sending..." : "Send Inquiry"}
          </Button>
        </div>
      </div>
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
    <label className="grid gap-2">
      <span className="text-sm font-medium text-[#4b403c]">
        {label}
        {required ? <span className="ml-1 text-primary">*</span> : null}
      </span>
      {children}
      {helper ? <span className="text-xs leading-5 text-muted-foreground">{helper}</span> : null}
    </label>
  );
}
