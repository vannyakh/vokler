import * as SecureStore from "expo-secure-store";

const ACCESS = "vokler_access_token";
const REFRESH = "vokler_refresh_token";
const EMAIL = "vokler_user_email";

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS);
}

export async function setTokens(
  access: string,
  refresh: string,
  email?: string | null,
): Promise<void> {
  await SecureStore.setItemAsync(ACCESS, access);
  await SecureStore.setItemAsync(REFRESH, refresh);
  if (email) {
    await SecureStore.setItemAsync(EMAIL, email);
  } else {
    try {
      await SecureStore.deleteItemAsync(EMAIL);
    } catch {
      /* no stored email */
    }
  }
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH);
}

export async function getStoredEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(EMAIL);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS);
  await SecureStore.deleteItemAsync(REFRESH);
  await SecureStore.deleteItemAsync(EMAIL);
}
