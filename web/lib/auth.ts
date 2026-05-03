import NextAuth from "next-auth";
import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { authServerValidateCredentials } from "@/lib/auth-server";

/** Prefer AUTH_SECRET in production; BETTER_AUTH_* kept for migration from the old stack. */
function authSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    process.env.BETTER_AUTH_SECRET?.trim() ||
    "development-only-set-AUTH_SECRET-min-32-chars-in-production"
  );
}

function buildProviders() {
  const list: NextAuthConfig["providers"] = [];
  const googleId = process.env.GOOGLE_CLIENT_ID?.trim();
  const googleSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (googleId && googleSecret) {
    list.push(Google({ clientId: googleId, clientSecret: googleSecret }));
  }
  const githubId = process.env.GITHUB_CLIENT_ID?.trim();
  const githubSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
  if (githubId && githubSecret) {
    list.push(GitHub({ clientId: githubId, clientSecret: githubSecret }));
  }
  list.push(
    Credentials({
      id: "credentials",
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = typeof credentials?.email === "string" ? credentials.email.trim() : "";
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;
        const user = await authServerValidateCredentials(email, password);
        if (!user) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.email.split("@")[0] || "User",
        };
      },
    }),
  );
  return list;
}

export const authConfig = {
  trustHost: true,
  secret: authSecret(),
  providers: buildProviders(),
  session: { strategy: "jwt" },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.sub = user.id ?? user.email ?? token.sub;
        if (user.email) token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = (token.sub as string) ?? "";
        if (token.email) session.user.email = token.email as string;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
