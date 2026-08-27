import type { ConfigContext, ExpoConfig } from "expo/config";

function googleIosScheme(clientId: string | undefined) {
  const suffix = ".apps.googleusercontent.com";
  if (!clientId?.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
}

function createExpoConfig({ config }: ConfigContext): ExpoConfig {
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const iosScheme = googleIosScheme(googleIosClientId);

  return {
    ...config,
    extra: {
      ...config.extra,
      googleIosClientId,
      shopfiaApiUrl: process.env.EXPO_PUBLIC_SHOPFIA_API_URL?.trim() || "https://www.shopfia.app"
    },
    name: config.name ?? "ShopFia",
    scheme: iosScheme ? ["shopfia", iosScheme] : "shopfia",
    slug: config.slug ?? "shopfia-mobile"
  };
}

export default createExpoConfig;
