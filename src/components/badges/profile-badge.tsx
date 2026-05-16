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

  if (isFounder) {
    return (
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full border border-[#f2a1b0]/70 bg-[linear-gradient(92deg,#f9a8b8_0%,#ee7f99_55%,#de6f8d_100%)] py-1 pl-1 pr-3 text-[9.5px] font-semibold uppercase leading-none tracking-[0.22em] text-white shadow-[0_6px_18px_rgba(214,72,116,0.18),inset_0_1px_0_rgba(255,255,255,0.55)] ring-1 ring-white/45",
          light && "border-white/40 bg-white/25 shadow-sm backdrop-blur",
          className
        )}
        title={badge.title}
      >
        <span className="grid h-5 w-5 place-items-center rounded-full border border-white/45 bg-white/12 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
          <CandleIcon className="h-[13px] w-[13px]" />
        </span>
        {badge.label}
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.28em] shadow-sm",
        "border-[#eadbc9] bg-[linear-gradient(135deg,#fffaf5,#f4e9dc)] text-[#9b633d] shadow-[0_8px_22px_rgba(180,126,78,0.14)]",
        light && "border-white/30 bg-white/20 text-white shadow-sm backdrop-blur",
        className
      )}
      title={badge.title}
    >
      <Crown className="h-3 w-3" aria-hidden="true" />
      {badge.label}
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
    <span className={cn("inline-flex flex-wrap items-center gap-2", className)}>
      {badges.map((badge) => (
        <ProfileBadge key={badge.kind} badge={badge} light={light} />
      ))}
    </span>
  );
}
