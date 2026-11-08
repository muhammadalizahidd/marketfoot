"use client";
export default function ErrorPage({reset}:{reset:()=>void}){return <main className="app-page"><section className="empty-state"><h1>Chargement impossible</h1><p>Vos données n’ont pas pu être chargées. Vérifiez votre connexion et réessayez.</p><button className="primary-action" onClick={reset}>Réessayer</button></section></main>;}
