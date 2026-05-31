import clsx from "clsx";
import type { LucideIcon } from "lucide-react";

export interface SummaryItem {
  label: string;
  value: number;
  accent: string;
  borderTop: string;
  borderBottom: string;
  icon: LucideIcon;
}

interface SummaryBarProps {
  items: SummaryItem[];
}

const SKEW_DEG = 10;
const BG_EXTEND = 24;

export default function SummaryBar({ items }: SummaryBarProps) {
  return (
    <div
      className="relative flex items-stretch overflow-hidden rounded-[22px] border border-white/[0.06] bg-black/[0.22] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_18px_40px_-28px_rgba(0,0,0,0.85)]"
      style={{ isolation: "isolate" }}
    >
      {items.map(
        ({ label, value, accent, borderTop, borderBottom, icon: Icon }, idx) => {
          const isFirst = idx === 0;
          const isLast = idx === items.length - 1;
          return (
            <div
              key={label}
              className="relative py-2 px-4"
              style={{
                width: 160,
                borderTop: `1px solid ${borderTop}`,
                borderBottom: `1px solid ${borderBottom}`,
              }}
            >
              {/* Skewed opaque background — extends past section, later ones cover earlier */}
              <div
                style={{
                  position: "absolute",
                  top: -1,
                  bottom: -1,
                  left: isFirst ? -4 : -BG_EXTEND,
                  right: isLast ? -4 : -BG_EXTEND,
                  transform: `skewX(-${SKEW_DEG}deg)`,
                  zIndex: -1,
                }}
              >
                <div className="absolute inset-0 bg-[#08080c]" />
                <div
                  className={clsx(
                    "absolute inset-0 opacity-30",
                    `bg-gradient-to-br ${accent}`,
                  )}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.012) 100%)",
                  }}
                />
                {!isFirst && (
                  <>
                    <div className="absolute left-0 top-0 bottom-0 w-px bg-black/70" />
                    <div className="absolute left-px top-[8%] bottom-[8%] w-px bg-white/[0.05]" />
                    <div
                      className="absolute left-[-8px] top-[14%] bottom-[14%] w-4 blur-[10px]"
                      style={{
                        background:
                          "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.015) 50%, rgba(0,0,0,0.18) 100%)",
                      }}
                    />
                  </>
                )}
              </div>
              {/* Content */}
              <div className="relative flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-lg backdrop-blur"
                  style={{
                    background:
                      "linear-gradient(135deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.06) 100%)",
                  }}
                >
                  <Icon className="h-3.5 w-3.5 text-white/90" />
                </div>
                <div className="flex pt-2 flex-col justify-center leading-tight">
                  <p className="text-[8px] font-semibold uppercase tracking-[0.15em] leading-none text-slate-400/80">
                    {label}
                  </p>
                  <p className="text-base font-bold text-white/90 -mt-0.5">
                    {value}
                  </p>
                </div>
              </div>
            </div>
          );
        },
      )}
    </div>
  );
}
