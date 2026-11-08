"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/saisie", label: "Saisie" },
  { href: "/admin/saison", label: "Saison" },
  { href: "/admin/mercato", label: "Mercato" },
  { href: "/admin/managers", label: "Managers" },
  { href: "/admin/baremes", label: "Barèmes" },
  { href: "/admin/parametres", label: "Paramètres" },
];

export function AdminNavigation() {
  const pathname = usePathname();
  return (
    <nav className="ad-nav" aria-label="Navigation administrative">
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>{item.label}</Link>;
      })}
    </nav>
  );
}
