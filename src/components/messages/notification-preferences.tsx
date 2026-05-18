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

export function NotificationPreferences() {
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
        label: "Email notifications"
      },
      {
        description: "Text alerts for time-sensitive vendor leads once SMS is connected.",
        icon: MessageSquareText,
        key: "sms" as const,
        label: "SMS notifications"
      },
      {
        description: browserStatus,
        icon: Bell,
        key: "browser" as const,
        label: "Browser push"
      },
      {
        description: "A soft chime for new messages while ShopFia is open.",
        icon: Volume2,
        key: "sound" as const,
        label: "Soft sound"
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
      playSoftChime();
    }

    setPreferences((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <div className="rounded-[1.75rem] border border-white/80 bg-white/86 p-5 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-[#2f2626]">
        <Bell className="h-4 w-4 text-[#c5837f]" />
        Notification preferences
      </div>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">
        Choose how ShopFia should nudge you when a new inquiry or reply arrives.
      </p>
      <div className="mt-4 grid gap-3">
        {rows.map((row) => {
          const Icon = row.icon;
          const enabled = preferences[row.key];
          return (
            <button
              key={row.key}
              type="button"
              onClick={() => void togglePreference(row.key)}
              className="flex items-start gap-3 rounded-[1.25rem] border border-[#f0dfda] bg-[#fffaf8] p-3 text-left transition hover:bg-white"
            >
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white text-[#c5837f] shadow-sm">
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[#2f2626]">{row.label}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {row.description}
                </span>
              </span>
              <span
                className={`mt-1 h-6 w-11 rounded-full p-1 transition ${
                  enabled ? "bg-[#e3a7a7]" : "bg-[#eadbd7]"
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

function playSoftChime() {
  try {
    const AudioContextCtor = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextCtor) return;
    const context = new AudioContextCtor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.16);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
  } catch {
    // Notification sounds are a progressive enhancement.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
