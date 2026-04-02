"use client";

import { useEffect } from "react";

type StatusMessage = {
  job_id?: string;
  progress?: number;
  status?: string;
};

export function useJobProgressWebSocket(
  jobId: string | null,
  wsUrl: string | null,
  onMessage: (data: StatusMessage) => void,
) {
  useEffect(() => {
    if (!jobId || !wsUrl) return;

    const socket = new WebSocket(wsUrl);

    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(String(ev.data)) as StatusMessage;
        onMessage(data);
      } catch {
        /* ignore */
      }
    };

    return () => {
      if (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING) {
        socket.close();
      }
    };
  }, [jobId, wsUrl, onMessage]);
}
