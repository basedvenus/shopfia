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

  if (isFounder) {
    return (
      <span
        className={cn(
          "inline-flex h-[22px] max-w-full items-center gap-1 rounded-full border px-1.5 text-[10px] font-bold uppercase leading-none tracking-[0.04em] sm:h-6 sm:px-2 sm:text-[11px]",
          "border-[#f0a8b6] bg-[#f59aad] text-white shadow-[0_7px_16px_rgba(214,72,116,0.18)]",
          light && "border-white/45 bg-white text-[#b85268] shadow-sm backdrop-blur",
          className
        )}
        title={badge.title}
      >
        <CandleIcon className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" />
        <span className="truncate">{badge.label}</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex h-[22px] max-w-full items-center gap-1 rounded-full border px-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.04em] shadow-sm sm:h-6 sm:px-2 sm:text-[11px]",
        isOriginalVendor
          ? "border-[#cddfbd] bg-[#f5fbef] text-[#5f7c4c] shadow-[0_6px_16px_rgba(102,132,76,0.11)]"
          : "border-[#e7d0b4] bg-[#fffaf3] text-[#9b633d] shadow-[0_6px_16px_rgba(180,126,78,0.11)]",
        light && "border-white/30 bg-white/20 text-white shadow-sm backdrop-blur",
        className
      )}
      title={badge.title}
    >
      <Crown className="h-2.5 w-2.5 shrink-0 sm:h-3 sm:w-3" aria-hidden="true" />
      <span className="truncate">{badge.label}</span>
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
