"use client";

import { CheckCircle2, CircleDashed } from "lucide-react";

type ReadinessItem = {
  complete: boolean;
  label: string;
  targetId: string;
};

export function ReadinessChecklist({ items }: { items: ReadinessItem[] }) {
  function jumpToSection(targetId: string) {
    const target = document.getElementById(targetId);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    target.classList.remove("shopfia-readiness-highlight");
    window.setTimeout(() => {
      target.classList.add("shopfia-readiness-highlight");
      window.setTimeout(() => target.classList.remove("shopfia-readiness-highlight"), 1700);
    }, 360);
  }

  return (
    <>
      <style jsx global>{`
        .shopfia-readiness-highlight {
          animation: shopfia-readiness-glow 1.7s ease both;
        }

        @keyframes shopfia-readiness-glow {
          0% {
            box-shadow: 0 0 0 0 rgba(216, 163, 156, 0);
          }
          28% {
            box-shadow: 0 0 0 6px rgba(216, 163, 156, 0.16), 0 18px 60px rgba(216, 163, 156, 0.18);
          }
          100% {
            box-shadow: 0 18px 50px rgba(72, 44, 43, 0.07);
          }
        }
      `}</style>
      <div className="mt-5 space-y-3">
        {items.map((item) => (
          <button
            key={`${item.label}-${item.targetId}`}
            type="button"
            onClick={() => jumpToSection(item.targetId)}
            className="group flex w-full items-center justify-between gap-3 rounded-[1.1rem] border border-[#eadbd8] bg-white p-3 text-left transition hover:-translate-y-0.5 hover:border-[#dfc7be] hover:shadow-[0_14px_30px_rgba(72,44,43,0.09)]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              {item.complete ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#6f9463]" />
              ) : (
                <CircleDashed className="h-4 w-4 shrink-0 text-[#b87974]" />
              )}
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-[#332827]">{item.label}</span>
                <span className="text-[11px] font-medium text-muted-foreground group-hover:text-[#9b6b65]">
                  Jump to setup section
                </span>
              </span>
            </span>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${item.complete ? "bg-[#e5f4df] text-[#507343]" : "bg-[#f8ece9] text-primary"}`}>
              {item.complete ? "Ready" : "Needs detail"}
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
