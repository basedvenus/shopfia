"use client";

import { usePathname, useRouter } from "next/navigation";
import { Heart, Lock, Send } from "lucide-react";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { createPublicInquiryAction } from "@/app/actions/inquiries";
import { PlaceAutocompleteInput } from "@/components/location/place-autocomplete-input";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ListingInquiryFormProps = {
  defaultName?: string | null;
  listingId?: string | null;
  offeringId?: string | null;
  vendorProfileId: string;
};

const softInputClassName =
  "h-12 rounded-[1rem] border-[#eadbd7] bg-white/90 px-4 shadow-none transition placeholder:text-[#9a8d88] focus-visible:border-primary/45 focus-visible:ring-2 focus-visible:ring-primary/15";

export function ListingInquiryPanel({
  className,
  defaultName,
  description = "Share a few details about your event and the vendor will personally get back to you.",
  eyebrow = "Let's connect",
  listingId,
  offeringId,
  title = "Send Inquiry",
  vendorProfileId
}: ListingInquiryFormProps & {
  className?: string;
  description?: string;
  eyebrow?: string;
  title?: string;
}) {
  return (
    <section
      id="inquiry"
      className={cn(
        "relative overflow-hidden rounded-[1.75rem] border border-white/80 bg-white/95 p-6 shadow-[0_22px_70px_rgba(80,55,45,0.10)] backdrop-blur",
        className
      )}
    >
      <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-20 left-8 h-32 w-32 rounded-full bg-[#fde4d5]/70 blur-3xl" />
      <div className="relative space-y-3">
        <p className="[font-family:'Canela','Editorial_New','Iowan_Old_Style','Times_New_Roman',serif] text-xl italic text-primary">
          {eyebrow}
        </p>
        <div className="flex items-center gap-3">
          <h2 className="[font-family:'Canela','Editorial_New','Iowan_Old_Style','Times_New_Roman',serif] text-4xl font-normal tracking-normal">
            {title}
          </h2>
          <Heart className="h-5 w-5 text-primary" />
        </div>
        <p className="max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      <div className="relative mt-6">
        <ListingInquiryForm
          defaultName={defaultName}
          listingId={listingId}
          offeringId={offeringId}
          vendorProfileId={vendorProfileId}
        />
      </div>
    </section>
  );
}

export function ListingInquiryForm({
  defaultName,
  listingId,
  offeringId,
  vendorProfileId
}: ListingInquiryFormProps) {
  const router = useRouter();
  const pathname = usePathname();
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
          if (result.requiresAuth) {
            router.push(`/account?redirectTo=${encodeURIComponent(`${pathname}#inquiry`)}`);
            return;
          }

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
      <input type="hidden" name="offeringId" value={offeringId ?? ""} />
      <input type="hidden" name="listingId" value={listingId ?? ""} />

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

        <Field label="Event Location" required>
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
            placeholder="City, venue, or address"
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Budget" optional>
            <Input
              name="budgetDollars"
              type="number"
              min={0}
              step="0.01"
              placeholder="e.g. 500"
              className={softInputClassName}
            />
          </Field>
          <Field label="Guest Count" optional>
            <Input
              name="guestCount"
              type="number"
              min={1}
              placeholder="e.g. 20 guests"
              className={softInputClassName}
            />
          </Field>
        </div>

        <Field label="Tell the vendor what you're envisioning..." required>
          <Textarea
            name="message"
            placeholder="Share your vision, style, timing, must-haves, or any other details..."
            className={`${softInputClassName} min-h-[145px] resize-y leading-6`}
            required
          />
        </Field>

        <div className="grid gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-medium text-[#4b403c]">Add inspiration</span>
            <span className="text-xs text-muted-foreground">Optional</span>
          </div>
          <ImageUploadField
            name="inspirationUrls"
            label=""
            helperText="Add a photo or Pinterest reference to show the feeling you want."
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

        <Button type="submit" className="h-12 w-full rounded-full text-base" disabled={isPending}>
          <Send className="h-4 w-4" />
          {isPending ? "Sending..." : "Send Inquiry"}
        </Button>
        <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Your message stays private and is only shared with this vendor.
        </p>
      </div>
    </form>
  );
}

function Field({
  children,
  helper,
  label,
  optional,
  required
}: {
  children: ReactNode;
  helper?: string;
  label: string;
  optional?: boolean;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2">
      <span className="flex min-h-5 items-center justify-between gap-2 text-sm font-semibold text-[#4b403c]">
        <span>
          {label}
          {required ? <span className="ml-1 text-primary">*</span> : null}
        </span>
        {optional ? (
          <span className="text-xs font-normal text-muted-foreground">Optional</span>
        ) : null}
      </span>
      {children}
      {helper ? <span className="text-xs leading-5 text-muted-foreground">{helper}</span> : null}
    </label>
  );
}
