import Link from "next/link";

export type ProfileTab = "performance" | "palmares" | "amis";

/** Navigation "My Page": Performances / Palmarès / Amis (friend count badge) + season selector. */
export function ProfileTabs({ active, basePath, friends, seasonName, owner }: { active: ProfileTab; basePath: string; friends?: number; seasonName?: string; owner: boolean }) {
  const tabs: [ProfileTab, string][] = [["performance", "Performances"], ["palmares", "Palmarès"], ...(owner ? ([["amis", "Amis"]] as [ProfileTab, string][]) : [])];
  return (
    <div className="gp-top">
      <nav className="gp-tabs" aria-label="Profil" style={{ width: owner ? 652 : 436 }}>
        {tabs.map(([id, label]) => (
          <Link key={id} href={`${basePath}?tab=${id}`} className={active === id ? "is-active" : undefined} aria-current={active === id ? "page" : undefined}>
            {label}{id === "amis" && friends !== undefined && <i>{friends}</i>}
          </Link>
        ))}
      </nav>
      {seasonName && <span className="gp-season">Championnat {seasonName}<svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 4.5 3 3 3-3" /></svg></span>}
    </div>
  );
}
