import { Crown, Flame } from "lucide-react";
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

  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-3 py-1.5 text-[10px] font-semibold uppercase leading-none tracking-[0.28em] shadow-sm",
        isFounder
          ? "border-[#f1a9b3]/70 bg-[linear-gradient(135deg,#ffe8ec,#e995a4)] text-white shadow-[0_8px_24px_rgba(226,132,148,0.28)]"
          : "border-[#eadbc9] bg-[linear-gradient(135deg,#fffaf5,#f4e9dc)] text-[#9b633d] shadow-[0_8px_22px_rgba(180,126,78,0.14)]",
        light && "border-white/30 bg-white/20 text-white shadow-sm backdrop-blur",
        className
      )}
      title={badge.title}
    >
      {isFounder ? (
        <Flame className="h-3 w-3" aria-hidden="true" />
      ) : (
        <Crown className="h-3 w-3" aria-hidden="true" />
      )}
      {badge.label}
    </span>
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
