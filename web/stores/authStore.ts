"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

import { apiFetch, setAccessToken } from "@/lib/api";

export type AuthUser = {
  id: string;
  email: string;
  created_at: string;
};

type TokenPair = {
  access_token: string;
  refresh_token: string;
};

type AuthState = {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  tryRefreshToken: () => Promise<boolean>;
};

async function setAuthCookie(token: string): Promise<void> {
  await fetch("/api/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

async function clearAuthCookie(): Promise<void> {
  await fetch("/api/auth/token", { method: "DELETE" });
}

function storeTokens(pair: TokenPair): void {
  setAccessToken(pair.access_token);
  if (typeof window !== "undefined") {
    localStorage.setItem("vokler_refresh_token", pair.refresh_token);
  }
}

function clearTokens(): void {
  setAccessToken(null);
  if (typeof window !== "undefined") {
    localStorage.removeItem("vokler_refresh_token");
  }
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const pair = await apiFetch<TokenPair>("/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });
          storeTokens(pair);
          await setAuthCookie(pair.access_token);
          await get().refreshUser();
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (email, password) => {
        set({ isLoading: true });
        try {
          await apiFetch("/auth/register", {
            method: "POST",
            body: JSON.stringify({ email, password }),
          });
          await get().login(email, password);
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        clearTokens();
        await clearAuthCookie();
        set({ user: null });
      },

      refreshUser: async () => {
        try {
          const user = await apiFetch<AuthUser>("/auth/me");
          set({ user });
        } catch {
          set({ user: null });
        }
      },

      tryRefreshToken: async () => {
        if (typeof window === "undefined") return false;
        const refreshToken = localStorage.getItem("vokler_refresh_token");
        if (!refreshToken) return false;
        try {
          const pair = await apiFetch<TokenPair>("/auth/refresh", {
            method: "POST",
            body: JSON.stringify({ refresh_token: refreshToken }),
          });
          storeTokens(pair);
          await setAuthCookie(pair.access_token);
          return true;
        } catch {
          clearTokens();
          await clearAuthCookie();
          set({ user: null });
          return false;
        }
      },
    }),
    {
      name: "vokler-auth",
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
