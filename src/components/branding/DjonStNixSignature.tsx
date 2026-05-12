import React from "react";

export const DjonStNixSignature: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <div className="fixed bottom-4 right-4 z-50 pointer-events-none">
      <a
        href="https://github.com/Djonluc"
        target="_blank"
        rel="noopener noreferrer"
        className="pointer-events-auto block opacity-30 hover:opacity-100 transition-opacity duration-300"
      >
        <svg
          width="120"
          height="40"
          viewBox="0 0 120 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="filter drop-shadow-[0_0_4px_rgba(91,140,255,0.6)]"
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

          {/* Minimal Border */}
          <rect
            x="2"
            y="2"
            width="116"
            height="36"
            stroke="#5B8CFF"
            strokeWidth="0.5"
            rx="4"
            className="opacity-40"
          />

          {/* Text */}
          <text
            x="60"
            y="20"
            dominantBaseline="middle"
            textAnchor="middle"
            fill="white"
            fontSize="12"
            fontWeight="700"
            fontFamily="'Inter', sans-serif"
          >
            Djon<tspan fill="#5B8CFF">St</tspan>Nix
          </text>

          {/* Subtitle */}
          <text
            x="60"
            y="30"
            dominantBaseline="middle"
            textAnchor="middle"
            fill="#5B8CFF"
            fontSize="5"
            fontFamily="monospace"
            className="opacity-60"
          >
            © {currentYear}
          </text>
        </svg>
      </a>
    </div>
  );
};
