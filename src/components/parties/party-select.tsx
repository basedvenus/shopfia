"use client";

import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = {
  label: string;
  options: Array<{value: string; label: string}>;
  placeholder?: string;
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  required?: boolean;
  compact?: boolean;
};

export function PartySelect({label, options, placeholder = "Choose an option", name, value, defaultValue, onChange, required, compact}: Props) {
  const [selected, setSelected] = useState(defaultValue ?? "");
  return <Select name={name} value={value ?? selected} onValueChange={onChange ?? setSelected} required={required}>
    <SelectTrigger aria-label={label} className={`${compact ? "h-10 w-24" : "h-12 w-full"} min-w-0 rounded-2xl border-border bg-[#faf9f8] text-left font-normal outline-none focus:ring-2 focus:ring-primary/25`}><SelectValue placeholder={placeholder} /></SelectTrigger>
    <SelectContent position="popper" sideOffset={6} className="z-[100] max-h-64 w-[var(--radix-select-trigger-width)] overflow-y-auto rounded-2xl border-border bg-white p-1.5 shadow-soft">
      {options.map(option => <SelectItem key={option.value} value={option.value} className="rounded-xl text-foreground data-[highlighted]:bg-[#f2f1ef] data-[state=checked]:bg-[#f7f2f1]">{option.label}</SelectItem>)}
    </SelectContent>
  </Select>;
}
