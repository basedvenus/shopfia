"use client";

import { ChangeEvent, useState } from "react";

type ImageUploadFieldProps = {
  name: string;
  label: string;
  defaultValue?: string | null;
  helperText?: string;
  rounded?: "full" | "large";
};

export function ImageUploadField({
  name,
  label,
  defaultValue,
  helperText,
  rounded = "large"
}: ImageUploadFieldProps) {
  const [value, setValue] = useState(defaultValue ?? "");

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setValue(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="grid gap-2">
      <label className="text-sm font-medium">{label}</label>
      <label
        className={`group relative grid min-h-[150px] cursor-pointer place-items-center overflow-hidden border border-dashed border-border bg-white/80 text-center text-sm text-muted-foreground transition hover:border-primary ${
          rounded === "full" ? "aspect-square h-28 min-h-0 w-28 rounded-full" : "rounded-[1.5rem]"
        }`}
      >
        {value ? (
          <span
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${value})` }}
          />
        ) : null}
        <span className="relative z-10 rounded-full bg-white/85 px-3 py-1.5 shadow-sm">
          {value ? "Change image" : "Upload image"}
        </span>
        <input type="file" accept="image/*" className="sr-only" onChange={handleFile} />
      </label>
      <input type="hidden" name={name} value={value} />
      {helperText ? <p className="text-xs text-muted-foreground">{helperText}</p> : null}
    </div>
  );
}
