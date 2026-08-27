import Constants from "expo-constants";
import * as Linking from "expo-linking";
import type { ExplorePayload, FavoritesPayload, FavoriteTargetType, MessagesPayload, OfferingDetailPayload, VendorDetailPayload } from "../types/shopfia";

const configuredBaseUrl =
  process.env.EXPO_PUBLIC_SHOPFIA_API_URL ||
  (Constants.expoConfig?.extra?.shopfiaApiUrl as string | undefined) ||
  "http://localhost:3000";

export const API_BASE_URL = configuredBaseUrl.replace(/\/$/, "");

type RequestOptions = RequestInit & {
  cookie?: string | null;
  query?: Record<string, string | number | boolean | undefined | null>;
};

export type ApiResult<T> = {
  data: T;
  setCookie: string | null;
};

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<ApiResult<T>> {
  const url = new URL(path, API_BASE_URL);
  Object.entries(options.query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const headers = new Headers(options.headers);
  headers.set("Accept", "application/json");
  if (options.cookie) headers.set("Cookie", options.cookie);

  const response = await fetch(url.toString(), {
    ...options,
    headers
  });
  const setCookie = response.headers.get("set-cookie");
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : `Request failed with ${response.status}`;
    throw new Error(message);
  }

  return { data: data as T, setCookie };
}

export function absoluteImageUrl(path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function openWebsitePath(path: string) {
  return Linking.openURL(`${API_BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`);
}

export function formatCurrency(cents: number | null | undefined) {
  if (!cents) return "Custom pricing";
  return new Intl.NumberFormat("en-US", {
    currency: "USD",
    maximumFractionDigits: 0,
    style: "currency"
  }).format(cents / 100);
}

export function marketplacePathForVendor(slug: string) {
  return `/${slug}`;
}

export function marketplacePathForOffering(id: string) {
  return `/offering/${id}`;
}

export async function getExplore(cookie: string | null, query: { q?: string; categoryId?: string }) {
  return apiRequest<ExplorePayload>("/api/mobile/explore", {
    cookie,
    query
  });
}

export async function getVendorDetail(cookie: string | null, slug: string) {
  return apiRequest<VendorDetailPayload>(`/api/mobile/vendors/${encodeURIComponent(slug)}`, { cookie });
}

export async function getOfferingDetail(cookie: string | null, id: string) {
  return apiRequest<OfferingDetailPayload>(`/api/mobile/offerings/${encodeURIComponent(id)}`, { cookie });
}

export async function getMessages(cookie: string | null) {
  return apiRequest<MessagesPayload>("/api/messages", { cookie });
}

export async function getFavorites(cookie: string | null) {
  return apiRequest<FavoritesPayload>("/api/mobile/favorites", { cookie });
}

export async function toggleFavorite(cookie: string | null, targetType: FavoriteTargetType, targetId: string) {
  return apiRequest<{ saved: boolean; targetId: string; targetType: FavoriteTargetType }>("/api/mobile/favorites", {
    body: JSON.stringify({ action: "toggle", targetId, targetType }),
    cookie,
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
}

export async function createFavoriteCollection(cookie: string | null, name: string) {
  return apiRequest<FavoritesPayload>("/api/mobile/favorites", {
    body: JSON.stringify({ action: "createCollection", name }),
    cookie,
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
}

export async function sendMessage(cookie: string | null, input: { body: string; conversationId?: string; vendorProfileId?: string }) {
  return apiRequest<{ message: { id: string; body: string; createdAt: string } }>("/api/messages", {
    body: JSON.stringify(input),
    cookie,
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
}

export async function acceptQuote(cookie: string | null, quoteId: string) {
  return apiRequest<{ checkoutUrl?: string; paymentIntentClientSecret?: string }>("/api/messages/quotes/accept", {
    body: JSON.stringify({ quoteId }),
    cookie,
    headers: { "Content-Type": "application/json" },
    method: "POST"
  });
}
