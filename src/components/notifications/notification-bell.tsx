"use client";
import Link from "next/link";
import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
export function NotificationBell({ userId }: { userId: string }) {
  const [count, setCount] = useState(0);
  const pathname = usePathname();
  useEffect(() => {
    let controller: AbortController | null = null;
    let stopped = false;
    setCount(0);
    async function refresh() {
      if (document.visibilityState !== "visible" || controller) return;
      controller = new AbortController();
      try {
        const response = await fetch("/api/notifications", { signal: controller.signal, cache: "no-store" });
        if (response.ok) {
          const body = await response.json();
          if (!stopped && Number.isFinite(body.unreadCount)) setCount(body.unreadCount);
        }
      } catch { /* A later focus or polling cycle retries. */ }
      finally { controller = null; }
    }
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => { stopped = true; controller?.abort(); window.clearInterval(interval); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [userId, pathname]);
  return <Link href="/notifications" aria-label={count ? `Notifications, ${count} unread` : "Notifications"} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border bg-white hover:bg-muted">
    <Bell className="h-4 w-4" />
    {count > 0 ? <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-white">{count > 99 ? "99+" : count}</span> : null}
  </Link>;
}
