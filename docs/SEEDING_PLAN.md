# Seeding plan — test platform data

Goal: give the hosted **test** Supabase project a believable population so Classements, Hall of Fame, friends, honours and the sidebar can be verified (and demoed) without hand-entered data. Never run against a production project.

## Layers

| Layer | Script | Creates |
|---|---|---|
| 1. QA gamer + QA season | `scripts/qa-seed.ts` | `QA_Claude`, "QA Season 2026/2027" (current), 4 matchdays (3 settled), 36 matches, player stats, 3 settlements, 2 direct transfers, 3 Mercato orders, past honours |
| 2. Community | `scripts/seed-community.ts` | 23 managers `seed.NN@marketfoot.test` (see below) |
| 3. Admin QA | `scripts/qa-admin-seed.ts` | admin account for console checks |

Run order: `npx tsx scripts/qa-seed.ts` then `npx tsx scripts/seed-community.ts`. Both are idempotent; `--reset` removes only what that script created.

## What the community seed writes (per manager)

- **Profile:** username, generated SVG portrait uploaded to the public `avatars` bucket (`seed/…`), random favourite club.
- **Squad:** random valid 18-player squad (3 GK / 6 DF / 5 MF / 5 FW, ≤ 4 per club, within the initial budget) through the production `create_initial_squad` RPC.
- **Per settled matchday (1–3):** squad snapshots, starter earnings and bench earnings (`settlement_player_effects`), `settlement_gamer_effects`, `ranking_snapshots` (ranks recomputed for everyone, QA gamer included), `prediction_results`.
- **Transfers:** ~75 % of managers make 1–2 direct transfers on the open matchday (through `complete_direct_transfer`, so tax/quota rules apply) → Spéculation ranking.
- **Mercato:** 1–3 executed orders on the last settled matchday, buying from a shared pool of 14 popular players → Hall of Fame Achats / Ventes records. The script temporarily sets that matchday to `mercado` (a trigger only accepts orders when Mercato is open) and restores its status.
- **Social:** QA_Claude follows 8 managers; managers follow 2 others each (friends filter).
- **Honours:** `award_season_honours` for the QA season, plus past-season rows for 14 managers (Palmarès ranking, TOP 10/20/30).

## Deliberate limits

- `gamer_finances` is not changed: gains live only in the settlement reports, so a seeded manager's budget on My Team stays at its initial value.
- Same manager can appear several times in Hall of Fame (records are per matchday).
- Passwords of seeded managers are random and not stored; sign in as `QA_Claude` (credentials in `.figma-cache/qa-credentials.json`).
- Portraits are generated placeholders, not photos.

## Suggested next layers (not built)

1. A second settled season so "Par saison" and the season selector show different data.
2. Bench / starter swaps and captain assignments in the snapshots so lineup history has variety.
3. Real photo avatars for a handful of managers once the client supplies assets.
4. A `--managers N` flag if more rows are needed to test pagination at 44 pages (Figma shows 200 results).
