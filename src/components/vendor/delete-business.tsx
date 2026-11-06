"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteBusinessAction } from "@/app/actions/delete-business";

export function DeleteBusiness({ businessId, name }: { businessId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  return <div className="mt-6 rounded-2xl border border-[#eadbd8] p-5">
    <h3 className="font-semibold">Delete business</h3>
    <p className="mt-2 text-sm text-muted-foreground">Permanently remove this business, its storefront, and services. Parties this business was associated with will still exist. Your personal ShopFia account stays active.</p>
    {!open ? <Button variant="secondary" className="mt-4" onClick={() => setOpen(true)}><Trash2 className="h-4 w-4" />Delete business</Button> :
      <form className="mt-4 grid max-w-lg gap-3" onSubmit={async (event) => {
        event.preventDefault(); setPending(true); setError("");
        try {
          const result = await deleteBusinessAction(businessId, confirmation);
          if (result.error) setError(result.error);
          else { router.replace("/vendor/dashboard"); router.refresh(); }
        } catch { setError("Your business was not deleted. Please try again."); }
        finally { setPending(false); }
      }}>
        <p className="text-sm">This cannot be undone. Businesses with customer history need support-assisted closure to preserve their records.</p>
        <label className="grid gap-2 text-sm">Type {name} to confirm
          <input required value={confirmation} onChange={(e) => setConfirmation(e.target.value)} className="rounded-xl border border-[#eadbd8] bg-white px-3 py-2" autoComplete="off" />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={pending}>{pending ? "Deleting…" : "Permanently delete business"}</Button>
          <Button type="button" variant="secondary" disabled={pending} onClick={() => { setOpen(false); setConfirmation(""); setError(""); }}>Cancel</Button>
        </div>
      </form>}
  </div>;
}
