"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Trash2 } from "lucide-react";
import { deletePartyEventAction } from "@/app/actions/party-events";
import { Button } from "@/components/ui/button";

export function DeletePartyButton({ eventId, title, compact = false }: { eventId: string; title: string; compact?: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const cancelRef = useRef<HTMLButtonElement>(null);

  async function confirmDelete() {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const result = await deletePartyEventAction(eventId);
      if (!result.ok) { setError(result.error ?? "Your party could not be deleted. Please try again."); return; }
      setOpen(false);
      router.push("/my-parties");
      router.refresh();
    } catch {
      setError("Your party could not be deleted. Please try again.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return <Dialog.Root open={open} onOpenChange={(next) => { if (!pending) { setOpen(next); setError(null); } }}>
    <Dialog.Trigger asChild><Button type="button" size="sm" variant="secondary" aria-label={`Delete party: ${title}`} className="border-destructive/25 bg-white text-destructive hover:bg-red-50" onClick={() => { setError(null); setOpen(true); }}><Trash2 className="h-4 w-4" />{compact ? "Delete" : "Delete party"}</Button></Dialog.Trigger>
    {open ? <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-sm" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-[91] max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 overflow-y-auto rounded-3xl border bg-white p-6 shadow-xl outline-none" onOpenAutoFocus={(event) => { event.preventDefault(); cancelRef.current?.focus(); }}>
        <Dialog.Title className="text-xl font-semibold">Delete this party?</Dialog.Title>
        <Dialog.Description className="text-sm leading-6 text-muted-foreground">“{title}” will be permanently deleted, including its uploaded photos, comments, invitations, and guest contributions. It will disappear from profiles and saved parties. This can’t be undone.</Dialog.Description>
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        <div className="flex flex-wrap justify-end gap-3">
          <Button ref={cancelRef} type="button" variant="secondary" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" variant="destructive" disabled={pending} onClick={() => void confirmDelete()}>{pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}{pending ? "Deleting…" : "Delete party"}</Button>
        </div>
      </Dialog.Content>
    </Dialog.Portal> : null}
  </Dialog.Root>;
}
