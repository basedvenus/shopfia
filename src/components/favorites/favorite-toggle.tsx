import { Heart } from "lucide-react";
import { toggleFavoriteAction, type FavoriteTargetType } from "@/app/actions/favorites";
import { Button } from "@/components/ui/button";

type FavoriteToggleProps = {
  isSaved?: boolean;
  label?: string;
  targetId: string;
  targetType: FavoriteTargetType;
  variant?: "floating" | "icon" | "pill";
};

export function FavoriteToggle({
  isSaved = false,
  label,
  targetId,
  targetType,
  variant = "icon"
}: FavoriteToggleProps) {
  async function toggle() {
    "use server";

    await toggleFavoriteAction(targetType, targetId);
  }

  if (variant === "pill") {
    return (
      <form action={toggle}>
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          className="h-8 min-h-8 rounded-full bg-white/90 px-3 text-[13px] shadow-sm hover:bg-white sm:h-9 sm:min-h-9 sm:px-3.5 sm:text-sm"
          aria-pressed={isSaved}
        >
          <Heart className={`h-4 w-4 ${isSaved ? "fill-current text-primary" : ""}`} />
          {label ?? (isSaved ? "Saved" : "Save")}
        </Button>
      </form>
    );
  }

  if (variant === "floating") {
    return (
      <form action={toggle}>
        <button
          type="submit"
          className="grid h-[34px] w-[34px] place-items-center rounded-full border border-white/75 bg-white/90 text-foreground shadow-[0_4px_14px_rgba(47,38,38,0.16)] backdrop-blur transition hover:bg-white sm:h-[40px] sm:w-[40px]"
          aria-label={label ?? (isSaved ? "Unsave" : "Save")}
          aria-pressed={isSaved}
        >
          <Heart className={`h-[17px] w-[17px] sm:h-[18px] sm:w-[18px] ${isSaved ? "fill-current text-primary" : ""}`} />
        </button>
      </form>
    );
  }

  return (
    <form action={toggle}>
      <button
        type="submit"
        className="grid h-9 w-9 place-items-center rounded-full border border-white/80 bg-white/90 text-foreground shadow-sm backdrop-blur transition hover:scale-105 hover:bg-white sm:h-10 sm:w-10"
        aria-label={label ?? (isSaved ? "Unsave" : "Save")}
        aria-pressed={isSaved}
      >
        <Heart className={`h-4 w-4 ${isSaved ? "fill-current text-primary" : ""}`} />
      </button>
    </form>
  );
}
