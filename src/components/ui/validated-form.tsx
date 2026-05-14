"use client";

import type { ComponentProps, FormEvent, ReactNode } from "react";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button, type ButtonProps } from "@/components/ui/button";

type ValidatedFormProps = ComponentProps<"form"> & {
  errorIntro?: string;
};

type MissingField = {
  element: HTMLElement;
  label: string;
};

export function ValidatedForm({
  children,
  className,
  errorIntro = "Please finish the required fields before saving.",
  onSubmit,
  ...props
}: ValidatedFormProps) {
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    clearInvalidFields(event.currentTarget);
    const missing = findMissingField(event.currentTarget);

    if (missing) {
      event.preventDefault();
      const message = `${missing.label} is required`;
      setError(message);
      markInvalidField(missing.element, message);
      missing.element.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => {
        if ("focus" in missing.element) {
          missing.element.focus();
        }
      }, 250);
      return;
    }

    setError(null);
    onSubmit?.(event);
  }

  return (
    <form
      {...props}
      className={className}
      noValidate
      onInput={(event) => clearInvalidField(event.target)}
      onChange={(event) => clearInvalidField(event.target)}
      onSubmit={handleSubmit}
    >
      {error ? (
        <div
          className="rounded-[1.2rem] border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">{error}</p>
              <p className="mt-1 text-xs text-destructive/80">{errorIntro}</p>
            </div>
          </div>
        </div>
      ) : null}
      {children}
    </form>
  );
}

export function RequiredMark() {
  return <span className="text-destructive">*</span>;
}

export function OptionalText() {
  return <span className="text-xs font-normal text-muted-foreground">Optional</span>;
}

export function FieldShell({
  children,
  helperText,
  label,
  optional,
  required
}: {
  children: ReactNode;
  helperText?: string;
  label: string;
  optional?: boolean;
  required?: boolean;
}) {
  return (
    <label className="grid gap-2 text-sm font-medium">
      <span className="flex items-center gap-1">
        {label}
        {required ? <RequiredMark /> : null}
        {optional ? <OptionalText /> : null}
      </span>
      {children}
      {helperText ? (
        <span className="text-xs font-normal leading-5 text-muted-foreground">{helperText}</span>
      ) : null}
    </label>
  );
}

export function SubmitButton({
  children,
  pendingText = "Saving...",
  ...props
}: ButtonProps & {
  pendingText?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <Button {...props} disabled={pending || props.disabled}>
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {pendingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

function findMissingField(form: HTMLFormElement): MissingField | null {
  const fields = Array.from(
    form.querySelectorAll<HTMLElement>("[data-required-label]")
  );

  for (const field of fields) {
    if (isMissing(field)) {
      return {
        element: field,
        label: field.dataset.requiredLabel ?? field.getAttribute("name") ?? "This field"
      };
    }
  }

  return null;
}

function isMissing(field: HTMLElement) {
  if (field instanceof HTMLInputElement) {
    if (field.type === "checkbox" || field.type === "radio") {
      return !field.checked;
    }
    return !field.value.trim();
  }

  if (field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement) {
    return !field.value.trim();
  }

  return false;
}

function clearInvalidFields(form: HTMLFormElement) {
  form.querySelectorAll<HTMLElement>("[data-validation-invalid='true']").forEach((field) => {
    field.removeAttribute("data-validation-invalid");
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
    field.classList.remove(
      "border-destructive",
      "ring-2",
      "ring-destructive/20",
      "focus-visible:ring-destructive"
    );
  });
  form.querySelectorAll("[data-validation-message='true']").forEach((message) => {
    message.remove();
  });
}

function clearInvalidField(target: EventTarget | null) {
  if (!(target instanceof HTMLElement) || target.dataset.validationInvalid !== "true") {
    return;
  }

  target.removeAttribute("data-validation-invalid");
  target.removeAttribute("aria-invalid");
  target.removeAttribute("aria-describedby");
  target.classList.remove(
    "border-destructive",
    "ring-2",
    "ring-destructive/20",
    "focus-visible:ring-destructive"
  );

  const message = target.nextElementSibling;
  if (message?.getAttribute("data-validation-message") === "true") {
    message.remove();
  }
}

function markInvalidField(field: HTMLElement, message: string) {
  field.dataset.validationInvalid = "true";
  field.setAttribute("aria-invalid", "true");
  field.classList.add(
    "border-destructive",
    "ring-2",
    "ring-destructive/20",
    "focus-visible:ring-destructive"
  );

  const messageId = `${field.getAttribute("name") ?? "field"}-error`;
  const messageElement = document.createElement("p");
  messageElement.id = messageId;
  messageElement.dataset.validationMessage = "true";
  messageElement.className = cn("text-xs font-normal text-destructive");
  messageElement.textContent = message;
  field.setAttribute("aria-describedby", messageId);
  field.insertAdjacentElement("afterend", messageElement);
}
