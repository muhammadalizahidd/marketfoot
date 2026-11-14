"use client";
import { useActionState } from "react";
import { savePrediction } from "./actions";
export function PredictionChoice({matchId,choice,closed,outcome}:{matchId:string;choice?:string;closed:boolean;outcome?:string}) {
  const [state,action,pending]=useActionState(savePrediction,{});
  return <form noValidate action={action} className="prediction-choice"><input type="hidden" name="matchId" value={matchId}/><div role="group" aria-label="Pronostic : domicile, nul ou extérieur">{["1","N","2"].map(value=><button key={value} name="choice" value={value} disabled={closed||pending} aria-pressed={(state.choice??choice)===value} data-result={outcome&&(state.choice??choice)===value?(outcome===value?"correct":"wrong"):undefined} title={value==="1"?"Victoire à domicile":value==="N"?"Match nul":"Victoire à l’extérieur"}>{value}</button>)}</div>{state.error&&<p role="alert" className="form-error">{state.error}</p>}{state.success&&<p role="status" className="form-success">{state.success}</p>}</form>;
}
