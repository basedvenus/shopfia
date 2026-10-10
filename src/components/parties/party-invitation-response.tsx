"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updatePartyCollaborationAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";

export function PartyInvitationResponse({ collaborationId, mode = "invitation" }: {
  collaborationId: string;
  mode?: "invitation" | "accepted";
}) {
  const router = useRouter();
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "accept" | "decline" | "remove") {
    if (submitting.current) return;
    submitting.current = true;
    setPending(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.set("collaborationId", collaborationId);
      formData.set("action", action);
      const result = await updatePartyCollaborationAction(formData);
      if (!result.ok) {
        setError(result.error ?? "This collaboration could not be updated. Refresh and try again.");
        return;
      }
      router.refresh();
    } catch {
      setError("This collaboration could not be updated. Refresh and try again.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {mode === "accepted" ? (
          <Button type="button" variant="secondary" disabled={pending} onClick={() => void respond("remove")}>
            Leave party
          </Button>
        ) : (
          <>
            <Button type="button" disabled={pending} onClick={() => void respond("accept")}>
              Accept
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => void respond("decline")}>
              Decline
            </Button>
          </>
        )}
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
