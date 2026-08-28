import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useAuth } from "../api/auth";
import { ShopFiaLogo } from "../components/ShopFiaLogo";
import { colors, fonts, radii, screen, spacing } from "../theme";

export function AccountScreen() {
  const {
    error,
    googleAvailable,
    googleConfigurationMessage,
    loading,
    refreshSession,
    session,
    signInWithGoogle,
    signInWithPassword,
    signOut
  } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  async function startPasswordSignIn() {
    setLocalError(null);
    if (!email.trim() || !password) {
      setLocalError("Enter your ShopFia email and password.");
      return;
    }
    try {
      await signInWithPassword(email, password);
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : "Email sign-in could not be completed.");
    }
  }

  async function startGoogleSignIn() {
    setLocalError(null);
    try {
      await signInWithGoogle();
    } catch (reason) {
      setLocalError(reason instanceof Error ? reason.message : "Google sign-in could not be completed.");
    }
  }

  async function retrySession() {
    setLocalError(null);
    try {
      await refreshSession();
    } catch {
      setLocalError("ShopFia still cannot reach the hosted account service.");
    }
  }

  if (session?.user) {
    return (
      <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
        <ShopFiaLogo />
        <View style={styles.card}>
          <View style={styles.accountIcon}>
            <Ionicons color={colors.primary} name="person-outline" size={24} />
          </View>
          <Text style={styles.title}>{session.user.name || session.user.username || "ShopFia member"}</Text>
          <Text style={styles.subtitle}>{session.user.email}</Text>
          <Text style={styles.detail}>Signed in with your existing ShopFia account.</Text>
          <Pressable accessibilityRole="button" disabled={loading} onPress={signOut} style={styles.primaryButton}>
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={styles.primaryButtonText}>Sign out</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  const visibleError = localError || error;

  return (
    <ScrollView contentContainerStyle={styles.container} contentInsetAdjustmentBehavior="automatic">
      <ShopFiaLogo />
      <View style={styles.card}>
        <Text style={styles.title}>Sign in to ShopFia</Text>
        <Text style={styles.subtitle}>
          Sign in to favorite vendors, message, request quotes, and book.
        </Text>
        <View style={styles.introPanel}>
          <Text style={styles.introText}>
            Use the same email and password you already use on the ShopFia website.
          </Text>
        </View>

        <TextInput
          autoCapitalize="none"
          autoComplete="email"
          editable={!loading}
          keyboardType="email-address"
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="next"
          style={styles.input}
          textContentType="emailAddress"
          value={email}
        />
        <TextInput
          autoCapitalize="none"
          autoComplete="current-password"
          editable={!loading}
          onChangeText={setPassword}
          onSubmitEditing={startPasswordSignIn}
          placeholder="Password"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="go"
          secureTextEntry
          style={styles.input}
          textContentType="password"
          value={password}
        />
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={startPasswordSignIn}
          style={({ pressed }) => [styles.primaryButton, loading && styles.buttonDisabled, pressed && styles.buttonPressed]}
        >
          {loading ? <ActivityIndicator color={colors.primaryForeground} /> : (
            <Text style={styles.primaryButtonText}>Sign in</Text>
          )}
        </Pressable>

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          accessibilityRole="button"
          disabled={!googleAvailable || loading}
          onPress={startGoogleSignIn}
          style={({ pressed }) => [
            styles.googleButton,
            (!googleAvailable || loading) && styles.buttonDisabled,
            pressed && googleAvailable && styles.buttonPressed
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.foreground} />
          ) : (
            <>
              <Ionicons color={colors.foreground} name="logo-google" size={18} />
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </Pressable>

        {googleConfigurationMessage ? (
          <View style={styles.configurationNotice}>
            <Ionicons color={colors.mutedForeground} name="information-circle-outline" size={20} />
            <Text style={styles.configurationText}>{googleConfigurationMessage}</Text>
          </View>
        ) : null}

        {visibleError ? (
          <View style={styles.errorPanel}>
            <Text style={styles.error}>{visibleError}</Text>
            <Pressable accessibilityRole="button" onPress={retrySession} style={styles.retryButton}>
              <Text style={styles.retryText}>Retry connection</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    flexGrow: 1,
    gap: spacing.lg,
    padding: screen.horizontal,
    paddingBottom: spacing.xl
  },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 24,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg
  },
  accountIcon: {
    alignItems: "center",
    backgroundColor: colors.accent,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  title: {
    color: colors.foreground,
    fontFamily: fonts.sans,
    fontSize: 18,
    fontWeight: "600",
    lineHeight: 28
  },
  subtitle: {
    color: colors.mutedForeground,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 20
  },
  detail: {
    color: colors.foreground,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 22
  },
  introPanel: {
    backgroundColor: "#fff8f5",
    borderRadius: 24,
    paddingHorizontal: spacing.md,
    paddingVertical: 12
  },
  introText: {
    color: colors.mutedForeground,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "400",
    lineHeight: 24
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.92)",
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.foreground,
    fontFamily: fonts.sans,
    fontSize: 15,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: 0
  },
  dividerRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.sm
  },
  dividerLine: {
    backgroundColor: colors.border,
    flex: 1,
    height: StyleSheet.hairlineWidth
  },
  dividerText: {
    color: colors.mutedForeground,
    fontFamily: fonts.sans,
    fontSize: 12
  },
  googleButton: {
    alignItems: "center",
    backgroundColor: colors.muted,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.sm,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md
  },
  googleButtonText: {
    color: colors.foreground,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    justifyContent: "center",
    minHeight: 48
  },
  primaryButtonText: {
    color: colors.primaryForeground,
    fontFamily: fonts.sans,
    fontSize: 14,
    fontWeight: "500"
  },
  buttonDisabled: {
    opacity: 0.55
  },
  buttonPressed: {
    opacity: 0.78
  },
  configurationNotice: {
    alignItems: "flex-start",
    backgroundColor: colors.muted,
    borderRadius: radii.md,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md
  },
  configurationText: {
    color: colors.mutedForeground,
    flex: 1,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 20
  },
  errorPanel: {
    backgroundColor: "#fff1f1",
    borderRadius: radii.md,
    gap: spacing.sm,
    padding: spacing.md
  },
  error: {
    color: colors.danger,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "400",
    lineHeight: 20
  },
  retryButton: {
    alignSelf: "flex-start",
    paddingVertical: spacing.xs
  },
  retryText: {
    color: colors.foreground,
    fontFamily: fonts.sans,
    fontSize: 13,
    fontWeight: "600"
  }
});
