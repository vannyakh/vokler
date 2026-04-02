import { useCallback, useEffect, useState } from "react";

import {
  clearTokens,
  getAccessToken,
  getStoredEmail,
  setTokens,
} from "@/lib/storage";

export function useAuth() {
  const [email, setEmail] = useState<string | null>(null);
  const [signedIn, setSignedIn] = useState(false);

  const refresh = useCallback(async () => {
    const [token, storedEmail] = await Promise.all([
      getAccessToken(),
      getStoredEmail(),
    ]);
    setSignedIn(Boolean(token));
    setEmail(storedEmail);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = useCallback(async () => {
    await clearTokens();
    setSignedIn(false);
    setEmail(null);
  }, []);

  /** Call after login/register from a future auth screen. */
  const signInWithTokens = useCallback(
    async (access: string, refreshToken: string, userEmail?: string) => {
      await setTokens(access, refreshToken, userEmail ?? null);
      await refresh();
    },
    [refresh],
  );

  return { email, signedIn, signOut, refresh, signInWithTokens };
}
