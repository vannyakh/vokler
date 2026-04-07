/**
 * Fixed full-viewport SVG: fine line grid, dot grid, diagonal sweeps, drifting shapes.
 * Theme tokens live in globals.css (--vok-bg-pattern-*).
 */
export function PageBackground() {
  return (
    <div
      className="vok-page-bg pointer-events-none fixed inset-0 z-0 overflow-hidden"
      aria-hidden
    >
      <svg
        className="vok-page-bg-svg h-full w-full min-h-full min-w-full"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1200 800"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <pattern
            id="vok-bg-line-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="var(--vok-bg-pattern-line)"
              strokeWidth="0.4"
            />
          </pattern>
          <pattern
            id="vok-bg-dot-grid"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <circle
              cx="14"
              cy="14"
              r="0.65"
              fill="var(--vok-bg-pattern-dot)"
            />
          </pattern>
          <radialGradient id="vok-bg-center-glow" cx="50%" cy="42%" r="58%">
            <stop offset="0%" stopColor="var(--vok-bg-glow-center)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient
            id="vok-bg-sweep-fade"
            x1="0%"
            y1="0%"
            x2="100%"
            y2="0%"
          >
            <stop offset="0%" stopColor="transparent" />
            <stop offset="48%" stopColor="var(--vok-bg-sweep-mid)" />
            <stop offset="52%" stopColor="var(--vok-bg-sweep-mid)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
        </defs>

        <g className="vok-bg-grid-pan">
          <rect x="-80" y="-80" width="1360" height="960" fill="url(#vok-bg-line-grid)" />
        </g>

        <g className="vok-bg-dot-pan">
          <rect width="1200" height="800" fill="url(#vok-bg-dot-grid)" opacity={0.55} />
        </g>

        <rect
          width="1200"
          height="800"
          fill="url(#vok-bg-center-glow)"
          className="vok-bg-glow-breathe"
        />

        <g strokeLinecap="round" fill="none">
          <line
            x1="-120"
            y1="900"
            x2="660"
            y2="-120"
            className="vok-bg-sweep-line vok-bg-sweep-line--a"
            stroke="var(--vok-bg-sweep-stroke-a)"
            strokeWidth="0.55"
          />
          <line
            x1="280"
            y1="920"
            x2="1140"
            y2="-100"
            className="vok-bg-sweep-line vok-bg-sweep-line--b"
            stroke="var(--vok-bg-sweep-stroke-b)"
            strokeWidth="0.45"
          />
          <line
            x1="-40"
            y1="680"
            x2="920"
            y2="-40"
            className="vok-bg-sweep-line vok-bg-sweep-line--c"
            stroke="var(--vok-bg-sweep-stroke-a)"
            strokeWidth="0.35"
            opacity={0.6}
          />
        </g>

        <g transform="rotate(-26 600 400)">
          <rect
            x="-200"
            y="260"
            width="1600"
            height="320"
            fill="url(#vok-bg-sweep-fade)"
            className="vok-bg-band-drift"
          />
        </g>

        <g className="vok-bg-shapes" fill="none" strokeWidth="0.75">
          <g
            className="vok-bg-drift vok-bg-drift--a"
            style={{ animationDuration: "26s", animationDelay: "0s" }}
          >
            <polygon
              points="1048,52 1108,128 1000,128"
              stroke="var(--vok-bg-shape-accent)"
            />
          </g>
          <g transform="rotate(16 79 179)">
            <g
              className="vok-bg-drift vok-bg-drift--b"
              style={{ animationDuration: "32s", animationDelay: "-5s" }}
            >
              <rect
                x="68"
                y="168"
                width="22"
                height="22"
                rx="3.5"
                stroke="var(--vok-bg-shape-mint)"
              />
            </g>
          </g>
          <g
            className="vok-bg-drift vok-bg-drift--b"
            style={{ animationDuration: "28s", animationDelay: "-3s" }}
          >
            <circle
              cx="1104"
              cy="312"
              r="15"
              stroke="var(--vok-bg-shape-violet)"
            />
          </g>
          <g
            className="vok-bg-drift vok-bg-drift--a"
            style={{ animationDuration: "30s", animationDelay: "-7s" }}
          >
            <polygon
              points="112,568 168,648 56,648"
              stroke="var(--vok-bg-shape-accent)"
            />
          </g>
          <g transform="rotate(-14 945 481)">
            <g
              className="vok-bg-drift vok-bg-drift--c"
              style={{ animationDuration: "34s", animationDelay: "-9s" }}
            >
              <rect
                x="936"
                y="472"
                width="18"
                height="18"
                rx="2.5"
                stroke="var(--vok-bg-shape-mint)"
              />
            </g>
          </g>
          <g
            className="vok-bg-drift vok-bg-drift--c"
            style={{ animationDuration: "24s", animationDelay: "-11s" }}
          >
            <circle cx="208" cy="392" r="11" stroke="var(--vok-bg-shape-violet)" />
          </g>
          <g
            className="vok-bg-drift vok-bg-drift--a"
            style={{ animationDuration: "36s", animationDelay: "-4s" }}
          >
            <polygon
              points="980,648 1032,720 928,720"
              stroke="var(--vok-bg-shape-accent)"
            />
          </g>
          <g transform="rotate(22 527 103)">
            <g
              className="vok-bg-drift vok-bg-drift--b"
              style={{ animationDuration: "29s", animationDelay: "-14s" }}
            >
              <rect
                x="520"
                y="96"
                width="14"
                height="14"
                rx="2"
                stroke="var(--vok-bg-shape-mint)"
              />
            </g>
          </g>
        </g>
      </svg>
    </div>
  );
}
