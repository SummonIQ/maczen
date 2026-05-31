"use client";

import { useEffect, useState } from "react";

export function HeroBackground() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);
  const primaryAuroraClass = prefersReducedMotion
    ? "absolute -top-[24rem] left-1/2 h-[980px] w-[1820px] -translate-x-1/2 opacity-78 blur-[110px] mix-blend-multiply saturate-[1.35] dark:mix-blend-screen"
    : "absolute -top-[24rem] left-1/2 h-[980px] w-[1820px] -translate-x-1/2 opacity-78 blur-[110px] mix-blend-multiply saturate-[1.35] dark:mix-blend-screen animate-[aurora-drift_18s_ease-in-out_infinite]";
  const secondaryAuroraClass = prefersReducedMotion
    ? "absolute -top-[19rem] left-1/2 h-[900px] w-[1640px] -translate-x-1/2 opacity-62 blur-[120px] mix-blend-multiply saturate-[1.25] dark:mix-blend-screen"
    : "absolute -top-[19rem] left-1/2 h-[900px] w-[1640px] -translate-x-1/2 opacity-62 blur-[120px] mix-blend-multiply saturate-[1.25] dark:mix-blend-screen animate-[aurora-drift-reverse_24s_ease-in-out_infinite]";
  const sheenClass = prefersReducedMotion
    ? "pointer-events-none absolute inset-0 opacity-42 mix-blend-soft-light bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.18),rgba(255,255,255,0)_64%)] dark:opacity-32 dark:mix-blend-normal dark:bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),rgba(0,0,0,0)_68%)]"
    : "pointer-events-none absolute inset-0 opacity-42 mix-blend-soft-light bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.18),rgba(255,255,255,0)_64%)] dark:opacity-32 dark:mix-blend-normal dark:bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.05),rgba(0,0,0,0)_68%)] animate-[hue-sweep_14s_ease-in-out_infinite]";

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");

    const sync = () => setPrefersReducedMotion(mq.matches);
    sync();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", sync);
      return () => mq.removeEventListener("change", sync);
    }

    mq.addListener(sync);
    return () => mq.removeListener(sync);
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className={primaryAuroraClass}
          style={{
            background:
              "radial-gradient(ellipse at 22% 24%, rgba(236,72,153,0.24), transparent 38%), radial-gradient(ellipse at 50% 18%, rgba(168,85,247,0.26), transparent 44%), radial-gradient(ellipse at 76% 20%, rgba(34,211,238,0.24), transparent 40%), radial-gradient(ellipse at 88% 36%, rgba(20,184,166,0.18), transparent 36%), linear-gradient(90deg, rgba(59,130,246,0.08), rgba(168,85,247,0.16), rgba(34,211,238,0.12))",
            maskImage:
              "radial-gradient(ellipse at top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.78) 40%, rgba(0,0,0,0.36) 62%, rgba(0,0,0,0) 84%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.78) 40%, rgba(0,0,0,0.36) 62%, rgba(0,0,0,0) 84%)",
          }}
        />

        <div
          className={secondaryAuroraClass}
          style={{
            background:
              "radial-gradient(ellipse at 16% 28%, rgba(59,130,246,0.18), transparent 34%), radial-gradient(ellipse at 44% 14%, rgba(192,38,211,0.16), transparent 42%), radial-gradient(ellipse at 70% 26%, rgba(16,185,129,0.18), transparent 38%), radial-gradient(ellipse at 90% 16%, rgba(250,204,21,0.12), transparent 30%)",
            maskImage:
              "radial-gradient(ellipse at top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.52) 46%, rgba(0,0,0,0.12) 68%, rgba(0,0,0,0) 88%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.52) 46%, rgba(0,0,0,0.12) 68%, rgba(0,0,0,0) 88%)",
          }}
        />
      </div>
      <div aria-hidden="true" className={sheenClass} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(circle at 50% 8%, rgba(255,255,255,0.06), rgba(255,255,255,0.02) 24%, rgba(0,0,0,0) 66%), radial-gradient(circle at 24% 18%, rgba(255,255,255,0.04), rgba(0,0,0,0) 42%), radial-gradient(circle at 78% 22%, rgba(255,255,255,0.035), rgba(0,0,0,0) 46%)",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.18] bg-[linear-gradient(to_right,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-size-[84px_84px] mask-[radial-gradient(ellipse_at_top,black_42%,transparent_88%)] dark:opacity-[0.12]"
      />
    </div>
  );
}
