function getEnvValue(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

const googleClientId = getEnvValue("AUTH_GOOGLE_ID", "GOOGLE_CLIENT_ID");
const googleClientSecret = getEnvValue("AUTH_GOOGLE_SECRET", "GOOGLE_CLIENT_SECRET");
const authSecret = getEnvValue("AUTH_SECRET", "NEXTAUTH_SECRET");

const emailServerHost = getEnvValue("EMAIL_SERVER_HOST");
const emailServerPort = getEnvValue("EMAIL_SERVER_PORT");
const emailServerUser = getEnvValue("EMAIL_SERVER_USER");
const emailServerPassword = getEnvValue("EMAIL_SERVER_PASSWORD");
const emailFrom = getEnvValue("EMAIL_FROM");

export const authProviderConfig = {
  authSecret,
  googleClientId,
  googleClientSecret,
  googleEnabled: Boolean(authSecret && googleClientId && googleClientSecret),
  email: {
    host: emailServerHost,
    port: emailServerPort,
    user: emailServerUser,
    password: emailServerPassword,
    from: emailFrom
  },
  emailEnabled: Boolean(
    emailServerHost &&
      emailServerPort &&
      emailServerUser &&
      emailServerPassword &&
      emailFrom
  )
};

export function getMissingAuthProviderVariables() {
  const missing: string[] = [];

  if (!authSecret) missing.push("AUTH_SECRET or NEXTAUTH_SECRET");
  if (!googleClientId) missing.push("AUTH_GOOGLE_ID or GOOGLE_CLIENT_ID");
  if (!googleClientSecret) missing.push("AUTH_GOOGLE_SECRET or GOOGLE_CLIENT_SECRET");

  return missing;
}
