"use client";

import { useRef, useState, type ReactNode, type FormEvent } from "react";
import { ValidatedForm } from "@/components/ui/validated-form";
import { Textarea } from "@/components/ui/textarea";

export function BusinessDescription({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return <>
    <Textarea name="bio" value={value} onChange={(event) => setValue(event.target.value)} placeholder="Describe your business here" className="min-h-[120px]" aria-describedby="business-description-count" aria-invalid={value.length > 600} />
    <span id="business-description-count" className={value.length > 600 ? "text-sm text-destructive" : "text-xs text-muted-foreground"} aria-live="polite">
      {value.length} / 600 characters{value.length > 600 ? ` — remove ${value.length - 600} characters to save.` : ""}
    </span>
  </>;
}

export function BusinessProfileForm({ children, action, className, errorIntro }: {
  children: ReactNode;
  action: (data: FormData) => Promise<{ error: string }>;
  className?: string;
  errorIntro?: string;
}) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const submitting = useRef(false);
  const alert = useRef<HTMLDivElement>(null);
  function showError(message: string) {
    setError(message);
    requestAnimationFrame(() => { alert.current?.focus(); alert.current?.scrollIntoView({ block: "center", behavior: "smooth" }); });
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    if (String(data.get("bio") ?? "").length > 600) {
      showError("Business description must be 600 characters or fewer. Shorten it and save again. Your entries are still here.");
      return;
    }
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const result = await action(data);
      if (result?.error) showError(result.error);
    } catch {
      showError("We couldn’t confirm the save. Your entries are still here. Check your connection and try again.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }
  return <ValidatedForm className={className} errorIntro={errorIntro} onSubmit={submit} aria-busy={pending}>
    {error && <div ref={alert} tabIndex={-1} role="alert" className="md:col-span-2 rounded-2xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}
    {pending && <p role="status" className="md:col-span-2 text-sm text-muted-foreground">Saving business…</p>}
    <fieldset disabled={pending} className="contents">{children}</fieldset>
  </ValidatedForm>;
}
