import { getRulesSettings } from "./settings";

/** Source §3.2: a team freezes two hours before its kickoff. */
export function getTeamFreezeTime(kickoff: Date): Date {
  return new Date(kickoff.getTime() - getRulesSettings().freeze.hoursBeforeKickoff * 60 * 60 * 1000);
}

export function isTeamFrozen(kickoff: Date, now: Date): boolean { return now >= getTeamFreezeTime(kickoff); }
