import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";

export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!, // min 32 chars
  database: {
    provider: "pg", // or "sqlite", "mysql"
    url: process.env.DATABASE_URL!,
  },
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  plugins: [nextCookies()], // must be last plugin
});