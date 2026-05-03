import { createAuthClient } from "better-auth/react";

const baseURL =
  typeof window !== "undefined"
    ? window.location.origin
    : (process.env.BETTER_AUTH_URL ?? process.env.NEXT_PUBLIC_BETTER_AUTH_URL ?? "").replace(/\/$/, "") ||
      "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL,
});
