import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import Constants, { ExecutionEnvironment } from "expo-constants";
import * as AuthSession from "expo-auth-session";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { ApiError, apiRequest, exchangeGoogleIdToken } from "./client";
import type { ShopFiaSession } from "../types/shopfia";

const COOKIE_KEY = "shopfia.auth.cookies";
const GOOGLE_DISCOVERY = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token"
};

WebBrowser.maybeCompleteAuthSession();

type AuthContextValue = {
  booting: boolean;
  cookie: string | null;
  error: string | null;
  googleAvailable: boolean;
  googleConfigurationMessage: string | null;
  loading: boolean;
  refreshSession: () => Promise<void>;
  session: ShopFiaSession | null;
  signInWithGoogle: () => Promise<void>;
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
  const googleIosClientId = (
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ||
    (Constants.expoConfig?.extra?.googleIosClientId as string | undefined) ||
    ""
  ).trim();
  const googleScheme = googleIosClientId.endsWith(".apps.googleusercontent.com")
    ? `com.googleusercontent.apps.${googleIosClientId.slice(0, -".apps.googleusercontent.com".length)}`
    : "";
  const runningInExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
  const googleConfigurationMessage = runningInExpoGo
    ? "Google sign-in cannot run in Expo Go. Install the ShopFia development build on this iPhone."
    : !googleIosClientId || !googleScheme
      ? "This build is missing its Google iOS client ID. Rebuild ShopFia after configuring Google OAuth."
      : null;

  const setCookie = useCallback(async (nextCookie: string | null) => {
    setCookieState(nextCookie);
    await storeCookie(nextCookie);
  }, []);

  const refreshSession = useCallback(async () => {
    setError(null);
    try {
      const result = await apiRequest<ShopFiaSession>("/api/auth/session", { cookie });
      const merged = mergeCookies(cookie, result.setCookie);
      if (merged !== cookie) await setCookie(merged);
      setSession(result.data?.user ? result.data : null);
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) {
        await setCookie(null);
        setSession(null);
        return;
      }
      setError("ShopFia could not restore your session. Check your connection and try again.");
      throw reason;
    }
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
      .catch(async (reason) => {
        if (!mounted) return;
        setSession(null);
        if (reason instanceof ApiError && reason.status === 401) {
          setCookieState(null);
          await storeCookie(null);
        } else {
          setError("ShopFia could not restore your session. Check your connection and try again.");
        }
      })
      .finally(() => {
        if (mounted) setBooting(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (googleConfigurationMessage) throw new Error(googleConfigurationMessage);

    setLoading(true);
    setError(null);
    try {
      const redirectUri = `${googleScheme}:/oauthredirect`;
      const request = new AuthSession.AuthRequest({
        clientId: googleIosClientId,
        prompt: AuthSession.Prompt.SelectAccount,
        redirectUri,
        responseType: AuthSession.ResponseType.Code,
        scopes: ["openid", "profile", "email"],
        usePKCE: true
      });
      const result = await request.promptAsync(GOOGLE_DISCOVERY);

      if (result.type === "cancel" || result.type === "dismiss") return;
      if (result.type !== "success" || !result.params.code || !request.codeVerifier) {
        throw new Error("Google sign-in was not completed.");
      }

      const tokens = await AuthSession.exchangeCodeAsync({
        clientId: googleIosClientId,
        code: result.params.code,
        extraParams: { code_verifier: request.codeVerifier },
        redirectUri
      }, GOOGLE_DISCOVERY);
      if (!tokens.idToken) throw new Error("Google did not return a verified identity.");

      const signedIn = await exchangeGoogleIdToken(tokens.idToken);
      const authCookie = mergeCookies(cookie, signedIn.data.sessionCookie || signedIn.setCookie);
      if (!authCookie || !signedIn.data.session?.user) {
        throw new Error("ShopFia did not return a session for this Google account.");
      }
      await setCookie(authCookie);
      setSession(signedIn.data.session);
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "Google sign-in could not be completed.";
      setError(message);
      throw reason;
    } finally {
      setLoading(false);
    }
  }, [cookie, googleConfigurationMessage, googleIosClientId, googleScheme, setCookie]);

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
    } catch {
      // Clearing the device cookie still signs this installation out if the network is unavailable.
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
    googleAvailable: !googleConfigurationMessage,
    googleConfigurationMessage,
    loading,
    refreshSession,
    session,
    signInWithGoogle,
    signOut
  }), [booting, cookie, error, googleConfigurationMessage, loading, refreshSession, session, signInWithGoogle, signOut]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
