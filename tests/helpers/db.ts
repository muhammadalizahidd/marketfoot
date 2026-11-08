import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

/** In-memory Postgres with every migration applied and minimal Supabase stubs (auth, storage). */
export async function bootDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create schema storage;
    create table auth.users(id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb, last_sign_in_at timestamptz, email_confirmed_at timestamptz);
    create table storage.buckets(id text primary key, name text, public boolean default false);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;`);
  for (const file of (await readdir("supabase/migrations")).filter((f) => f.endsWith(".sql")).sort()) {
    try { await db.exec(await readFile(`supabase/migrations/${file}`, "utf8")); } catch (error) { throw new Error(`Migration ${file}: ${String(error)}`); }
  }
  return db;
}

export const ADMIN = "11111111-1111-4111-8111-111111111111";
export const GAMER = "22222222-2222-4222-8222-222222222222";
export const GAMER2 = "33333333-3333-4333-8333-333333333333";

type Q = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

/** Season with `clubs` clubs, a full 19-player squad bought by GAMER, and 8 spare players per club. Returns ids. */
export async function seedWorld(db: PGlite) {
  const q: Q = async (sql, params) => (await db.query(sql, params as never)).rows as never;
  await db.query("insert into auth.users(id,email,raw_user_meta_data) values($1,'admin@test.dev','{\"username\":\"AdminTest\"}'),($2,'gamer@test.dev','{\"username\":\"GamerTest\"}'),($3,'gamer2@test.dev','{\"username\":\"GamerTwo\"}')", [ADMIN, GAMER, GAMER2]);
  await db.query("update profiles set role='admin' where id=$1", [ADMIN]);
  const season = (await q<{ id: string }>("insert into seasons(name,starts_on,ends_on,is_current,status) values('S1','2026-08-01','2027-06-01',true,'active') returning id"))[0].id;
  const clubs: string[] = [];
  for (let i = 0; i < 6; i++) clubs.push((await q<{ id: string }>("insert into clubs(name,short_name) values($1,$2) returning id", [`Club ${i}`, `C${i}`]))[0].id);
  for (const club of clubs) await db.query("insert into season_clubs(season_id,club_id) values($1,$2)", [season, club]);
  const squad: { id: string; position: string }[] = [];
  const spare: { id: string; position: string; club: string }[] = [];
  let n = 0;
  for (const [position, count] of [["GK", 3], ["DF", 6], ["MF", 5], ["FW", 5]] as const) for (let i = 0; i < count; i++) {
    const club = clubs[n % 5]; n += 1;
    squad.push({ id: (await q<{ id: string }>("insert into players(club_id,first_name,last_name,position,vm_value,marketfoot_value,real_value) values($1,'T',$2,$3,1000000,1000000,1000000) returning id", [club, `P${n}`, position]))[0].id, position });
  }
  for (const position of ["GK", "DF", "MF", "FW"]) for (let i = 0; i < 3; i++) {
    n += 1;
    spare.push({ id: (await q<{ id: string }>("insert into players(club_id,first_name,last_name,position,vm_value,marketfoot_value,real_value) values($1,'S',$2,$3,1000000,1000000,1000000) returning id", [clubs[5], `S${n}`, position]))[0].id, position, club: clubs[5] });
  }
  // Expensive reference players lift the catalogue average so the initial budget affords the 19-player squad.
  for (let i = 0; i < 5; i++) await db.query("insert into players(club_id,first_name,last_name,position,vm_value,marketfoot_value,real_value) values($1,'R',$2,'FW',6000000,6000000,6000000)", [clubs[5], `R${i}`]);
  for (const p of [...squad, ...spare]) await db.query("insert into season_players(season_id,player_id,club_id,start_value) select $1,id,club_id,marketfoot_value from players where id=$2", [season, p.id]);
  const day = (await q<{ id: string }>("insert into matchdays(season_id,number,status) values($1,1,'open') returning id", [season]))[0].id;
  const budget = Number((await q<{ v: string }>("select public.initial_budget_value() v"))[0].v);
  await db.query("select create_initial_squad($1,'Squad A',$2::jsonb,$3)", [GAMER, JSON.stringify(squad.map((p) => ({ playerId: p.id, acquiredValue: 1000000 }))), budget]);
  const squadId = (await q<{ id: string }>("select id from squads where gamer_id=$1", [GAMER]))[0].id;
  return { q, season, clubs, squad, spare, day, squadId, budget };
}
