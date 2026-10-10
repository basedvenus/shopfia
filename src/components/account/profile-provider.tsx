"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import type { SharedUserProfile } from "@/lib/user-profile";

type ProfileContextValue = {
  profile: SharedUserProfile | null;
  setProfile: (profile: SharedUserProfile | null) => void;
  updateProfile: (profile: Partial<SharedUserProfile>, expectedId?: string) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({
  children,
  initialProfile
}: {
  children?: ReactNode;
  initialProfile: SharedUserProfile | null;
}) {
  const [profile, setProfile] = useState<SharedUserProfile | null>(initialProfile);
  const [serverProfile, setServerProfile] = useState(initialProfile);

  // Layouts persist across navigation. Apply refreshed server data before children
  // render, so the onboarding gate never acts on the previous account/profile.
  if (serverProfile !== initialProfile) {
    setServerProfile(initialProfile);
    setProfile(initialProfile);
  }

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      setProfile(nextProfile) {
        setProfile(nextProfile);
      },
      updateProfile(nextProfile, expectedId) {
        setProfile((current) => (
          current && (!expectedId || current.id === expectedId)
            ? { ...current, ...nextProfile }
            : current
        ));
      }
    }),
    [profile]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfile must be used inside ProfileProvider.");
  }

  return context;
}
