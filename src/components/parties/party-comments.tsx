"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { ProfileImage } from "@/components/account/profile-image";
import type { ImageCrop } from "@/lib/image-crop";
type Comment = { id: string; body: string; createdAt: string; user: { id: string; name: string | null; username: string | null; image?: string | null; imageCrop?: ImageCrop | null }; replies?: Comment[] };

export function PartyComments({ eventId, hostId, signedIn, slug }: { eventId: string; hostId: string; signedIn: boolean; slug: string }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const textarea = useRef<HTMLTextAreaElement>(null);
  const url = `/api/parties/${eventId}/comments`;
  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch(url, { cache: "no-store", signal });
    if (!response.ok) throw new Error("Comments could not be loaded. Please try again.");
    const data = await response.json();
    setComments(data.comments); setLoaded(true);
  }, [url]);
  useEffect(() => {
    const controller = new AbortController();
    const load = () => { void refresh(controller.signal).catch(() => { if (!controller.signal.aborted) setError("Comments could not be loaded. Please try again."); }); };
    load();
    const timer = window.setInterval(load, 10000);
    window.addEventListener("focus", load);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", load); };
  }, [refresh]);
  function renderComment(comment: Comment, isReply = false) {
    const name = comment.user.name ?? comment.user.username ?? "ShopFia member";
    return <article key={comment.id} className={isReply ? "ml-6 border-l border-primary/20 py-3 pl-4" : "border-b py-5"}>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-accent">
          <ProfileImage image={comment.user.image} crop={comment.user.imageCrop} alt={`${name}'s profile photo`} initials={name.slice(0, 1).toUpperCase()} />
        </div>
        {comment.user.username ? <Link className="font-semibold" href={`/profiles/${comment.user.username}`}>{name}</Link> : <span className="font-semibold">{name}</span>}
        {comment.user.id === hostId ? <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Party host</span> : null}
        <time className="text-xs text-muted-foreground" dateTime={comment.createdAt}>{new Date(comment.createdAt).toLocaleDateString()}</time>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{comment.body}</p>
      {signedIn ? <button type="button" className="mt-2 text-sm font-semibold text-primary" onClick={() => { setReplyTo(comment); textarea.current?.focus(); }}>Reply</button> : null}
      {comment.replies?.map((reply) => renderComment(reply, true))}
    </article>;
  }
  return <section id="party-comments" className="rounded-[2rem] border bg-white/90 p-6 shadow-sm md:p-8">
    <h2 className="flex items-center gap-2 text-2xl font-semibold"><MessageCircle className="h-6 w-6" /> Questions & comments</h2>
    <p className="mt-2 text-sm text-muted-foreground">Ask about the party or the vendors behind it.</p>
    <div aria-live="polite">{comments.map((comment) => renderComment(comment))}</div>
    {loaded && !comments.length ? <p className="my-6 text-sm text-muted-foreground">Be the first to start the conversation.</p> : null}
    {!loaded && !error ? <p className="my-6 text-sm text-muted-foreground">Loading comments…</p> : null}
    {signedIn ? <form className="mt-6 space-y-3" onSubmit={async (event) => {
      event.preventDefault(); if (!body.trim() || pending) return;
      setPending(true); setError(null);
      try {
        const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body, parentId: replyTo?.id ?? null }) });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Could not post your comment.");
        setBody(""); setReplyTo(null);
        await refresh();
      } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not post your comment."); }
      finally { setPending(false); }
    }}>
      {replyTo ? <div className="flex items-center justify-between gap-3 text-sm"><span>Replying to {replyTo.user.name ?? replyTo.user.username}</span><button type="button" onClick={() => setReplyTo(null)}>Cancel reply</button></div> : null}
      <textarea ref={textarea} aria-label={replyTo ? "Your reply" : "Your comment"} value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} rows={3} required placeholder={replyTo ? "Write your reply…" : "Ask a question or leave a comment…"} className="w-full rounded-2xl border bg-white p-4 text-sm" />
      <button disabled={pending || !body.trim()} className="rounded-full party-brand-button px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Posting…" : replyTo ? "Post reply" : "Post comment"}</button>
    </form> : <Link href={`/account?callbackUrl=${encodeURIComponent("/events/" + slug + "#party-comments")}`} className="mt-6 inline-flex rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white">Sign in to comment</Link>}
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error} <button type="button" className="underline" onClick={() => { setError(null); void refresh().catch(() => setError("Comments could not be loaded. Please try again.")); }}>Retry</button></p> : null}
  </section>;
}
