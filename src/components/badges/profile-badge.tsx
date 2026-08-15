import { Crown } from "lucide-react";
import type { ProfileBadge as ProfileBadgeData } from "@/lib/profile-badges";
import { cn } from "@/lib/utils";

type ProfileBadgeProps = {
  badge: ProfileBadgeData | null;
  className?: string;
  light?: boolean;
};

export function ProfileBadge({ badge, className, light = false }: ProfileBadgeProps) {
  if (!badge) return null;

  const isFounder = badge.kind === "founder";
  const isOriginalVendor = badge.kind === "original-vendor";
  const label = badge.kind === "original-member" ? "Original" : badge.label;
  const accessibleLabel = badge.label;
  const baseClassName =
    "inline-flex h-6 max-w-max min-w-0 items-center gap-[5px] whitespace-nowrap rounded-full border px-[9px] text-[10px] font-semibold leading-none tracking-[0.14em] shadow-none";

  if (isFounder) {
    return (
      <span
        aria-label={accessibleLabel}
        data-profile-badge={badge.kind}
        className={cn(
          baseClassName,
          "border-[#e8b7bf] bg-[#f6d8dd] text-[#9f5863]",
          light && "border-white/35 bg-white/20 text-white backdrop-blur",
          className
        )}
        title={badge.title}
      >
        <CandleIcon className="h-[11px] w-[11px] shrink-0" />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <span
      aria-label={accessibleLabel}
      data-profile-badge={badge.kind}
      className={cn(
        baseClassName,
        isOriginalVendor
          ? "border-[#d7dfca] bg-[#fbfcf7] text-[#657653]"
          : "border-[#ead8bf] bg-[#fffaf1] text-[#8a6a45]",
        light && "border-white/30 bg-white/15 text-white backdrop-blur",
        className
      )}
      title={badge.title}
    >
      <Crown className="h-[11px] w-[11px] shrink-0" aria-hidden="true" />
      <span>{label}</span>
    </span>
  );
}

function CandleIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8.1 1.4c1.1 1.2 2.1 2.5 2.1 3.7A2.25 2.25 0 0 1 8 7.4 2.25 2.25 0 0 1 5.8 5.1c0-1.2 1.1-2.5 2.3-3.7Z"
        fill="currentColor"
        opacity="0.95"
      />
      <path
        d="M6.35 7.35h3.3c.35 0 .63.28.63.63v5.05c0 .35-.28.63-.63.63h-3.3a.63.63 0 0 1-.63-.63V7.98c0-.35.28-.63.63-.63Z"
        fill="currentColor"
        opacity="0.9"
      />
      <path
        d="M5.3 13.85h5.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.45"
      />
      <path
        d="M7.15 4.95c-.05-.72.38-1.35.85-1.85"
        stroke="#f08ca1"
        strokeLinecap="round"
        strokeWidth="0.9"
      />
    </svg>
  );
}

export function ProfileBadges({
  badges,
  className,
  light = false
}: {
  badges: ProfileBadgeData[];
  className?: string;
  light?: boolean;
}) {
  if (badges.length === 0) return null;

  return (
    <span className={cn("inline-flex min-w-0 flex-wrap items-center gap-1", className)}>
      {badges.map((badge) => (
        <ProfileBadge key={badge.kind} badge={badge} light={light} />
      ))}
    </span>
  );
}
