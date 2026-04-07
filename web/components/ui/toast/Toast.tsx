"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import styles from "./toast.module.css";

// ── Types ──────────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  type?: ToastType;
  /** Duration in ms before auto-dismiss. Pass 0 to disable. Default: 4000 */
  duration?: number;
}

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  duration: number;
  exiting: boolean;
}

interface ToastContextValue {
  addToast: (message: string, options?: ToastOptions) => void;
  removeToast: (id: number) => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const startExit = useCallback((id: number) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, exiting: true } : t)));
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 300);
  }, []);

  const addToast = useCallback(
    (message: string, options: ToastOptions = {}) => {
      const id = Date.now();
      const type = options.type ?? "info";
      const duration = options.duration ?? 4000;
      setToasts((prev) => [...prev, { id, message, type, duration, exiting: false }]);
      if (duration > 0) setTimeout(() => startExit(id), duration);
    },
    [startExit]
  );

  const removeToast = useCallback((id: number) => startExit(id), [startExit]);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

// ── Container ─────────────────────────────────────────────────────────────────

function ToastContainer({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div role="region" aria-label="Notifications" aria-live="polite" className={styles.region}>
      {toasts.map((toast) => (
        <ToastRow key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

// ── Toast row ─────────────────────────────────────────────────────────────────

const TYPE_CLASS: Record<ToastType, string> = {
  success: styles.success,
  error:   styles.error,
  warning: styles.warning,
  info:    styles.info,
};

function ToastRow({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const mounted = useRef(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      requestAnimationFrame(() => setVisible(true));
    }
  }, []);

  const toastClass = [
    styles.toast,
    TYPE_CLASS[toast.type],
    visible && !toast.exiting ? styles.toastVisible : "",
    toast.exiting ? styles.toastExiting : "",
  ].join(" ");

  return (
    <div role="alert" className={toastClass}>
      <span className={styles.icon} aria-hidden="true">
        <ToastIcon type={toast.type} />
      </span>

      <p className={styles.message}>{toast.message}</p>

      <button
        aria-label="Dismiss"
        onClick={() => onDismiss(toast.id)}
        className={styles.dismiss}
      >
        <XIcon />
      </button>

      {toast.duration > 0 && (
        <ProgressBar duration={toast.duration} exiting={toast.exiting} />
      )}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ duration, exiting }: { duration: number; exiting: boolean }) {
  const [width, setWidth] = useState(100);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setWidth(0));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className={styles.progress}>
      <div
        className={styles.progressBar}
        style={{
          width: `${width}%`,
          transition: exiting ? "none" : `width ${duration}ms linear`,
        }}
      />
    </div>
  );
}

// ── Icons ─────────────────────────────────────────────────────────────────────

function ToastIcon({ type }: { type: ToastType }) {
  switch (type) {
    case "success":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6L9 17l-5-5" />
        </svg>
      );
    case "error":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case "warning":
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    default:
      return (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
      );
  }
}

function XIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}