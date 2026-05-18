"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Mail, MessageSquareText, Volume2 } from "lucide-react";

type PreferenceKey = "email" | "sms" | "browser" | "sound";
type Preferences = Record<PreferenceKey, boolean>;

const storageKey = "shopfia-message-notification-preferences";
const defaultPreferences: Preferences = {
  browser: false,
  email: true,
  sms: false,
  sound: false
};

export function NotificationPreferences({ compact = false }: { compact?: boolean }) {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [browserStatus, setBrowserStatus] = useState<string>("Browser alerts are off.");

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey);
    if (stored) {
      try {
        setPreferences({ ...defaultPreferences, ...JSON.parse(stored) });
      } catch {
        setPreferences(defaultPreferences);
      }
    }

    if ("Notification" in window) {
      setBrowserStatus(
        Notification.permission === "granted"
          ? "Browser alerts are allowed on this device."
          : "Browser alerts need permission from this browser."
      );
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(storageKey, JSON.stringify(preferences));
  }, [preferences]);

  const rows = useMemo(
    () => [
      {
        description: "A polished ShopFia email when a new inquiry or reply arrives.",
        icon: Mail,
        key: "email" as const,
        label: "Email notifications",
        shortLabel: "Email"
      },
      {
        description: "Text alerts for time-sensitive vendor leads once SMS is connected.",
        icon: MessageSquareText,
        key: "sms" as const,
        label: "SMS notifications",
        shortLabel: "SMS"
      },
      {
        description: browserStatus,
        icon: Bell,
        key: "browser" as const,
        label: "Browser push",
        shortLabel: "Push"
      },
      {
        description: "A gentle pop for new messages while ShopFia is open.",
        icon: Volume2,
        key: "sound" as const,
        label: "Soft pop",
        shortLabel: "Sound"
      }
    ],
    [browserStatus]
  );

  async function togglePreference(key: PreferenceKey) {
    if (key === "browser" && !preferences.browser && "Notification" in window) {
      const permission = await Notification.requestPermission();
      setBrowserStatus(
        permission === "granted"
          ? "Browser alerts are allowed on this device."
          : "Browser alerts need permission from this browser."
      );
      if (permission !== "granted") return;
    }

    if (key === "sound" && !preferences.sound) {
      playSoftPop();
    }

    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div className={`rounded-[1.25rem] border border-white/80 bg-white/86 shadow-sm ${compact ? "p-3" : "p-5"}`}>
      <div className="flex items-center gap-2 font-semibold text-[#2f2626]">
        <Bell className="h-4 w-4 text-[#c5837f]" />
        {compact ? "Notifications" : "Notification preferences"}
      </div>
      <p className={`${compact ? "mt-1 text-xs leading-5" : "mt-2 text-sm leading-6"} text-muted-foreground`}>
        Choose how ShopFia should nudge you when a new inquiry or reply arrives.
      </p>
      <div className={`${compact ? "mt-3 grid-cols-2 gap-1.5" : "mt-4 gap-3"} grid`}>
        {rows.map((row) => {
          const Icon = row.icon;
          const enabled = preferences[row.key];
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => void togglePreference(row.key)}
              aria-label={row.label}
              title={row.label}
              className={`flex border text-left transition hover:bg-white ${
                compact
                  ? `min-w-0 items-center justify-between gap-1.5 rounded-full px-2.5 py-2 ${
                      enabled
                        ? "border-[#dfb9b1] bg-[#fff4f0] text-[#8f5f5b] shadow-sm"
                        : "border-[#eadbd3] bg-[#fffdfa] text-[#5f514e]"
                    }`
                  : "items-start gap-3 rounded-[1.25rem] border-[#eadbd3] bg-[#fffdfa] p-3"
              }`}
            >
              <span className={`${compact ? "contents" : "flex items-start gap-3"}`}>
                <span className={`${compact ? "h-6 w-6" : "h-9 w-9"} grid shrink-0 place-items-center rounded-full bg-white text-[#c5837f] shadow-sm`}>
                  <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className={`${compact ? "truncate text-[11px]" : "text-sm"} block font-semibold text-[#2f2626]`}>
                  {compact ? row.shortLabel : row.label}
                </span>
                <span className={`${compact ? "hidden" : "mt-1 block"} text-xs leading-5 text-muted-foreground`}>
                  {row.description}
                </span>
              </span>
              {compact ? (
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${
                    enabled ? "bg-[#d8a39c]" : "bg-[#e5d8d0]"
                  }`}
                />
              ) : null}
              <span
                className={`${compact ? "hidden" : "mt-1"} h-6 w-11 rounded-full p-1 transition ${
                  enabled ? "bg-[#d8a39c]" : "bg-[#e4d9d2]"
                }`}
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white transition ${
                    enabled ? "translate-x-5" : ""
                  }`}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function playSoftPop() {
  try {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(520, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(760, context.currentTime + 0.055);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, context.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.13);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.14);
  } catch {
    // Notification sounds are a progressive enhancement.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
