import { useId } from "react";

/** The Allyza mark: crescent · two intertwined forms · heart · star. Mirrors public/brand/allyza-mark.svg. */
export function Mark({ size = 56, className = "" }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg
      viewBox="40 80 400 360"
      width={size}
      height={size * 0.9}
      className={className}
      role="img"
      aria-label="Allyza"
    >
      <defs>
        <linearGradient id={`g${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#f6e7c8" />
          <stop offset="0.55" stopColor="#e2c493" />
          <stop offset="1" stopColor="#c9959a" />
        </linearGradient>
        <linearGradient id={`r${id}`} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0c3c4" />
          <stop offset="1" stopColor="#b9788a" />
        </linearGradient>
        <mask id={`m${id}`}>
          <rect width="512" height="512" fill="black" />
          <circle cx="236" cy="256" r="164" fill="white" />
          <circle cx="298" cy="248" r="138" fill="black" />
        </mask>
        <clipPath id={`c${id}`}>
          <circle cx="321" cy="239.5" r="14" />
        </clipPath>
      </defs>
      <circle cx="236" cy="256" r="164" fill={`url(#g${id})`} mask={`url(#m${id})`} />
      <g transform="translate(-31 -13)">
        <g fill="none" strokeLinecap="round" strokeWidth="13">
          <ellipse cx="300" cy="284" rx="58" ry="34" transform="rotate(-38 300 284)" stroke={`url(#g${id})`} />
          <ellipse cx="342" cy="284" rx="58" ry="34" transform="rotate(38 342 284)" stroke={`url(#r${id})`} />
          <g clipPath={`url(#c${id})`}>
            <ellipse cx="300" cy="284" rx="58" ry="34" transform="rotate(-38 300 284)" stroke={`url(#g${id})`} />
          </g>
        </g>
        <path
          d="M321 297 c-9 -8 -17 -14 -17 -22 a9 9 0 0 1 17 -4 a9 9 0 0 1 17 4 c0 8 -8 14 -17 22z"
          fill="#f4d7d4"
        />
      </g>
      <path d="M396 132 l5 15 15 5 -15 5 -5 15 -5 -15 -15 -5 15 -5z" fill="#f6e7c8" className="twinkle" />
      <circle cx="352" cy="118" r="3.4" fill="#f6e7c8" opacity="0.7" />
      <circle cx="420" cy="186" r="2.6" fill="#f6e7c8" opacity="0.55" />
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display tracking-[0.32em] uppercase ${className}`}>Allyza</span>
  );
}

export function Logo({ size = 44, showTagline = false, tagline }: { size?: number; showTagline?: boolean; tagline?: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <Mark size={size} />
      <Wordmark className="text-2xl text-ink" />
      {showTagline && tagline && <p className="font-display italic text-gold text-lg">{tagline}</p>}
    </div>
  );
}
