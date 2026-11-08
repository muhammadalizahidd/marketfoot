"use client";
import { useState, useTransition } from "react";
import { saveLineup, type LineupActionState } from "./actions";
import { Bench, DisplayModeSwitch, Pitch, PlayerCard, type DisplayMode, type PitchPlayer } from "@/components/team/pitch";
import { TeamTabs } from "@/components/team/team-tabs";
import { BonusPanel, type BonusState } from "@/components/team/bonus-panel";
import { CaptainPanel } from "@/components/team/captain-panel";

export type SquadMemberView = { id:string; name:string; position:string; value:number; isStarter:boolean; isCaptain:boolean; frozen?:boolean; clubName?:string; acquiredValue?:number; owners?:number; captainUses?:number; };
const formation:Record<string,number>={FW:3,MF:3,DF:4,GK:1};

export function LineupManager({
  members = [],
  matchdayId = null,
  activeTab = "composition",
  bonus,
}: {
  members?: SquadMemberView[];
  matchdayId?: string | null;
  activeTab?: string;
  bonus?: BonusState;
}) {
  const [starters,setStarters]=useState(()=>new Set(members.some(m=>m.isStarter)?members.filter(m=>m.isStarter).map(m=>m.id):Object.entries(formation).flatMap(([position,count])=>members.filter(m=>m.position===position).slice(0,count).map(m=>m.id))));
  const [captainId,setCaptainId]=useState(members.find(m=>m.isCaptain)?.id??"");
  const [selected,setSelected]=useState<string|null>(null);
  const [mode,setMode]=useState<DisplayMode>("value");
  const [interactionMessage,setInteractionMessage]=useState<string|undefined>();
  
  const [state,setState]=useState<LineupActionState>({});
  const [pending,startTransition]=useTransition();
  const selectedPlayer=members.find(m=>m.id===selected);

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
  
  const toPitchPlayer=(member:SquadMemberView):PitchPlayer=>{
    const acquired=member.acquiredValue??member.value;
    return {
      id:member.id,name:member.name,clubName:member.clubName,value:member.value,
      changePct:acquired>0?((member.value-acquired)/acquired)*100:0,
      // Until a "since last Mercato" snapshot exists, speculation is the gain since purchase.
      speculation:member.value-acquired,
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
      onSelect={()=>choose(member)}/>;
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
    <div className="tm-workspace">
      <div className="tm-main">
        <TeamTabs active={activeTab==="capitaine"?"capitaine":"composition"}/>

        <form onSubmit={(event)=>{event.preventDefault();persistLineup(new Set(starters),captainId);}} noValidate id="lineup-form">
          <input type="hidden" name="lineup" value={JSON.stringify({ starterIds: [...starters], captainId, matchdayId })}/>
          <DisplayModeSwitch mode={mode} onChange={setMode}/>
          <div className="tm-field">
            <Pitch rows={pitchRows}/>
            <Bench rows={benchRows}/>
          </div>
        </form>

        {activeTab === "composition" && (
          <p className="tm-note">Pour changer ta compo, clique sur un titulaire et choisis son remplaçant parmi les joueurs de ton banc de touche. Les deux joueurs doivent jouer au même poste.</p>
        )}
        {activeTab === "capitaine" && (
          <p className="tm-note">Choisis ton capitaine parmi tes titulaires : ses primes seront doublées lors de la prochaine journée. Chaque joueur ne peut être capitaine que 6 fois par saison.</p>
        )}

        {!matchdayId && <div className="tm-alert tm-alert--info">Aucune journée ouverte ne permet actuellement d’enregistrer.</div>}
        {(state.error || interactionMessage) && <div className="tm-alert tm-alert--error">{state.error ?? interactionMessage}</div>}
        {pending && <div className="tm-alert tm-alert--info" role="status">Enregistrement des modifications…</div>}
        {!pending && state.success && <div className="tm-alert tm-alert--success" role="status">{state.success}</div>}

      </div>

      <div className="tm-aside">
        {activeTab === "capitaine" ? (
          <CaptainPanel
            players={members.filter((m) => starters.has(m.id)).map((m) => ({ id: m.id, name: m.name, clubName: m.clubName, captainUses: m.captainUses ?? 0, frozen: m.frozen }))}
            selectedId={captainId}
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
