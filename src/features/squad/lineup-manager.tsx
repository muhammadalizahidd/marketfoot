"use client";
import { useState, useTransition } from "react";
import { saveLineup, type LineupActionState } from "./actions";
import { Bench, DisplayModeSwitch, Pitch, PlayerCard, type DisplayMode, type PitchPlayer } from "@/components/team/pitch";
import { TeamTabs } from "@/components/team/team-tabs";
import { BonusPanel, type BonusState } from "@/components/team/bonus-panel";
import { CaptainPanel } from "@/components/team/captain-panel";
import { PlayerPanel } from "@/components/team/player-panel";

export type SquadMemberView = { id:string; name:string; position:string; value:number; isStarter:boolean; isCaptain:boolean; frozen?:boolean; clubName?:string; clubId?:string; valueHistory?:{at:string;before:number}[]; acquiredValue?:number; owners?:number; captainUses?:number; };
const formation:Record<string,number>={FW:3,MF:3,DF:4,GK:1};

export function LineupManager({
  members = [],
  matchdayId = null,
  activeTab = "composition",
  bonus,
  lastMercatoAt = null,
}: {
  members?: SquadMemberView[];
  matchdayId?: string | null;
  activeTab?: string;
  bonus?: BonusState;
  /** End of the last executed transfer window (ISO), the default "since" of the speculation view. */
  lastMercatoAt?: string | null;
}) {
  const [starters,setStarters]=useState(()=>new Set(members.some(m=>m.isStarter)?members.filter(m=>m.isStarter).map(m=>m.id):Object.entries(formation).flatMap(([position,count])=>members.filter(m=>m.position===position).slice(0,count).map(m=>m.id))));
  const [captainId,setCaptainId]=useState(members.find(m=>m.isCaptain)?.id??"");
  const [selected,setSelected]=useState<string|null>(null);
  const [mode,setMode]=useState<DisplayMode>("value");
  const [openPlayerId,setOpenPlayerId]=useState<string|null>(null);
  const [specPeriod,setSpecPeriod]=useState<"mercato"|"date">("mercato");
  const [specDate,setSpecDate]=useState("");
  const [interactionMessage,setInteractionMessage]=useState<string|undefined>();
  
  const [state,setState]=useState<LineupActionState>({});
  const [pending,startTransition]=useTransition();
  const selectedPlayer=members.find(m=>m.id===selected);
  const openPlayer=members.find(m=>m.id===openPlayerId);

  const persistLineup=(nextStarters:Set<string>,nextCaptainId:string,previousStarters=new Set(starters),previousCaptainId=captainId)=>{
    if(!matchdayId){setState({error:"Aucune journée ouverte ne permet actuellement d’enregistrer votre équipe."});return;}
    // Clear stale feedback before the request so that each save has one
    // unambiguous lifecycle: saving, then saved (or a real error).
    setInteractionMessage(undefined);
    setState({});
    const payload=new FormData();
    payload.set("lineup",JSON.stringify({starterIds:[...nextStarters],captainId:nextCaptainId,matchdayId}));
    startTransition(async()=>{
      const result=await saveLineup({} as LineupActionState,payload);
      setState(result);
      if(!result.success){setStarters(previousStarters);setCaptainId(previousCaptainId);}
    });
  };
  
  const ensureEditable=(member:SquadMemberView)=>{
    if(!matchdayId){setInteractionMessage("Aucune journée ouverte ne permet actuellement de modifier votre équipe.");return false;}
    if(member.frozen){setInteractionMessage("Ce joueur est figé : son match commence dans moins de deux heures.");return false;}
    if(pending)return false;
    return true;
  };

  const chooseCaptain=(member:SquadMemberView)=>{
    if(!ensureEditable(member))return;
    if(!starters.has(member.id)){setInteractionMessage("Le capitaine doit être titulaire.");return;}
    const previousCaptainId=captainId;
    setCaptainId(member.id);
    setInteractionMessage(undefined);
    setState({});
    persistLineup(new Set(starters),member.id,new Set(starters),previousCaptainId);
  };

  const choose=(member:SquadMemberView)=>{
    if(activeTab==="capitaine"){chooseCaptain(member);return;}
    if(starters.has(member.id)){
      if(member.frozen){setInteractionMessage("Ce joueur est figé : son match commence dans moins de deux heures.");return;}
      setSelected(selected===member.id?null:member.id);
      setInteractionMessage(undefined);
      setState({});
      return;
    }
    if(!selectedPlayer){setInteractionMessage("Choisissez d’abord un titulaire à remplacer.");return;}
    if(selectedPlayer.position!==member.position){setInteractionMessage("Le remplaçant doit jouer au même poste que le titulaire sélectionné.");return;}
    if(!ensureEditable(member))return;
    const previousStarters=new Set(starters);
    const previousCaptainId=captainId;
    const nextStarters=new Set(starters);nextStarters.delete(selectedPlayer.id);nextStarters.add(member.id);
    const nextCaptainId=captainId===selectedPlayer.id?member.id:captainId;
    setStarters(nextStarters);
    // Keeping the incoming starter as captain preserves a valid lineup when
    // the outgoing player was the current captain.
    if(captainId===selectedPlayer.id)setCaptainId(member.id);
    setSelected(null);
    persistLineup(nextStarters,nextCaptainId,previousStarters,previousCaptainId);
  };
  
  // Value the player had at the start of the chosen period: the value before the first change after it.
  // No period (no Mercato yet, no date picked) falls back to the value at purchase.
  const valueSince=(member:SquadMemberView)=>{
    const since=specPeriod==="date"?(specDate?new Date(`${specDate}T00:00:00`).getTime():null):(lastMercatoAt?Date.parse(lastMercatoAt):null);
    if(since===null||Number.isNaN(since))return member.acquiredValue??member.value;
    const next=(member.valueHistory??[]).find(h=>Date.parse(h.at)>since);
    return next?next.before:member.value;
  };
  const toPitchPlayer=(member:SquadMemberView):PitchPlayer=>{
    const acquired=member.acquiredValue??member.value;
    return {
      id:member.id,name:member.name,clubName:member.clubName,clubId:member.clubId,value:member.value,
      changePct:acquired>0?((member.value-acquired)/acquired)*100:0,
      speculation:member.value-valueSince(member),
      owners:member.owners,
      isCaptain:captainId===member.id||(Boolean(member.isCaptain)&&!captainId),
      frozen:member.frozen,
    };
  };

  const renderSlot=(member:SquadMemberView|undefined,position:string,key:string)=>{
    if(!member)return <PlayerCard key={key} position={position} mode={mode} disabled/>;
    const isBench=!starters.has(member.id);
    const candidate=activeTab==="composition"&&Boolean(selectedPlayer)&&isBench;
    const eligible=Boolean(candidate&&selectedPlayer?.position===member.position&&!member.frozen);
    const ineligible=Boolean(candidate&&!eligible);
    return <PlayerCard key={key} player={toPitchPlayer(member)} position={position} mode={mode}
      state={{selected:selected===member.id,eligible,ineligible}}
      disabled={pending||member.frozen||(activeTab==="capitaine"&&isBench)||ineligible}
      onSelect={()=>choose(member)} onOpenPlayer={setOpenPlayerId}/>;
  };

  const positionOrder = ["FW", "MF", "DF", "GK"];
  const pitchRows=positionOrder.map(position=>{
    const posMembers=members.filter(m=>m.position===position&&starters.has(m.id));
    return Array.from({length:formation[position]}).map((_,i)=>renderSlot(posMembers[i],position,`${position}-${i}`));
  });
  const benchRows=positionOrder.map(position=>{
    const posMembers=members.filter(m=>m.position===position&&!starters.has(m.id));
    return Array.from({length:2}).map((_,i)=>renderSlot(posMembers[i],position,`b-${position}-${i}`));
  });

  return (
    <div className={`tm-workspace${openPlayer?" tm-workspace--with-player":""}`}>
      <div className="tm-main">
        <TeamTabs active={activeTab==="capitaine"?"capitaine":"composition"}/>

        <form onSubmit={(event)=>{event.preventDefault();persistLineup(new Set(starters),captainId);}} noValidate id="lineup-form">
          <input type="hidden" name="lineup" value={JSON.stringify({ starterIds: [...starters], captainId, matchdayId })}/>
          <DisplayModeSwitch mode={mode} onChange={setMode}/>
          {mode==="speculation"&&(
            <div className="tm-spec">
              <label>Spéculation&nbsp;
                <select value={specPeriod} onChange={(e)=>setSpecPeriod(e.target.value as "mercato"|"date")}>
                  <option value="mercato">Depuis le dernier mercato</option>
                  <option value="date">Depuis le…</option>
                </select>
              </label>
              {specPeriod==="date"&&<input type="date" value={specDate} onChange={(e)=>setSpecDate(e.target.value)} aria-label="Depuis le"/>}
            </div>
          )}
          <div className="tm-field">
            <Pitch rows={pitchRows}/>
            <Bench rows={benchRows}/>
          </div>
        </form>


        {!matchdayId && <div className="tm-alert tm-alert--info">Aucune journée ouverte ne permet actuellement d’enregistrer.</div>}
        {(state.error || interactionMessage) && <div className="tm-alert tm-alert--error">{state.error ?? interactionMessage}</div>}
        {pending && <div className="tm-alert tm-alert--info" role="status">Enregistrement des modifications…</div>}
        {!pending && state.success && <div className="tm-alert tm-alert--success" role="status">{state.success}</div>}

      </div>

      <div className="tm-aside">
        {openPlayer&&<PlayerPanel player={{id:openPlayer.id,name:openPlayer.name,clubName:openPlayer.clubName,clubId:openPlayer.clubId,position:openPlayer.position,value:openPlayer.value,acquiredValue:openPlayer.acquiredValue,owners:openPlayer.owners}} onClose={()=>setOpenPlayerId(null)}/>}
        {activeTab === "capitaine" ? (
          <CaptainPanel
            players={members.filter((m) => starters.has(m.id)).map((m) => ({ id: m.id, name: m.name, clubName: m.clubName, captainUses: m.captainUses ?? 0, frozen: m.frozen }))}
            selectedId={captainId}
            onOpenPlayer={(id) => setOpenPlayerId(id)}
            onSelect={(id) => { const member = members.find((m) => m.id === id); if (member) chooseCaptain(member); }}
            disabled={pending || !matchdayId}
          />
        ) : (
          <BonusPanel state={bonus}/>
        )}
      </div>
    </div>
  );
}
