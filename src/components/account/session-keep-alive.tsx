"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL = 15 * 60 * 1000;
const RETRY_DELAY = 30 * 1000;

/** Renew the HttpOnly cookie through Auth.js, including after iOS suspends a tab. */
export function SessionKeepAlive({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  useEffect(() => {
    let stopped = false;
    let pending = false;
    let lastSuccess = 0;
    let retry: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();

    async function refresh() {
      if (stopped || pending || document.visibilityState === "hidden" || Date.now() - lastSuccess < 60_000) return;
      pending = true;
      try {
        const response = await fetch("/api/auth/session", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal
        });
        if (!response.ok) throw new Error("Session check temporarily unavailable");
        const session = await response.json();
        lastSuccess = Date.now();
        // Recheck server-rendered UI when a previously failed lookup recovers,
        // or a session really expires. Never change login state on a network error.
        if (!stopped && Boolean(session?.user?.id) !== signedIn) router.refresh();
      } catch {
        if (!stopped) retry = setTimeout(refresh, RETRY_DELAY);
      } finally {
        pending = false;
      }
    }
    const resume = () => { void refresh(); };
    void refresh();
    const interval = setInterval(resume, REFRESH_INTERVAL);
    window.addEventListener("focus", resume);
    window.addEventListener("online", resume);
    window.addEventListener("pageshow", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      stopped = true;
      controller.abort();
      clearInterval(interval);
      clearTimeout(retry);
      window.removeEventListener("focus", resume);
      window.removeEventListener("online", resume);
      window.removeEventListener("pageshow", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [router, signedIn]);
  return null;
}
