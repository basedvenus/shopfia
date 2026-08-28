"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export function CopyStorefrontLinkButton({
  className,
  label = "Copy Storefront Link",
  style,
  url
}: {
  className?: string;
  label?: string;
  style?: CSSProperties;
  url: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <Button type="button" variant="secondary" className={className ?? "bg-white/92"} style={style} onClick={copyLink}>
      {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      {copied ? "Copied" : label}
    </Button>
  );
}
