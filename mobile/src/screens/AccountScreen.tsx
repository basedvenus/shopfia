import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { API_BASE_URL, openWebsitePath } from "../api/client";
import { useAuth } from "../api/auth";
import { EmptyState } from "../components/EmptyState";
import { ShopFiaLogo } from "../components/ShopFiaLogo";
import { colors, radii, screen, spacing } from "../theme";

export function AccountScreen() {
  const { error, loading, session, signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function submit() {
    setLocalError(null);
    try {
      await signIn(email.trim(), password);
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : "Unable to sign in.");
    }
  }

  if (session?.user) {
    return (
      <View style={styles.container}>
        <ShopFiaLogo />
        <View style={styles.card}>
          <Text style={styles.title}>{session.user.name || session.user.username || "ShopFia member"}</Text>
          <Text style={styles.subtitle}>{session.user.email}</Text>
          <Text style={styles.detail}>Signed in with the existing ShopFia account system.</Text>
          <Pressable style={styles.secondaryButton} onPress={() => openWebsitePath("/account")}>
            <Text style={styles.secondaryButtonText}>Open account settings</Text>
          </Pressable>
          <Pressable style={styles.button} onPress={signOut} disabled={loading}>
            {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.buttonText}>Sign out</Text>}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ShopFiaLogo />
      <View style={styles.card}>
        <Text style={styles.title}>Sign in to ShopFia</Text>
        <Text style={styles.subtitle}>Use the same email and password you use on {API_BASE_URL}.</Text>
        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.mutedForeground}
          style={styles.input}
          value={email}
        />
        <TextInput
          autoComplete="password"
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={colors.mutedForeground}
          secureTextEntry
          style={styles.input}
          value={password}
        />
        {localError || error ? <Text style={styles.error}>{localError ?? error}</Text> : null}
        <Pressable style={styles.button} onPress={submit} disabled={loading}>
          {loading ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={styles.buttonText}>Sign in</Text>}
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => openWebsitePath("/account")}>
          <Text style={styles.secondaryButtonText}>Create account or reset password</Text>
        </Pressable>
      </View>
      <EmptyState
        title="Connected foundation"
        body="Marketplace browsing uses ShopFia data, messages use the existing protected API, and accepted quote checkout can continue through the current Stripe-backed web flow."
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    padding: screen.horizontal
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  title: {
    color: colors.foreground,
    fontSize: 24,
    fontWeight: "900"
  },
  subtitle: {
    color: colors.mutedForeground,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20
  },
  detail: {
    color: colors.foreground,
    fontSize: 15,
    lineHeight: 22
  },
  input: {
    backgroundColor: "#fff",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.foreground,
    fontSize: 15,
    minHeight: 50,
    paddingHorizontal: spacing.md
  },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 50,
    justifyContent: "center"
  },
  buttonText: {
    color: colors.primaryForeground,
    fontSize: 15,
    fontWeight: "900"
  },
  secondaryButton: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.md
  },
  secondaryButtonText: {
    color: colors.foreground,
    fontSize: 14,
    fontWeight: "800",
    textAlign: "center"
  },
  error: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700"
  }
});
