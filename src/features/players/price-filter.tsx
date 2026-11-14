"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Min / max price (typed in M€). Applies itself shortly after typing stops: no "Appliquer" button. */
export function PriceFilter({ min, max }: { min?: number; max?: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();
  const [low, setLow] = useState(min !== undefined ? String(min / 1_000_000) : "");
  const [high, setHigh] = useState(max !== undefined ? String(max / 1_000_000) : "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const timer = setTimeout(() => {
      const next = new URLSearchParams(search.toString());
      for (const [key, value] of [["min", low], ["max", high]] as const) { if (value.trim() && Number(value) >= 0) next.set(key, value.trim()); else next.delete(key); }
      next.delete("page");
      next.set("open", "prix");
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    }, 450);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [low, high]);

  return (
    <div className="pl-price">
      <label><input type="number" step="0.001" min="0" value={low} onChange={(e) => setLow(e.target.value)} placeholder="Min (M€)" aria-label="Prix minimum en millions d’euros" /></label>
      <span className="pl-track" aria-hidden="true" />
      <label><input type="number" step="0.001" min="0" value={high} onChange={(e) => setHigh(e.target.value)} placeholder="Max (M€)" aria-label="Prix maximum en millions d’euros" /></label>
    </div>
  );
}
