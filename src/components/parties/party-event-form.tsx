"use client";

import { useState } from "react";
import { createPartyEventAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { ImageUploadField } from "@/components/ui/image-upload-field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export function PartyEventForm() {
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
        window.location.href = `/parties/${result.eventId}`;
      }}
      className="grid gap-3"
    >
      <Input name="title" placeholder="Event title, e.g. Lemon Garden Brunch" required />
      <Input name="theme" placeholder="Theme, e.g. Citrus baby shower" />
      <Textarea name="description" placeholder="Styling notes, favorite vendors, inspiration, or event story..." />
      <ImageUploadField
        name="coverImageUrl"
        label="Cover photo"
        helperText="Click to upload a cover image for this event gallery."
      />
      <div className="grid gap-2">
        <label className="text-sm font-medium">Additional inspiration image URLs</label>
        {[0, 1, 2].map((index) => (
          <Input key={index} name="imageUrls" placeholder={`Optional image URL ${index + 1}`} />
        ))}
      </div>
      <Button type="submit">Create event gallery</Button>
      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
    </form>
  );
}
