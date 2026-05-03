import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

import { canSendTransactionalEmail, sendVerificationEmailMessage } from "@/lib/email";

function databaseUrl(): string {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error(
      "DATABASE_URL is required for Better Auth (same Postgres as the API; use postgresql://… not +asyncpg).",
    );
  }
  return raw
    .replace(/^postgresql\+asyncpg:\/\//i, "postgresql://")
    .replace(/^postgres:\/\//i, "postgresql://");
}

function baseUrl(): string {
  return (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function trustedOrigins(): string[] {
  const extra = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return Array.from(new Set([baseUrl(), "http://localhost:3000", "http://127.0.0.1:3000", ...extra]));
}

function buildSocialProviders() {
  const googleId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const githubId = process.env.GITHUB_CLIENT_ID?.trim();
  const githubSecret = process.env.GITHUB_CLIENT_SECRET?.trim();

  const social: Record<string, { clientId: string; clientSecret: string }> = {};
  if (googleId && googleSecret) {
    social.google = { clientId: googleId, clientSecret: googleSecret };
  }
  if (githubId && githubSecret) {
    social.github = { clientId: githubId, clientSecret: githubSecret };
  }
  return social;
}

const requireVerify = canSendTransactionalEmail();
const social = buildSocialProviders();

const emailVerification = requireVerify
  ? {
      sendOnSignUp: true as const,
      autoSignInAfterVerification: true as const,
      sendVerificationEmail: async ({ user, url }: { user: { email: string }; url: string }) => {
        void sendVerificationEmailMessage(user.email, url).catch((err) => {
          console.error("[auth] sendVerificationEmail:", err);
        });
      },
    }
  : undefined;

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: baseUrl(),
  trustedOrigins: trustedOrigins(),
  database: {
    provider: "pg",
    url: databaseUrl(),
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: requireVerify,
    minPasswordLength: 8,
  },
  ...(emailVerification ? { emailVerification } : {}),
  ...(Object.keys(social).length > 0 ? { socialProviders: social } : {}),
  plugins: [nextCookies()],
});
