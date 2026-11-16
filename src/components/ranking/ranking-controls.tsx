"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Pushes the current URL with one query parameter changed (page goes back to 1 unless the parameter is the page itself). */
function useNavigate() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(changes)) { if (value === null || value === "") next.delete(key); else next.set(key, value); }
    if (!("page" in changes)) next.delete("page");
    router.push(`${pathname}?${next}`);
  };
}

export function NavSelect({ param, value, options, label, className }: { param: string; value: string; options: { value: string; label: string }[]; label: string; className?: string }) {
  const go = useNavigate();
  return (
    <select className={className} aria-label={label} value={value} onChange={(event) => go({ [param]: event.target.value })}>
      {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );
}

export function FriendsToggle({ checked }: { checked: boolean }) {
  const go = useNavigate();
  return (
    <label className="rk-friends">
      <input type="checkbox" checked={checked} onChange={(event) => go({ friends: event.target.checked ? "1" : null })} />
      <span>Ne montrer que mes ami.es</span>
    </label>
  );
}
