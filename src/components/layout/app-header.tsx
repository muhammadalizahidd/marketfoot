import Link from "next/link";

import { HallOfFameLink, PrimaryNavigation } from "./primary-navigation";

/** Top menu (1392 x 102 at 16,24 in the 1440px Figma frames), shared by the app shell and the Hall of Fame. */
export function AppHeader() {
  return (
      <div className="ms-top">
    <header className="ms-header">
      <svg className="ms-header-art" viewBox="0 0 1392 102" preserveAspectRatio="none" aria-hidden="true" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2">
        {[206, 718, 1242].map((x) => (
          <g key={x}>
            <line x1={x} y1="0" x2={x} y2="102" />
            <circle cx={x} cy="51" r="118" strokeOpacity="0.55" />
          </g>
        ))}
      </svg>
      <Link href="/mon-equipe" className="ms-logo">MarketFoot</Link>
      <PrimaryNavigation />
      <HallOfFameLink />
    </header>
    </div>
  );
}
