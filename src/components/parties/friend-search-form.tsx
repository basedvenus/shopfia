"use client";

import { type ReactNode, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";

export function FriendSearchForm({ children }: { children: ReactNode }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function search(form: HTMLFormElement) {
    const params = new URLSearchParams();
    new FormData(form).forEach((value, key) => {
      if (typeof value === "string" && value.trim()) params.set(key, value.trim());
    });
    const query = params.toString();
    startTransition(() => router.replace(query ? `/parties?${query}` : "/parties", { scroll: false }));
  }

  return (
    <form action="/parties" className="mt-4 flex flex-col gap-2 sm:flex-row" aria-busy={isPending}
      onChange={(event) => {
        const form = event.currentTarget;
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => search(form), 300);
      }}
      onSubmit={(event) => {
        event.preventDefault();
        if (timer.current) clearTimeout(timer.current);
        search(event.currentTarget);
      }}>
      {children}
      <span role="status" className="sr-only">{isPending ? "Searching people…" : ""}</span>
    </form>
  );
}
