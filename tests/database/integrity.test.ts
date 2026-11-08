import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("migrations, lineup, prediction locks and settlement idempotency",async()=>{
  const db=new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
      create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}'::jsonb,last_sign_in_at timestamptz,email_confirmed_at timestamptz); create table storage.buckets(id text primary key,name text,public boolean default false);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
    for(const file of (await readdir("supabase/migrations")).filter(f=>f.endsWith(".sql")).sort()) {
      try {await db.exec(await readFile(`supabase/migrations/${file}`,"utf8"));}
      catch(error) {throw new Error(`Migration ${file}: ${String(error)}`);}
    }
    const actor="11111111-1111-4111-8111-111111111111",gamer="22222222-2222-4222-8222-222222222222";
    await db.query("insert into auth.users(id,raw_user_meta_data) values($1,'{\"username\":\"AdminTest\"}'),($2,'{\"username\":\"GamerTest\"}')",[actor,gamer]);
    await db.query("update profiles set role='admin' where id=$1",[actor]);
    const season=(await db.query<{id:string}>("insert into seasons(name,starts_on,ends_on,is_current) values('Test','2026-01-01','2026-12-31',true) returning id")).rows[0].id;
    const day=(await db.query<{id:string}>("insert into matchdays(season_id,number,status) values($1,1,'open') returning id",[season])).rows[0].id;
    const clubs:string[]=[];for(let i=0;i<5;i++)clubs.push((await db.query<{id:string}>("insert into clubs(name,short_name) values($1,$2) returning id",[`Club ${i}`,`C${i}`])).rows[0].id);
    const players:{id:string;position:string}[]=[];
    for(const [position,count] of [["GK",3],["DF",6],["MF",5],["FW",5]] as const)for(let i=0;i<count;i++) {
      const p=(await db.query<{id:string}>("insert into players(club_id,first_name,last_name,position,vm_value,marketfoot_value,real_value) values($1,'Test',$2,$3,500000,500000,500000) returning id",[clubs[players.length%5],`Player ${players.length}`,position])).rows[0];players.push({...p,position});
    }
    // The initial balance is catalogue-derived. This unselected player brings the
    // active catalogue average to €725k: €725k × 19 × 80% = €11,020,000.
    await db.query("insert into players(club_id,first_name,last_name,position,vm_value,marketfoot_value,real_value) values($1,'Catalogue','Reference','GK',500000,5000000,5000000)",[clubs[0]]);
    const members=players.map(p=>({playerId:p.id,acquiredValue:500000}));
    await db.query("select create_initial_squad($1,'Test squad',$2::jsonb,11020000)",[gamer,JSON.stringify(members)]);
    assert.equal(Number((await db.query<{budget:string}>("select budget from gamer_finances where gamer_id=$1",[gamer])).rows[0].budget),1520000);
    const starters=[...players.filter(p=>p.position==="GK").slice(0,1),...players.filter(p=>p.position==="DF").slice(0,4),...players.filter(p=>p.position==="MF").slice(0,3),...players.filter(p=>p.position==="FW").slice(0,3)].map(p=>p.id);
    await db.query("select update_squad_lineup($1,$2::uuid[],$3,$4)",[gamer,starters,starters[0],day]);
    await assert.rejects(db.query("select update_squad_lineup($1,$2::uuid[],$3,$4)",[gamer,players.slice(0,11).map(p=>p.id),players[0].id,day]));
    const fixture=(await db.query<{id:string}>("insert into matches(matchday_id,home_club_id,away_club_id,kickoff_at) values($1,$2,$3,now()+interval '1 day') returning id",[day,clubs[0],clubs[1]])).rows[0].id;
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[gamer]);
    await db.query("select save_prediction($1,'1')",[fixture]);await db.query("select save_prediction($1,'N')",[fixture]);
    assert.equal((await db.query<{choice:string}>("select choice from predictions")).rows[0].choice,"N");
    await db.query("update matches set kickoff_at=now()-interval '1 minute' where id=$1",[fixture]);
    await assert.rejects(db.query("select save_prediction($1,'2')",[fixture]));
    await db.query("select admin_transition_matchday($1,$2,'mercado')",[actor,day]);
    await db.query("select admin_transition_matchday($1,$2,'closed')",[actor,day]);
    const settlement=(await db.query<{id:string}>("insert into matchday_settlements(matchday_id,rules_version,requested_by) values($1,'v3.2.0',$2) returning id",[day,actor])).rows[0].id;
    const snap=(await db.query<{id:string;player_id:string}>("select id,player_id from matchday_squad_snapshots where gamer_id=$1 limit 1",[gamer])).rows[0];
    const payload={effects:[{snapshotId:snap.id,gamerId:gamer,playerId:snap.player_id,normalEffect:100000,captainAdjustment:0,gamerEffect:100000,budgetDelta:70000,lockedAccountDelta:30000,calculation:{}}],playerValues:[{playerId:snap.player_id,normalEffect:100000}],predictions:[{gamerId:gamer,eligible:1,correct:1,resultPct:100,averagePct:100,x:0,rawG:480000,earnings:480000,budgetDelta:336000,lockedAccountDelta:144000}]};
    await db.query("update matches set home_score=1,away_score=1 where id=$1",[fixture]);
    const budgetBeforeSettlement=Number((await db.query<{budget:string}>("select budget from gamer_finances where gamer_id=$1",[gamer])).rows[0].budget);
    await assert.rejects(db.query("select commit_matchday_settlement($1,$2,$3::jsonb)",[actor,settlement,JSON.stringify({...payload,predictions:[{...payload.predictions[0],budgetDelta:1}]})]));
    await db.query("select commit_matchday_settlement($1,$2,$3::jsonb)",[actor,settlement,JSON.stringify(payload)]);
    await db.query("select commit_matchday_settlement($1,$2,$3::jsonb)",[actor,settlement,JSON.stringify(payload)]);
    assert.equal(Number((await db.query<{n:number}>("select count(*) n from financial_ledger where settlement_id=$1",[settlement])).rows[0].n),2);
    assert.equal(Number((await db.query<{budget:string}>("select budget from gamer_finances where gamer_id=$1",[gamer])).rows[0].budget),budgetBeforeSettlement+70000+336000);
    assert.equal(Number((await db.query<{n:number}>("select count(*) n from prediction_results where settlement_id=$1 and earnings=480000",[settlement])).rows[0].n),1);
    const predictionRanks=await db.query<{username:string;total_predictions:string}>("select * from read_prediction_rankings($1,'all',34,'',1)",[season]);
    assert.equal(predictionRanks.rows[0].username,"GamerTest");assert.equal(Number(predictionRanks.rows[0].total_predictions),480000);
    assert.equal(Number((await db.query<{real_value:string}>("select real_value from players where id=$1",[snap.player_id])).rows[0].real_value),600000);
    await db.exec("begin");
    await db.query("select rollback_matchday_settlement($1,$2,'Prediction rollback check')",[actor,settlement]);
    assert.equal(Number((await db.query<{budget:string}>("select budget from gamer_finances where gamer_id=$1",[gamer])).rows[0].budget),budgetBeforeSettlement);
    assert.equal(Number((await db.query<{n:number}>("select count(*) n from prediction_results where settlement_id=$1 and reversed_at is not null",[settlement])).rows[0].n),1);
    assert.equal((await db.query("select * from read_prediction_rankings($1,'all',34,'',1)",[season])).rows.length,0);
    await db.exec("rollback");
    const ranks=await db.query<{username:string;rank:number}>("select * from read_rankings($1,'general','all',34,'',1)",[season]);
    assert.equal(ranks.rows[0].username,"GamerTest");
    const clubBefore=(await db.query<{record:unknown}>("select to_jsonb(c) record from clubs c where id=$1",[clubs[0]])).rows[0].record;
    await db.query("select admin_edit_resource($1,'clubs',$2,$3::jsonb,'{\"name\":\"Renamed club\"}'::jsonb)",[actor,clubs[0],JSON.stringify(clubBefore)]);
    await assert.rejects(db.query("select admin_edit_resource($1,'clubs',$2,$3::jsonb,'{\"name\":\"Stale club\"}'::jsonb)",[actor,clubs[0],JSON.stringify(clubBefore)]));
    await assert.rejects(db.query("select admin_delete_resource($1,'clubs',$2)",[actor,clubs[0]]));
    const day2=(await db.query<{id:string}>("insert into matchdays(season_id,number,status) values($1,2,'open') returning id",[season])).rows[0].id;
    const newKeeper=(await db.query<{id:string}>("insert into players(club_id,first_name,last_name,position,vm_value,marketfoot_value,real_value) values($1,'New','Keeper','GK',500000,500000,500000) returning id",[clubs[0]])).rows[0].id;
    const beforeDirect=Number((await db.query<{budget:string}>("select budget from gamer_finances where gamer_id=$1",[gamer])).rows[0].budget);
    await db.query("select complete_direct_transfer($1,$2,$3,$4,500000,500000,50000,$5)",[gamer,day2,players[0].id,newKeeper,beforeDirect-50000]);
    assert.equal(Number((await db.query<{n:number}>("select count(*) n from financial_ledger where event_type='direct_transfer'")).rows[0].n),1);
    await assert.rejects(db.query("select complete_direct_transfer($1,$2,$3,$4,500000,500000,50000,$5)",[gamer,day2,players[0].id,newKeeper,beforeDirect-50000]));
    await db.query("select admin_transition_matchday($1,$2,'mercado')",[actor,day2]);
    const newDefender=(await db.query<{id:string}>("insert into players(club_id,first_name,last_name,position,vm_value,marketfoot_value,real_value) values($1,'New','Defender','DF',500000,500000,500000) returning id",[clubs[3]])).rows[0].id;
    const defender=players.find(p=>p.position==='DF')!;
    const cancelled=(await db.query<{id:string}>("select submit_mercado_order($1,$2,$3,$4,500000,500000,40000,100000) id",[gamer,day2,defender.id,newDefender])).rows[0].id;
    await db.query("select set_config('request.jwt.claim.sub',$1,false)",[gamer]);
    await db.query("select cancel_mercado_order($1)",[cancelled]);
    assert.equal((await db.query<{status:string}>("select status from mercado_orders where id=$1",[cancelled])).rows[0].status,'cancelled');
    const order=(await db.query<{id:string}>("select submit_mercado_order($1,$2,$3,$4,500000,500000,40000,100000) id",[gamer,day2,defender.id,newDefender])).rows[0].id;
    await assert.rejects(db.query("select submit_mercado_order($1,$2,$3,$4,500000,500000,40000,100000)",[gamer,day2,defender.id,newDefender]));
    const values=[{playerId:defender.id,beforeValue:500000,delta:0},{playerId:newDefender,beforeValue:500000,delta:10000}];
    const orders=JSON.stringify([{orderId:order,outcome:'executed'}]);
    await db.query("select commit_mercado_run($1,$2,$3::jsonb,$4::jsonb)",[actor,day2,orders,JSON.stringify(values)]);
    await db.query("select commit_mercado_run($1,$2,$3::jsonb,$4::jsonb)",[actor,day2,orders,JSON.stringify(values)]);
    assert.equal(Number((await db.query<{budget:string}>("select budget from gamer_finances where gamer_id=$1",[gamer])).rows[0].budget),beforeDirect-50000-150800);
    assert.equal(Number((await db.query<{n:number}>("select count(*) n from financial_ledger where event_type='mercado_execution'")).rows[0].n),1);
    await assert.rejects(db.query("select rollback_matchday_settlement($1,$2,'Unsafe old correction')",[actor,settlement]));
  } finally {await db.close();}
});
