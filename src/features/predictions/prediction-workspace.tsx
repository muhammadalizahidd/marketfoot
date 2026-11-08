"use client";

import { useState } from "react";
import Link from "next/link";

import { Bench, DisplayModeSwitch, Pitch, PlayerCard, type DisplayMode, type PitchPlayer } from "@/components/team/pitch";
import { TeamTabs } from "@/components/team/team-tabs";
import { PredictionChoice } from "./prediction-choice";

type TacticalMember = {
  id: string;
  name: string;
  position: string;
  value: number;
  isStarter: boolean;
  isCaptain: boolean;
  clubName?: string;
  acquiredValue?: number;
  owners?: number;
};

type PredictionFixture = {
  id: string;
  homeClub: string;
  awayClub: string;
  kickoffAt: string;
  choice?: string;
  closed: boolean;
  postponed: boolean;
  outcome?: string;
  score?: string;
};

type PredictionResult = { correct: number; eligible: number; resultPct: number; averagePct: number; earnings: number; budget: number; locked: number };
const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });

const formation: Record<string, number> = { FW: 3, MF: 3, DF: 4, GK: 1 };
const positionOrder = ["FW", "MF", "DF", "GK"];

function formatKickoff(value: string) {
  const date = new Date(value);
  const parts = new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: "Europe/Paris",
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("weekday").replace(".", "")} ${part("day")}/${part("month")} · ${part("hour")}h${part("minute")}`;
}

function toPitchPlayer(member: TacticalMember): PitchPlayer {
  const acquired = member.acquiredValue ?? member.value;
  return {
    id: member.id,
    name: member.name,
    clubName: member.clubName,
    value: member.value,
    changePct: acquired > 0 ? ((member.value - acquired) / acquired) * 100 : 0,
    speculation: member.value - acquired,
    owners: member.owners,
    isCaptain: member.isCaptain,
  };
}

export function PredictionWorkspace({
  members,
  fixtures,
  matchdayNumber,
  previousMatchdayHref,
  nextMatchdayHref,
  result,
}: {
  members: TacticalMember[];
  fixtures: PredictionFixture[];
  matchdayNumber?: number;
  previousMatchdayHref?: string;
  nextMatchdayHref?: string;
  result?: PredictionResult;
}) {
  const starters = members.some((member) => member.isStarter)
    ? new Set(members.filter((member) => member.isStarter).map((member) => member.id))
    : new Set(positionOrder.flatMap((position) => members.filter((member) => member.position === position).slice(0, formation[position]).map((member) => member.id)));

  const [displayMode, setDisplayMode] = useState<DisplayMode>("value");
  const slot = (member: TacticalMember | undefined, position: string, key: string) =>
    member ? <PlayerCard key={key} player={toPitchPlayer(member)} position={position} mode={displayMode} disabled /> : <PlayerCard key={key} position={position} mode={displayMode} disabled />;
  const pitchRows = positionOrder.map((position) => {
    const players = members.filter((member) => member.position === position && starters.has(member.id));
    return Array.from({ length: formation[position] }).map((_, index) => slot(players[index], position, `${position}-${index}`));
  });
  const benchRows = positionOrder.map((position) => {
    const players = members.filter((member) => member.position === position && !starters.has(member.id));
    return Array.from({ length: 2 }).map((_, index) => slot(players[index], position, `b-${position}-${index}`));
  });

  return (
    <div className="tm-workspace prediction-workspace">
      <div className="tm-main tm-main--static">
        <TeamTabs active="pronostics" />
        <DisplayModeSwitch mode={displayMode} onChange={setDisplayMode} />
        <div className="tm-field" aria-label="Votre équipe">
          <Pitch rows={pitchRows} />
          <Bench rows={benchRows} />
        </div>
        <p className="tm-note">Pour valider tes pronostics, il te suffit de remplir la grille.</p>
      </div>

      <div className="tm-aside">
      <aside className="tm-panel prediction-drawer" aria-label="Grille de pronostics">
        <header className="tm-panel-head">
          <h2>Pronostics</h2>
          <nav className="prediction-matchday" aria-label="Changer de journée">
            {previousMatchdayHref ? <Link href={previousMatchdayHref} aria-label="Journée précédente">‹</Link> : <span aria-hidden="true">‹</span>}
            <b>J{matchdayNumber ?? "—"}</b>
            {nextMatchdayHref ? <Link href={nextMatchdayHref} aria-label="Journée suivante">›</Link> : <span aria-hidden="true">›</span>}
          </nav>
        </header>
        {result && <section className="prediction-summary" aria-label="Résultat des pronostics"><p><b>{result.correct}/{result.eligible}</b> bons pronostics ({result.resultPct.toFixed(0)} %) · moyenne {result.averagePct.toFixed(0)} %</p><p>Gain : <b>{euro.format(result.earnings)}</b> (budget {euro.format(result.budget)} · compte bloqué {euro.format(result.locked)})</p></section>}
        <div className="prediction-drawer-list">
          {fixtures.map((fixture) => (
            <article className="prediction-drawer-row" key={fixture.id}>
              <div>
                <h2>{fixture.homeClub} - {fixture.awayClub}</h2>
                <time dateTime={fixture.kickoffAt}>{formatKickoff(fixture.kickoffAt)}</time>
                {fixture.postponed && <p>Match reporté</p>}
              </div>
              <PredictionChoice matchId={fixture.id} choice={fixture.choice} closed={fixture.closed} />
            </article>
          ))}
          {!fixtures.length && <p className="prediction-drawer-empty">Aucun match programmé pour cette journée.</p>}
        </div>
      </aside>
      </div>
    </div>
  );
}
