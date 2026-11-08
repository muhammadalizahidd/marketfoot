"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const svg = { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const navItems = [
  { href: "/mon-equipe", label: "Mon équipe", icon: <svg {...svg}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg> },
  { href: "/classements", label: "Classements", icon: <svg {...svg}><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" /><path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" /><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" /></svg> },
  { href: "/ligue-1", label: "Ligue 1", icon: <svg {...svg}><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><line x1="4" y1="22" x2="4" y2="15" /></svg> },
  { href: "/joueurs", label: "Joueurs", icon: <svg {...svg}><circle cx="13" cy="4" r="2" /><path d="M4 22l4-7 3 2 2-6 4 3 3-2" /><path d="M10 9l3-2 4 4" /></svg> },
];

export function PrimaryNavigation() {
  const pathname = usePathname();
  return (
    <nav className="ms-nav" aria-label="Navigation principale">
      {navItems.map(({ href, label, icon }) => {
        const isActive = href === "/mon-equipe"
          ? pathname.startsWith("/mon-equipe") || pathname.startsWith("/transferts") || pathname.startsWith("/pronostics")
          : pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link key={href} href={href} aria-current={isActive ? "page" : undefined} className={isActive ? "is-active" : undefined}>
            <span className="pill">
              {icon}
              <span>{label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

export function HallOfFameLink() {
  const pathname = usePathname();
  return (
    <Link href="/hall-of-fame" className="ms-fame" aria-current={pathname.startsWith("/hall-of-fame") ? "page" : undefined}>
      <svg {...svg} fill="currentColor" stroke="none"><path d="M2 8l5 4 5-8 5 8 5-4-2 12H4L2 8z" /></svg>
      <span>Hall of Fame</span>
    </Link>
  );
}
