import React from "react";

export const DjonStNixLogo: React.FC<{ className?: string }> = ({
  className,
}) => {
  const currentYear = new Date().getFullYear();

  return (
    <a
      href="https://www.youtube.com/@Djonluc"
      target="_blank"
      rel="noopener noreferrer"
      className={`relative inline-block hover:scale-105 transition-transform duration-300 ${className}`}
    >
      <svg
        width="240"
        height="80"
        viewBox="0 0 240 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="filter drop-shadow-[0_0_8px_rgba(91,140,255,0.8)]"
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
        <desc>
          Official watermark of DjonStNix. Software developer & digital creator.
          Contact: djonstnix@gmail.com
        </desc>

        {/* Animated Background Path */}
        <path
          d="M10 10H230V70H10V10Z"
          stroke="#5B8CFF"
          strokeWidth="1"
          strokeDasharray="700"
          strokeDashoffset="700"
          className="animate-[draw_2s_ease-in-out_forwards] opacity-20"
        />

        {/* Corner Accents */}
        <path
          d="M5 15V5H15"
          stroke="#5B8CFF"
          strokeWidth="2"
          className="animate-pulse"
        />
        <path
          d="M225 5H235V15"
          stroke="#5B8CFF"
          strokeWidth="2"
          className="animate-pulse"
        />
        <path
          d="M235 65V75H225"
          stroke="#5B8CFF"
          strokeWidth="2"
          className="animate-pulse"
        />
        <path
          d="M15 75H5V65"
          stroke="#5B8CFF"
          strokeWidth="2"
          className="animate-pulse"
        />

        {/* Binary Stream Decoration */}
        <text
          x="20"
          y="20"
          fill="#5B8CFF"
          fontSize="6"
          fontFamily="monospace"
          className="opacity-10 animate-pulse"
        >
          10110
        </text>
        <text
          x="200"
          y="70"
          fill="#5B8CFF"
          fontSize="6"
          fontFamily="monospace"
          className="opacity-10 animate-pulse"
        >
          01001
        </text>

        {/* Main Text */}
        <text
          x="50%"
          y="35"
          dominantBaseline="middle"
          textAnchor="middle"
          fill="white"
          fontSize="28"
          fontWeight="900"
          letterSpacing="2"
          fontFamily="'Inter', sans-serif"
          className="tracking-tighter"
        >
          Djon
          <tspan fill="#5B8CFF" className="animate-pulse">
            St
          </tspan>
          Nix
        </text>

        {/* Glitch Overlay */}
        <text
          x="50.5%"
          y="35.5"
          dominantBaseline="middle"
          textAnchor="middle"
          fill="#FF00FF"
          fontSize="28"
          fontWeight="900"
          letterSpacing="2"
          fontFamily="'Inter', sans-serif"
          className="opacity-0 animate-[glitch_4s_infinite] pointer-events-none"
          style={{ mixBlendMode: "screen" }}
        >
          DjonStNix
        </text>

        {/* Contact Info */}
        <g className="opacity-60 font-mono text-[6px]">
          <text
            x="50%"
            y="58"
            textAnchor="middle"
            fill="#5B8CFF"
            fontSize="6"
            fontFamily="monospace"
          >
            contact: djonstnix[at]gmail.com
          </text>
          <text
            x="50%"
            y="66"
            textAnchor="middle"
            fill="#5B8CFF"
            fontSize="6"
            fontFamily="monospace"
          >
            github.com/Djonluc
          </text>
        </g>
        <text
          x="220"
          y="75"
          textAnchor="end"
          fill="#5B8CFF"
          fontSize="5"
          fontFamily="monospace"
          className="opacity-40"
        >
          © {currentYear}
        </text>
      </svg>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @keyframes draw {
          to { stroke-dashoffset: 0; }
        }
        @keyframes glitch {
          0%, 90%, 100% { opacity: 0; transform: translate(0); }
          91% { opacity: 0.5; transform: translate(-2px, 1px); }
          92% { opacity: 0.5; transform: translate(2px, -1px); }
          93% { opacity: 0; transform: translate(0); }
        }
      `,
        }}
      />
    </a>
  );
};
