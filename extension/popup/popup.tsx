import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";

import "./popup.css";

type MediaHit = {
  url: string;
  tabId: number;
  mimeType: string | undefined;
  timeStamp: number;
  initiator: string | undefined;
};

function App() {
  const [hits, setHits] = useState<MediaHit[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    chrome.runtime.sendMessage({ type: "GET_MEDIA_HITS" }, (res) => {
      if (chrome.runtime.lastError) {
        setError(chrome.runtime.lastError.message);
        return;
      }
      setHits((res?.hits as MediaHit[]) ?? []);
      setError(null);
    });
  };

  useEffect(() => {
    refresh();
  }, []);

  const clear = () => {
    chrome.runtime.sendMessage({ type: "CLEAR_MEDIA_HITS" }, () => refresh());
  };

  return (
    <main className="popup">
      <header className="popup__header">
        <h1 className="popup__title">Vokler</h1>
        <div className="popup__actions">
          <button type="button" className="btn btn--ghost" onClick={refresh}>
            Refresh
          </button>
          <button type="button" className="btn btn--ghost" onClick={clear}>
            Clear
          </button>
        </div>
      </header>
      <p className="popup__hint">
        Media and stream-like requests captured from tabs appear below. Wire these to your
        API when ready.
      </p>
      {error ? <p className="popup__error">{error}</p> : null}
      <ul className="hit-list">
        {hits.length === 0 ? (
          <li className="hit-list__empty">No media URLs captured yet.</li>
        ) : (
          hits.map((h) => (
            <li key={`${h.url}-${h.timeStamp}`} className="hit">
              <div className="hit__url" title={h.url}>
                {h.url}
              </div>
              <div className="hit__meta">
                {h.mimeType ?? "unknown type"} · tab {h.tabId}
              </div>
            </li>
          ))
        )}
      </ul>
    </main>
  );
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
