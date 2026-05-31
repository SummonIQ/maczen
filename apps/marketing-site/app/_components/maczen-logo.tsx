interface MacZenLogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const SIZE_MAP = {
  sm: {
    wrapper: "h-6 w-6 rounded-md",
    icon: "h-3.5 w-3.5",
  },
  md: {
    wrapper: "h-8 w-8 rounded-lg",
    icon: "h-5 w-5",
  },
  lg: {
    wrapper: "h-12 w-12 rounded-xl",
    icon: "h-7 w-7",
  },
} as const;

function MacZenGlyph({ className }: { className: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <g
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        transform="translate(12 12) scale(1.06) translate(-12 -12)"
      >
        <polyline points="3.94 2 6.94 12.5 16.9 12.5" strokeWidth="2.22" />
        <line x1="9.5" y1="12.5" x2="7" y2="19.9" strokeWidth="1.88" />
        <line x1="15" y1="12.5" x2="17" y2="19.9" strokeWidth="1.88" />
        <line x1="4.2" y1="18.35" x2="3.2" y2="17.65" strokeWidth="2.1" />
        <line x1="19.8" y1="18.35" x2="20.8" y2="17.65" strokeWidth="2.1" />
        <path d="M4.2 18.35 Q12 23.55 19.8 18.35" strokeWidth="2.1" />
      </g>
    </svg>
  );
}

export function MacZenLogo({ size = "md", className }: MacZenLogoProps) {
  const selected = SIZE_MAP[size];
  return (
    <div
      className={`${selected.wrapper} flex items-center justify-center bg-gradient-to-br from-pink-600 via-fuchsia-600 to-purple-600 ${className || ""}`}
    >
      <MacZenGlyph className={`${selected.icon} text-white`} />
    </div>
  );
}
