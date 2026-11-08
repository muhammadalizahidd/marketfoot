import Link from "next/link";

export type TeamTabId = "composition" | "capitaine" | "transfert" | "pronostics";

const icon = { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

const tabs: { id: TeamTabId; label: string; href: string; icon: React.ReactNode }[] = [
  { id: "composition", label: "Bonus", href: "/mon-equipe?tab=composition", icon: <svg {...icon}><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13" /><path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 0 1 0 5" /></svg> },
  { id: "capitaine", label: "Capitaine", href: "/mon-equipe?tab=capitaine", icon: <svg {...icon}><circle cx="12" cy="12" r="9" /><path d="M14.8 9.2a3.5 3.5 0 1 0 0 5.6" /></svg> },
  { id: "transfert", label: "Transfert", href: "/transferts", icon: <svg {...icon}><path d="M4 8h14" /><path d="m14 4 4 4-4 4" /><path d="M20 16H6" /><path d="m10 12-4 4 4 4" /></svg> },
  { id: "pronostics", label: "Pronostics", href: "/pronostics", icon: <svg {...icon}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M12 5v14" /><path d="M7 10h1M7 14h1M16 10h1M16 14h1" /></svg> },
];

/** Team workspace tab bar shared by Composition, Captain, Transfers and Predictions (Figma "Navigation Team Page"). */
export function TeamTabs({ active }: { active: TeamTabId }) {
  return (
    <nav className="tm-tabs" aria-label="Mon équipe">
      {tabs.map((tab) => (
        <Link key={tab.id} href={tab.href} className={tab.id === active ? "is-active" : undefined} aria-current={tab.id === active ? "page" : undefined}>
          {tab.icon}
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
