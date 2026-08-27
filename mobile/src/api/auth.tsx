import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { apiRequest } from "./client";
import type { ShopFiaSession } from "../types/shopfia";

const COOKIE_KEY = "shopfia.auth.cookies";

type AuthContextValue = {
  booting: boolean;
  cookie: string | null;
  error: string | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  session: ShopFiaSession | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function mergeCookies(current: string | null, incoming: string | null) {
  if (!incoming) return current;
  const jar = new Map<string, string>();

  current?.split(";").forEach((part) => {
    const [name, ...rest] = part.trim().split("=");
    if (name && rest.length) jar.set(name, `${name}=${rest.join("=")}`);
  });

  incoming.split(/,(?=\s*[^;,]+=[^;,]+)/).forEach((cookie) => {
    const pair = cookie.split(";")[0]?.trim();
    const name = pair?.split("=")[0];
    if (!pair || !name) return;
    if (/Max-Age=0|Expires=Thu, 01 Jan 1970/i.test(cookie)) {
      jar.delete(name);
    } else {
      jar.set(name, pair);
    }
  });

  return Array.from(jar.values()).join("; ");
}

async function loadStoredCookie() {
  try {
    return await SecureStore.getItemAsync(COOKIE_KEY);
  } catch {
    return null;
  }
}

async function storeCookie(cookie: string | null) {
  try {
    if (cookie) {
      await SecureStore.setItemAsync(COOKIE_KEY, cookie);
    } else {
      await SecureStore.deleteItemAsync(COOKIE_KEY);
    }
  } catch {
    // SecureStore is unavailable in some web/test environments; auth still works in memory.
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [booting, setBooting] = useState(true);
  const [cookie, setCookieState] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<ShopFiaSession | null>(null);

  const setCookie = useCallback(async (nextCookie: string | null) => {
    setCookieState(nextCookie);
    await storeCookie(nextCookie);
  }, []);

  const refreshSession = useCallback(async () => {
    const result = await apiRequest<ShopFiaSession>("/api/auth/session", { cookie });
    const merged = mergeCookies(cookie, result.setCookie);
    if (merged !== cookie) await setCookie(merged);
    setSession(result.data?.user ? result.data : null);
  }, [cookie, setCookie]);

  useEffect(() => {
    let mounted = true;
    loadStoredCookie()
      .then(async (storedCookie) => {
        if (!mounted) return;
        setCookieState(storedCookie);
        if (storedCookie) {
          const result = await apiRequest<ShopFiaSession>("/api/auth/session", { cookie: storedCookie });
          if (!mounted) return;
          const merged = mergeCookies(storedCookie, result.setCookie);
          setCookieState(merged);
          await storeCookie(merged);
          setSession(result.data?.user ? result.data : null);
        }
      })
      .catch(() => {
        if (mounted) setSession(null);
      })
      .finally(() => {
        if (mounted) setBooting(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setLoading(true);
    setError(null);
    try {
      const csrf = await apiRequest<{ csrfToken: string }>("/api/auth/csrf", { cookie });
      const csrfCookie = mergeCookies(cookie, csrf.setCookie);
      const body = new URLSearchParams({
        callbackUrl: "/",
        csrfToken: csrf.data.csrfToken,
        email,
        json: "true",
        password,
        redirect: "false"
      });

      const signedIn = await apiRequest<{ ok?: boolean; error?: string; url?: string }>(
        "/api/auth/callback/credentials?json=true",
        {
          body: body.toString(),
          cookie: csrfCookie,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          method: "POST"
        }
      );
      const authCookie = mergeCookies(csrfCookie, signedIn.setCookie);
      await setCookie(authCookie);
      const sessionResult = await apiRequest<ShopFiaSession>("/api/auth/session", { cookie: authCookie });
      setSession(sessionResult.data?.user ? sessionResult.data : null);
      if (!sessionResult.data?.user) throw new Error("ShopFia did not return a session for that account.");
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Unable to sign in.";
      setError(message);
      throw reason;
    } finally {
      setLoading(false);
    }
  }, [cookie, setCookie]);

  const signOut = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const csrf = await apiRequest<{ csrfToken: string }>("/api/auth/csrf", { cookie });
      const csrfCookie = mergeCookies(cookie, csrf.setCookie);
      await apiRequest("/api/auth/signout?json=true", {
        body: new URLSearchParams({ csrfToken: csrf.data.csrfToken, json: "true" }).toString(),
        cookie: csrfCookie,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        method: "POST"
      });
    } finally {
      await setCookie(null);
      setSession(null);
      setLoading(false);
    }
  }, [cookie, setCookie]);

  const value = useMemo<AuthContextValue>(() => ({
    booting,
    cookie,
    error,
    loading,
    refreshSession,
    session,
    signIn,
    signOut
  }), [booting, cookie, error, loading, refreshSession, session, signIn, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
