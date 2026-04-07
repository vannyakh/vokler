import axios from "axios";
import Constants from "expo-constants";

import { getAccessToken } from "@/lib/storage";

const envUrl = process.env.EXPO_PUBLIC_API_URL;
const appKeyEnv = process.env.EXPO_PUBLIC_FRONTEND_APP_KEY;
const extraUrl = (Constants.expoConfig?.extra as { apiUrl?: string } | undefined)?.apiUrl;
const DEFAULT_BASE = "http://127.0.0.1:8000";

let runtimeBaseUrl: string | null = null;

export function getApiBaseUrl(): string {
  return (runtimeBaseUrl ?? envUrl ?? extraUrl ?? DEFAULT_BASE).replace(/\/$/, "");
}

export function setApiBaseUrl(url: string): void {
  runtimeBaseUrl = url.replace(/\/$/, "");
  api.defaults.baseURL = runtimeBaseUrl;
}

export const api = axios.create({
  baseURL: getApiBaseUrl(),
  timeout: 60_000,
});

api.interceptors.request.use(async (config) => {
  const token = await getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const appKey =
    appKeyEnv ||
    (Constants.expoConfig?.extra as { frontendAppKey?: string } | undefined)?.frontendAppKey;
  if (appKey) {
    config.headers["X-App-Key"] = appKey;
  }
  return config;
});
