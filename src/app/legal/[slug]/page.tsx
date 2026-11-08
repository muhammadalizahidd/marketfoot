import { notFound } from "next/navigation";
import Link from "next/link";

import { AppHeader } from "@/components/layout/app-header";

const pages: Record<string, { title: string; body: string[] }> = {
  cgu: { title: "Conditions Générales d’Utilisation", body: ["MarketFoot est un jeu gratuit de gestion de football virtuel basé sur la Ligue 1. Aucun argent réel n’est en jeu.", "Chaque joueur dispose d’un seul compte et s’engage à ne pas contourner les règles du jeu. Les comptes frauduleux peuvent être sanctionnés par l’administration.", "Le texte juridique définitif doit être fourni et validé par l’éditeur avant la mise en production."] },
  confidentialite: { title: "Politique de confidentialité", body: ["Nous collectons votre adresse e-mail, votre pseudo et les données de jeu nécessaires au fonctionnement du service.", "Vous pouvez modifier vos informations depuis Mon espace et demander la suppression de votre compte.", "Le texte juridique définitif doit être fourni et validé par l’éditeur avant la mise en production."] },
  "mentions-legales": { title: "Mentions légales", body: ["Éditeur, hébergeur et contact : à compléter par l’éditeur du service avant la mise en production."] },
  consentements: { title: "Gérer mes consentements", body: ["MarketFoot n’utilise que les cookies strictement nécessaires (session de connexion, préférence de thème). Aucun cookie publicitaire n’est déposé.", "Aucun consentement supplémentaire n’est à gérer pour le moment."] },
};

export default async function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = pages[slug];
  if (!page) notFound();
  return (
    <div className="ms-shell">
      <AppHeader />
      <main className="app-page" style={{ maxWidth: 760, margin: "24px auto", padding: "0 16px", color: "#121212" }}>
        <h1 style={{ fontSize: 28 }}>{page.title}</h1>
        {page.body.map((text) => <p key={text} style={{ lineHeight: 1.6 }}>{text}</p>)}
        <p><Link href="/mon-espace" style={{ color: "#0b5fff" }}>Retour à Mon espace</Link></p>
      </main>
    </div>
  );
}
