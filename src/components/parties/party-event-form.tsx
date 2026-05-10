"use client";

import { useState } from "react";
import { createPartyEventAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type PartyEventFormProps = {
  vendors: { id: string; name: string; city: string; state: string | null }[];
};

export function PartyEventForm({ vendors }: PartyEventFormProps) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setMessage(null);
        const result = await createPartyEventAction(formData);
        if (!result.ok) {
          setMessage(result.error ?? "Could not create party gallery.");
          return;
        }
        window.location.href = `/events/${result.eventSlug}`;
      }}
      className="grid gap-3"
    >
      <Input name="title" placeholder="Party Name, e.g. Lemon Garden Brunch" required />
      <Input name="theme" placeholder="Theme, e.g. Citrus baby shower" />
      <Input name="tags" placeholder="Tags: baby shower, brunch, pastel, lemons, floral" />
      <Textarea name="description" placeholder="Styling notes, favorite vendors, inspiration, or event story..." />
      <ImageUploadField
        name="coverImageUrl"
        label="Add Photos"
        helperText="Start with a cover image. Add more photo URLs below for this MVP."
      />
      <div className="grid gap-2">
        <label className="text-sm font-medium">More party photo URLs</label>
        {[0, 1, 2].map((index) => (
          <Input key={index} name="imageUrls" placeholder={`Optional image URL ${index + 1}`} />
        ))}
      </div>
      <div className="grid gap-2 rounded-[1.25rem] border bg-white/80 p-3">
        <label className="text-sm font-medium">Tag Vendors</label>
        <div className="grid gap-2 sm:grid-cols-2">
          {vendors.map((vendor) => (
            <label key={vendor.id} className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm">
              <input type="checkbox" name="taggedVendorIds" value={vendor.id} />
              <span>
                {vendor.name}
                <span className="block text-xs text-muted-foreground">
                  {vendor.city}{vendor.state ? `, ${vendor.state}` : ""}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <Button type="submit">Add Party</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}
