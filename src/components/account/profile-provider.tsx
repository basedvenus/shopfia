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
  updateProfile: (profile: Partial<SharedUserProfile>) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);

export function ProfileProvider({
  children,
  initialProfile
}: {
  children: ReactNode;
  initialProfile: SharedUserProfile | null;
}) {
  const [profile, setProfile] = useState<SharedUserProfile | null>(initialProfile);

  const value = useMemo<ProfileContextValue>(
    () => ({
      profile,
      setProfile(nextProfile) {
        setProfile(nextProfile);
      },
      updateProfile(nextProfile) {
        setProfile((current) => (current ? { ...current, ...nextProfile } : current));
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
