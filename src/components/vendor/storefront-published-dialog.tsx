"use client";

import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Copy, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StorefrontPublishedDialog({ published, businessId, publicUrl }: {
  published: boolean; businessId: string; publicUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const storageKey = `shopfia:storefront-link-shown:${businessId}`;
  useEffect(() => {
    if (!published) return;
    try { if (localStorage.getItem(storageKey)) return; } catch { /* Private browsing still permits the dialog. */ }
    setOpen(true);
  }, [published, storageKey]);
  function changeOpen(next: boolean) {
    setOpen(next);
    if (!next) {
      try { localStorage.setItem(storageKey, "1"); } catch { /* Storage is optional. */ }
      // Avoid reopening the success message when refreshing this editor page.
      const url = new URL(window.location.href);
      url.searchParams.delete("published");
      window.history.replaceState(window.history.state, "", url);
    }
  }
  async function copyLink() {
    try { await navigator.clipboard.writeText(publicUrl); setMessage("Link copied!"); }
    catch { setMessage("Select the link above to copy it manually."); }
  }
  return <Dialog.Root open={open} onOpenChange={changeOpen}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-stone-900/25 backdrop-blur-sm" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-[#eadbd8] bg-[#fffaf7] p-6 shadow-xl sm:p-8">
        <Dialog.Close className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground" aria-label="Close"><X size={18}/></Dialog.Close>
        <div className="mb-4 text-4xl" aria-hidden="true">🍰</div>
        <Dialog.Title className="text-2xl font-semibold tracking-tight">Your storefront is live!</Dialog.Title>
        <Dialog.Description className="mt-3 text-sm leading-6 text-muted-foreground">
          Add your ShopFia link to your social media bios so customers can explore your services and send booking inquiries. Completed ShopFia bookings can earn verified reviews that help your business get discovered.
        </Dialog.Description>
        <label className="mt-5 block text-sm font-medium">Your storefront link
          <input readOnly value={publicUrl} onFocus={event=>event.target.select()} className="mt-2 w-full rounded-xl border border-[#eadbd8] bg-white px-3 py-3 text-sm" />
        </label>
        <p role="status" className="min-h-6 pt-1 text-sm text-muted-foreground">{message}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" onClick={copyLink}><Copy size={16}/>Copy link</Button>
          <Button asChild variant="secondary"><a href={publicUrl} target="_blank" rel="noopener noreferrer" onClick={()=>changeOpen(false)}>View storefront</a></Button>
          <Dialog.Close asChild><Button variant="ghost">Maybe later</Button></Dialog.Close>
        </div>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
