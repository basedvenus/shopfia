import { Sparkles } from "lucide-react";
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
        "inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold leading-none tracking-[0.08em]",
        isFounder
          ? "border-[#efc4c4]/70 bg-[#fde9e7] text-[#9f5f64]"
          : "border-[#dcd0f2]/70 bg-[#f0eafa] text-[#6f5d90]",
        light && "border-white/30 bg-white/20 text-white shadow-sm backdrop-blur",
        className
      )}
      title={badge.title}
    >
      {isFounder ? <Sparkles className="h-3 w-3" aria-hidden="true" /> : null}
      {badge.label}
    </span>
  );
}
