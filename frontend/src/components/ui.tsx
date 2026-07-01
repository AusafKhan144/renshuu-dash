import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import clsx from "clsx";

export function Card({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className={clsx(
        "rounded-2xl border border-fg/10 bg-fg/[0.04] p-5 backdrop-blur",
        "shadow-[0_8px_30px_rgba(0,0,0,0.25)]",
        className
      )}
    >
      {children}
    </motion.div>
  );
}

/** Counts up to `value` when it mounts/changes. */
export function AnimatedNumber({ value }: { value: number | null | undefined }) {
  const target = value ?? 0;
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const duration = 800;
    const from = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  if (value == null) return <span className="text-fg/40">—</span>;
  return <span>{display.toLocaleString()}</span>;
}

export function Delta({ value }: { value: number | null | undefined }) {
  if (value == null || value === 0) return null;
  const up = value > 0;
  return (
    <span
      className={clsx(
        "ml-2 text-sm font-medium",
        up ? "text-emerald-400" : "text-rose-400"
      )}
    >
      {up ? "+" : ""}
      {value} this week
    </span>
  );
}
