import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { createFavoriteCollection, getFavorites, toggleFavorite } from "./client";
import { useAuth } from "./auth";
import type { FavoritesPayload, FavoriteTargetType } from "../types/shopfia";

const emptyFavorites: FavoritesPayload = {
  collections: [],
  favorites: [],
  savedIds: { offerings: [], parties: [], vendors: [] }
};

type FavoritesContextValue = {
  createCollection: (name: string) => Promise<void>;
  error: string | null;
  isBusy: (targetType: FavoriteTargetType, targetId: string) => boolean;
  isSaved: (targetType: FavoriteTargetType, targetId: string) => boolean;
  loading: boolean;
  payload: FavoritesPayload;
  refresh: () => Promise<void>;
  toggle: (targetType: FavoriteTargetType, targetId: string) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

function savedIdsKey(targetType: FavoriteTargetType) {
  if (targetType === "vendor") return "vendors" as const;
  if (targetType === "party") return "parties" as const;
  return "offerings" as const;
}

export function FavoritesProvider({ children }: PropsWithChildren) {
  const { cookie, session } = useAuth();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [payload, setPayload] = useState<FavoritesPayload>(emptyFavorites);

  const refresh = useCallback(async () => {
    if (!session?.user) {
      setPayload(emptyFavorites);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getFavorites(cookie);
      setPayload(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to load favorites.");
    } finally {
      setLoading(false);
    }
  }, [cookie, session?.user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = useCallback(async (targetType: FavoriteTargetType, targetId: string) => {
    if (!session?.user) throw new Error("Sign in to save favorites.");
    const key = `${targetType}:${targetId}`;
    setBusyKey(key);
    setError(null);
    try {
      await toggleFavorite(cookie, targetType, targetId);
      const result = await getFavorites(cookie);
      setPayload(result.data);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to update favorites.";
      setError(message);
      throw reason;
    } finally {
      setBusyKey(null);
    }
  }, [cookie, session?.user]);

  const createCollection = useCallback(async (name: string) => {
    if (!session?.user) throw new Error("Sign in to create a collection.");
    setLoading(true);
    setError(null);
    try {
      const result = await createFavoriteCollection(cookie, name);
      setPayload(result.data);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to create that collection.";
      setError(message);
      throw reason;
    } finally {
      setLoading(false);
    }
  }, [cookie, session?.user]);

  const value = useMemo<FavoritesContextValue>(() => ({
    createCollection,
    error,
    isBusy: (targetType, targetId) => busyKey === `${targetType}:${targetId}`,
    isSaved: (targetType, targetId) => payload.savedIds[savedIdsKey(targetType)].includes(targetId),
    loading,
    payload,
    refresh,
    toggle
  }), [busyKey, createCollection, error, loading, payload, refresh, toggle]);

  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites must be used inside FavoritesProvider");
  return context;
}
