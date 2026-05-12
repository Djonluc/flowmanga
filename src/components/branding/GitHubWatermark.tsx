import React from "react";

export const GitHubWatermark: React.FC<{ className?: string }> = ({
  className,
}) => {
  const currentYear = new Date().getFullYear();

  return (
    <div className={`relative ${className}`}>
      <a
        href="https://github.com/Djonluc"
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
      >
        <svg
          width="300"
          height="60"
          viewBox="0 0 300 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="filter drop-shadow-[0_0_10px_rgba(91,140,255,0.9)]"
        >
          <metadata>
            {`
                            Author: DjonStNix
                            Contact: djonstnix@gmail.com
                            Github: github.com/Djonluc
                            License: Attribution Required
                            Created: ${currentYear}
                        `}
          </metadata>

          {/* Animated Border */}
          <rect
            x="5"
            y="5"
            width="290"
            height="50"
            stroke="url(#gradient)"
            strokeWidth="2"
            rx="8"
            className="opacity-60 group-hover:opacity-100 transition-opacity"
          />

          {/* Gradient Definition */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#5B8CFF" />
              <stop offset="50%" stopColor="#FF00FF" />
              <stop offset="100%" stopColor="#5B8CFF" />
            </linearGradient>
          </defs>

          {/* GitHub Icon */}
          <g transform="translate(20, 18)">
            <path
              d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
              fill="#5B8CFF"
              className="group-hover:fill-white transition-colors"
            />
          </g>

          {/* Main Text */}
          <text
            x="70"
            y="30"
            dominantBaseline="middle"
            fill="white"
            fontSize="18"
            fontWeight="800"
            fontFamily="'Inter', sans-serif"
          >
            Djon
            <tspan
              fill="#5B8CFF"
              className="group-hover:fill-[#FF00FF] transition-colors"
            >
              St
            </tspan>
            Nix
          </text>

          {/* Subtitle */}
          <text
            x="70"
            y="45"
            fill="#5B8CFF"
            fontSize="7"
            fontFamily="monospace"
            className="opacity-70"
          >
            Software Developer & Digital Creator
          </text>

          {/* Year Badge */}
          <text
            x="280"
            y="30"
            textAnchor="end"
            dominantBaseline="middle"
            fill="#5B8CFF"
            fontSize="10"
            fontWeight="600"
            fontFamily="monospace"
          >
            © {currentYear}
          </text>
        </svg>
      </a>
    </div>
  );
};
