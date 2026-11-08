# MarketFoot Admin — Build Plan

Source of truth for requirements: `MARKETFOOT_PRODUCT_FUNCTIONAL_PRD_v1.2.md` (v1.3 content, Game Rules v2 wins on conflicts; §19 Administration, §18 Sanctions).
Source of truth for UI: `UI/Admin/*.png` (31 frames).
Rule of the plan: **missing → build it in the new design; already built → keep the behaviour, restyle it.**

---

## 1. Decisions already taken

| Topic | Decision |
|---|---|
| Bonuses | The **6 PRD bonuses only** (PRD §6.4): Le Cholismo, Le Turpin, Clean Sheets, Sorti du frigo, Caviar en stock, Fergie Time. The 8-bonus list drawn in the Barèmes and Manager-detail mockups is **not** used. |
| Conflicts | Resolved in favour of the latest PRD (see §3). The mockup values are treated as examples. |
| Provisional numbers | Every figure the PRD marks "provisional / pending client" becomes a **Barèmes setting stored in the database**, seeded with the PRD v3.2.0 reference value, so the client can change it without a deploy. |

---

## 2. Screen map: design → route → status → work

Legend: **BUILT** = keep logic, restyle · **PARTIAL** = extend + restyle · **NEW** = build.

| Design (UI/Admin) | Route | Today | Work |
|---|---|---|---|
| Shell (blue sidebar: Dashboard, Saisie, Saison, Mercato, Managers, Barèmes, Paramètres) | `/admin/*` layout | BUILT (different shell) | New shell + tokens + shared components (Phase 0) |
| Dashboard | `/admin` | BUILT (matchday centre, no design) | Restyle; add KPIs. **No frame provided** |
| Saison (list) | `/admin/saison` | PARTIAL (`/admin/seasons`) | Status, team/user counts, search, date + status filters, export, pagination |
| Créer une saison (modal, 3 steps) | modal on `/admin/saison` | PARTIAL (name + dates only) | Clone from a season (teams / squads / value basis), pick 18 teams, add team, save as draft |
| Season detail + team editor (+ "Add a team", "Add a player", move-player confirm) | `/admin/saison/[id]` | PARTIAL (clubs/players are separate generic pages) | Per-season roster, crest upload, inline player table, move-player dialog, validate / draft |
| Saisie (J1–J34 grid, matches, "Déroulé") | `/admin/saisie` | PARTIAL (one record at a time) | 34-day grid, bulk match entry, postpone, schedule panel (freeze, Mercato open/close, thaw), Enregistrer / Publier |
| Saisie feuille de match | `/admin/saisie/[day]/[match]` | PARTIAL (one stat row at a time) | Two-squad sheet, add player, live primes column, draft / validate |
| Mercato — 4 phases (Ouverture, Gel total, MAJ transferts & valeurs, Dégel & transferts libres) | `/admin/mercato` | PARTIAL (review + one execute button) | Stepper, order book with admin cancel, Prolonger / Réouvrir / Annuler, per-player value table, site freeze + thaw, free-transfers log with cancel |
| Managers (list + KPIs) | `/admin/managers` | NEW | Whole screen |
| Manager detail | `/admin/managers/[id]` | NEW | Whole screen |
| Barèmes — Général | `/admin/baremes?tab=general` | NEW (all values hard-coded in `src/rules/config.ts`) | Settings table + editor |
| Barèmes — Primes | `/admin/baremes?tab=primes` | NEW (hard-coded in `src/rules/earnings.ts`) | Scale editor |
| Barèmes — Palmarès | `/admin/baremes?tab=palmares` | NEW (hard-coded in `honours_points()` SQL) | Table-backed honours points |
| Season timeline (Création → Dégel total) | header of Saison / Saisie | NEW | Season lifecycle (draft → validated → active → finished) |
| Paramètres | `/admin/parametres` | NEW | **No frame provided**, see §6 |
| Settlement review / execute / rollback | reached from **Saisie → Publier** | BUILT, **no design** | Keep logic, restyle in the new shell |

Existing admin behaviour that must **survive** the restyle: matchday transitions, `admin_edit_resource` / `admin_delete_resource` (guarded + audited), result entry, player stat upsert/delete, settlement request / execute / rollback, Mercato execute, audit logging, `requireAdmin`.

---

## 3. Conflict resolutions (mockup vs latest PRD)

| # | Mockup says | Latest PRD says | Resolution |
|---|---|---|---|
| 1 | 8 bonuses (Football champagne, Here we go, Prime time…) | 6 bonuses, §6.4 | PRD. Bonus list in Barèmes = the 6; one global "+10 %" gain; per-bonus *max per season* editable (PRD §24 item 22: max still pending, keep 4 as placeholder). |
| 2 | Starting budget: flat **100 000 000 €** | `AVG × 19 × COEFF_INI + NB_MATCHDAY × COEFF_STEP`, 0.8 / 0.02, replacement formula pending (§5.1, §24.2) | PRD. Budget card exposes **COEFF_INI** and **COEFF_STEP**, not a flat sum. |
| 3 | Transfer tax: 10 % free / 8 % Mercato (single values) | Table by window and matchday: Mercato 8/7/6 %, outside 10/9/8 % for MD1–17 / 18–26 / 27–34 (§8.4) | PRD. 2 × 3 grid, cutover matchdays editable. Mockup values = first column. |
| 4 | Pronostics: "gain par bon pronostic 150 k€" + "joueurs d'un même club 4" | `G = ((0.008·x³)+(8·x)+400)·1200`, clamp ±2 M€ (§12.4) | PRD. Card shows the 4 coefficients + the two bounds. The flat-gain field and the club-limit field are dropped (club limit lives under Transferts). |
| 5 | Primes → **Pondération haute / basse** by minute band (PH / PB) | "No playing-time weighting formula is part of the confirmed rules" (§11.7) | PRD. **Not built.** Section left out until the client confirms. |
| 6 | Prime amounts (e.g. goal 250/210/180/150 k€, starter 80 k€, clean sheet 100/100/50/20 k€) | v3.2.0 reference: starter 100 k€, goal 210/190/170 /150 k€ (starter) …, amounts marked provisional (§11.1–11.3, §24.28) | PRD values seed the editor. **Each cell is a starter / substitute pair** (the component frames already show two inputs per cell). Rows follow PRD §11.2–11.3 (includes *Match not played −200 k€*, *Substituted −20 k€*, *Goal conceded from 2nd*). |
| 7 | Team result: 130 / 80 / 30 / −20 / −70 / −120 k€ | Away win +150, home win +100, away draw +50, home draw 0, away loss −50, home loss −150 k€ (§11.4) | PRD, shown as starter / substitute pairs as in the component frame. |
| 8 | Palmarès rows = prime events (placeholder copy) | Honours table: ranks 1st / 2nd / 3rd / 4–10 / 11–20 / 21–30 / 31–50 / 51–100 × 6 columns (§16.1) | PRD. The six columns in the mockup already match; rows replaced with the PRD rank bands. |
| 9 | Mercato timeline Lun 19:00 / Mar 19:00 / Mar 20:00 | Mon 20:00 open (24 h), Tue 20:00 close, Tue 20:30 unfreeze; "times remain configurable" (§7.5) | PRD values as defaults, all editable. Phase mapping: *Ouverture* = window open; *Gel total* = full closure; *MAJ transferts & valeurs* = manual prime / revaluation / post-Mercato update; *Dégel* = reopen. |
| 10 | Locked-account split 70 / 30 | 70 / 30 provisional (§11.6, §24.26) | Matches. Editable. |
| 11 | Freeze 2 h, captain ×2 / max 6, transfers 4 per cycle, same club 4, impacts ±20 k€ with 50 % at Mercato | Same (§23) | Matches. Editable. |
| 12 | Manager screen has "Supprimer le compte" and "Comptes liés" | §18: detect multiple accounts, delete secondary accounts, **reset main account**, delete account | Matches, but add the missing **"Réinitialiser le compte"** action (squad rebuilt, prediction earnings kept). |
| 13 | Bonus counters per manager listing 8 bonuses | 6 bonuses | Counter lists the 6. |

---

## 4. Data and engine work that the screens depend on

These are the "missing functionality" items. Each needs a migration (additive only) and an audit-log entry.

1. **Rules settings** — `rules_settings` (versioned, one active row per key set, with history). The rules engine reads it, falling back to today's constants. Settlements already store `rules_version`, so past settlements stay reproducible.
2. **Season model** — `seasons.status` (`draft`, `pending_validation`, `active`, `finished`); `season_clubs`; per-season roster for squads and start values. *Decision D1 below.*
3. **Club identity** — full name, abbreviation, crest upload (storage bucket, as `avatars` already works).
4. **Matchday schedule** — Mercato open / close, unfreeze, and a site-freeze flag per matchday; freeze offset from settings.
5. **Mercato controls** — extend the phase machine beyond `draft → open → mercado → closed`: prolong, reopen, cancel (a rollback for `mercado_runs`, none exists today), manual value update step, thaw.
6. **Free transfers** — admin cancel for `direct_transfers` (must reverse budget ledger entries, following the pattern of `rollback_matchday_settlement`).
7. **Managers** — `profiles.status` (active / inactive / banned), last sign-in and email read from the auth system, sign-in IP capture for linked accounts, ledger-based budget / locked-account corrections, account reset, captain-counter reset.
8. **Bonus play (player side)** — today the Bonus panel is display-only and settlement has **no bonus logic at all**. Needs `bonus_catalogue` (the 6, enabled flag, max per season), `bonus_plays` (gamer, matchday, bonus), selection UI saved from the Bonus panel (lock 2 h before first match of the matchday), and the +10 % in settlement. The admin "Compteur Bonus" reset depends on this.
9. **Honours points** — move the hard-coded `honours_points()` values to a table fed by Barèmes → Palmarès.
10. **Audit log viewer** — table is written already; add a read screen.

---

## 5. Build phases

Each phase ends with: typecheck + lint clean, migration applied to the test project, real-data check with the QA gamer, screenshots against the frames, and an audit-log check for every write.

### Phase 0 — Foundation (no behaviour change)
- `admin.css` with tokens from the frames (blue sidebar, grey canvas, white rounded cards, DM Sans); remove the old `admin-*` rules from `globals.css`.
- New shell and navigation (7 items). Old routes (`/admin/seasons`, `/admin/mercado`, `/admin/fixtures`, `/admin/settlements`) redirect to the new ones.
- Shared components: `DataTable` (search, filters, export, "10 résultats par page · sur N pages"), `StatusChip`, `Modal`, `ConfirmDialog`, `PhaseStepper`, `PillTabs`, `Breadcrumb`, `KpiCard`, `MoneyField`, `SearchSelect` (team / player).
- Restyle the existing Dashboard.

### Phase 1 — Barèmes (everything else reads from it)
- Migration `rules_settings` + engine wiring with fallback.
- Three tabs, seeded from the PRD (§3 above). Save with version bump + audit entry; "restore previous version".
- **Verify:** change a value, settle a test matchday, confirm the new `rules_version` and amounts.

### Phase 2 — Saison
- Migration for status, `season_clubs`, roster, crest.
- List + create modal + detail / team editor + add team / add player + move-player dialog.
- Existing guards stay (owned players cannot be silently reassigned; deletions blocked when history exists).

### Phase 3 — Saisie and match sheet
- 34-day grid, bulk match entry, postpone, schedule panel, Enregistrer / Publier.
- Match sheet over the existing `player_match_stats` upsert, with a live primes column from the rules engine.
- **Publier** = existing "request settlement" → restyled review → execute / rollback.

### Phase 4 — Mercato
- Phase stepper over the extended phase machine; order book with admin cancel (reuses the order-cancel logic); value table from `buildMercadoReview`; Mercato rollback; site freeze / thaw; free-transfers log with cancel.

### Phase 5 — Managers (and bonus play)
- Bonus catalogue / plays / selection / settlement first (player side), then list, detail, ban / delete / reset, linked accounts, corrections, counters.

### Phase 6 — Dashboard, Paramètres, close-out
- Dashboard KPIs, Paramètres, audit-log viewer, end-of-season action (honours award is already a DB function with no trigger), historical-correction and recalculation entry points (PRD §19.4–19.5).

---

## 6. Gaps the designs do not cover (built in the same visual language, to confirm)

| Gap | Proposal |
|---|---|
| **Dashboard** frame missing | Keep the current matchday centre, restyled, plus the three KPIs used on Managers. |
| **Paramètres** frame missing | Admin accounts and roles, default schedule times, freeze offset, maintenance / site-freeze switch. |
| **Settlement review** frame missing | Reuse the table / card patterns of Mercato; reached from Saisie → Publier. |
| **Audit log, recalculation, historical correction** (PRD §19.4–19.5) | Tables + confirm dialogs in the shared components. |
| **Account reset** (PRD §18) | Button next to "Supprimer le compte", with a ConfirmDialog. |

---

## 7. Decisions needed

| ID | Question | Recommendation |
|---|---|---|
| D1 | The data model is single-season today (`players.club_id`). Per-season rosters: add a roster table, or keep `players.club_id` and snapshot values at season end (`player_value_history` exists)? | Roster table: it is what "reprendre les effectifs" and "valeur de fin de saison" need. |
| D2 | What does **Banni** do: block login, or hide from rankings only? | Block login (auth ban) and keep the data. |
| D3 | Linked-account detection needs sign-in IPs stored (privacy / consent). OK? | Store a hashed IP with a retention limit; mention in the privacy policy. |
| D4 | Pronostics: confirm the client wants the PRD formula, not a flat gain per correct prediction. | PRD formula (§12.4). |
| D5 | Is the minute-band weighting (PH / PB) a real requirement? | Out until confirmed in writing (PRD §11.7). |
| D6 | Mercato cancel after execution: allowed? It reverses budgets and values. | Allowed only before values are published, and always audited. |

PRD items still open on the client side (kept as editable settings meanwhile): initial-budget formula, final tax rates and cutovers, prime / malus amounts, meaning of the `*` on hat trick and 8+ saves, negative prediction `G`, bonus maximum per season, reset scope for ghosting.

---

## 8. Implementation status (8 November 2026)

All six phases are built, with decisions D1–D6 taken as recommended. Migrations `202611080022` → `202611080027` are applied to the hosted project.

| Area | Built |
|---|---|
| Shell, components | `admin.css`, `components/admin/{ui,client}.tsx`, 7-item navigation; legacy routes redirect |
| Barèmes | `rules_settings` (versioned) + `rules/settings.ts`; the rules engine, tax, budget coefficients, predictions, honours (SQL `honours_points`) and `provision_initial_finance` read it; 3 tabs, history, restore |
| Saison | Lifecycle (`draft → pending_validation → active → finished`), per-season clubs and rosters, create modal with cloning, detail + team editor, crest upload, move-player confirmation, validate / finish, CSV export |
| Saisie | J1–J34 grid, bulk matches, postpone, "Déroulé" schedule, Publier; full match sheet with live primes; settlement review kept (`/admin/saisie/publication`) |
| Mercato | 4-stage stepper, order book + admin cancel, extend, freeze / reopen, update values, **rollback**, thaw, site freeze (player writes are blocked + banner), free-transfer log + **cancel** |
| Managers | List + KPIs + export; detail (profile, finances correction, team by matchday, transfers, linked accounts, counters, ban / unban, reset, delete-or-anonymise, e-mail actions) |
| Bonus | `bonus_plays`, `play_bonus` RPC, interactive player panel with real counters and the 2 h lock, +gain % paid at settlement (`rules/bonus.ts`, 7 tests) |
| Dashboard, Paramètres | KPIs and to-do list; default Mercato calendar, manual site freeze, admin accounts, audit-log viewer, IP-hash purge |

### Behaviours worth knowing
- **Structural rules stay in the database** and are shown read-only in Barèmes: 4 transfers per cycle, 4 players per club, 6 captain uses, 2 h freeze.
- **Mercato rollback** only works for runs executed after migration 025 (older runs did not record the replaced squad member).
- **Delete account** removes the account when it has no history; otherwise it is anonymised and locked (ledger and rankings keep their foreign keys).
- **Account reset** empties the squad, restores the initial budget and keeps the Blocked Account (PRD §24.20 still open).
- **Bonus payout** is folded into the gamer's largest starter effect so each settlement row stays balanced and rollbacks reverse it.
- **Not applied:** minute-band weighting (PH / PB), "triplé" and "8 arrêts" (PRD §11.7, §24.7).

### Not yet exercised end-to-end
The admin pages were type-checked and linted, the rules (30 tests) and the new SQL functions were checked directly in the database (guards, settings flow, rollback of a test transaction), but the screens have **not** been clicked through with an admin session. First pass to do: Barèmes save → Saison create / validate → Saisie → Mercato stages → Managers.
