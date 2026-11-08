import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import { cookies } from "next/headers";
import type { ReactNode } from "react";

import "./globals.css";
import "./competition.css";
import "./shell.css";
import "./team.css";
import "./hall-of-fame.css";
import "./club.css";
import "./players.css";
import "./player-profile.css";
import "./profile.css";
import "./profile-extra.css";

const dmSans = DM_Sans({ subsets: ["latin"], weight: ["400", "500", "600", "700"], display: "swap", variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: {
    default: "MARKETFOOT",
    template: "%s · MARKETFOOT",
  },
  description: "Gestion de football fantasy et trading virtuel.",
};

/**
 * Fit-to-width scaling for laptop screens: the desktop layout is designed for ~1440px, so below 1500px of
 * viewport the whole UI is scaled down proportionally (about what a 90% browser zoom gives on a 1366px laptop).
 * Below 1100px the responsive stacked layout takes over and no scaling is applied. Runs before first paint.
 */
const fitScript = `(function(){var d=document.documentElement;function f(){var w=window.innerWidth;var s=w>=1500||w<1100?1:Math.max(0.74,w/1500);d.style.setProperty("--ui-scale",String(s));}f();window.addEventListener("resize",f);})();`;

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const theme = (await cookies()).get("mf-theme")?.value;
  return (
    <html lang="fr" className={dmSans.variable} data-theme={theme === "dark" || theme === "auto" ? theme : "light"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: fitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
