const BTN_ID = "vokler-download-btn";

function mountButton(): void {
  if (document.getElementById(BTN_ID)) return;

  const btn = document.createElement("button");
  btn.id = BTN_ID;
  btn.type = "button";
  btn.textContent = "Vokler";
  btn.setAttribute("aria-label", "Open Vokler download");

  Object.assign(btn.style, {
    position: "fixed",
    zIndex: String(2147483646),
    right: "12px",
    bottom: "12px",
    padding: "8px 12px",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(20,20,24,0.92)",
    color: "#f4f4f5",
    font: '600 13px system-ui, -apple-system, Segoe UI, sans-serif',
    cursor: "pointer",
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  } as CSSStyleDeclaration);

  btn.addEventListener("click", () => {
    void chrome.runtime.sendMessage({ type: "OPEN_POPUP_HINT" }).catch(() => {
      /* ignore */
    });
  });

  document.documentElement.appendChild(btn);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => mountButton());
} else {
  mountButton();
}
