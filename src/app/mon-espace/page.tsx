import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { getSettings } from "@/data/repositories/gamer-repository";
import { signOut } from "@/features/auth/actions";
import { DeleteAccount, ProfileForm, SecuritySection, ThemeSection } from "@/features/profile/my-space-forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Mon espace" };

const menu = [["profil", "Profil"], ["securite", "Connexion & sécurité"], ["theme", "Préférences"], ["donnees", "Données personnelles"]] as const;
const legal = [["consentements", "Gérer mes consentements"], ["cgu", "Conditions Générales d’Utilisation"], ["confidentialite", "Politique de confidentialité"], ["mentions-legales", "Mentions légales"]] as const;

/** My Space (Figma "Gamer Form – My Space"): private account settings. Has its own menu instead of the usual sidebar. */
export default async function MySpacePage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/connexion");
  const settings = await getSettings(user.id, user.email ?? "", Boolean(user.email_confirmed_at));
  if (!settings) redirect("/onboarding");
  return (
    <div className="ms-shell">
      <AppHeader />
      <div className="ms-body">
        <aside className="sp-menu" aria-label="Mon espace">
          <nav>
            <h2>Mon espace</h2>
            {menu.map(([id, label], index) => <a key={id} href={`#${id}`} className={index === 0 ? "is-active" : undefined}>{label}</a>)}
          </nav>
          <form action={signOut}><button type="submit">Se déconnecter</button></form>
          <DeleteAccount username={settings.username} />
        </aside>
        <main className="sp-main">
          <ProfileForm settings={settings} />
          <SecuritySection email={settings.email} confirmed={settings.emailConfirmed} />
          <ThemeSection theme={settings.theme} />
          <section id="donnees" className="sp-card">
            <h2>Données personnelles</h2>
            <ul className="sp-links">{legal.map(([slug, label]) => <li key={slug}><Link href={`/legal/${slug}`}>{label}</Link></li>)}</ul>
          </section>
        </main>
      </div>
      <footer className="ms-footer"><div className="ms-footer-in"><span>© MarketFoot</span><span><Link href="/hall-of-fame">Hall of Fame</Link><Link href="/classements">Classements</Link><Link href="/ligue-1">Ligue 1</Link></span></div></footer>
    </div>
  );
}
