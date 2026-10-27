"use client";
import { useState } from "react";
import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
export function ShareUnclaimedVendor({ name, url }: { name: string; url: string }) {
  const [message, setMessage] = useState("");
  async function share() {
    const text = `Hi! ${name} was tagged at a party on ShopFia. This business profile is unclaimed. Is this your business? Take a look: ${url}`;
    try {
      if (navigator.share) { await navigator.share({ title: `${name} on ShopFia`, text, url }); }
      else { await navigator.clipboard.writeText(text); setMessage("Invitation copied. Send it to the business owner."); }
    } catch (error) { if (!(error instanceof Error && error.name === "AbortError")) setMessage("Could not share automatically. Copy the profile link from your address bar."); }
  }
  return <div><Button type="button" onClick={share} className="mt-3 gap-2"><Share2 className="h-4 w-4" />Share an invitation</Button>{message ? <p role="status" className="mt-2 text-sm">{message}</p> : null}</div>;
}
