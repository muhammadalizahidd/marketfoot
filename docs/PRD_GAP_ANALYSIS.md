# PRD v1.3 vs platform — implemented / to implement

Audit date: 2026-11-15. Spec: `MARKETFOOT_PRODUCT_FUNCTIONAL_PRD_v1.2.md` (v1.3 content, Game Rules v2 wins).
Method: five read-only code audits (one per PRD slice) plus runs of the automated checks. Nothing was clicked through in a browser by the auditors; "UNVERIFIED" means present in code but not exercised.

**Automated checks:** rules tests 32/32 pass · database tests 13/13 pass · `tsc` clean · ESLint on `src scripts tests`: 0 errors, 34 warnings.
**Status legend:** DONE · PARTIAL · MISSING · PRD-OPEN (client has not decided) · UNVERIFIED.

---

## A. Confirmed defects to fix (highest priority)

| # | Gap | PRD | Detail |
|---|---|---|---|
| 1 | **Bench players credit the Budget** | §11.1, §6 (v1.3) | `calculateSettlementEffect` (src/rules/settlement.ts) runs `distributeEarnings` for every snapshot, starter or not. v1.3: only starters feed the Budget; bench primes are a separate tally (squad value + Bench ranking only). Verified by reading the code. |
| 2 | **Postponed-match deferred earnings** | §13 | Postponed players are skipped and counted only. No store of the original starters, no payout (70/30) when the match is later played, no value increase. |
| 3 | **Squad built while frozen is not held back** | §6.2 | `activation_matchday_id` is written but never read. |
| 4 | **Tax / commission trusted from the app** | §8.4, §9 | `complete_direct_transfer` and `submit_mercado_order` only check `p_tax >= 0`. Recompute from `rules_settings` in SQL. |
| 5 | **Honours awarded only at season end** | §16.1 | First-half and matchday badges are not awarded when their period ends; "Primes" honours use a cumulative snapshot that includes the bench. |
| 6 | **Rank-change arrows wrong for phases** | §15.1 | `prev_rank` uses `p_day - 1`, ignored by the first/second-half windows. None on Palmarès. |
| 7 | **Hard-coded values bypass Barèmes** | §23 | Initial-budget coefficients (0.8 / 0.02) in migration 0017; ±10k/±20k demand and the 500 000 floor in SQL and `mercado-execution-service.ts`. Editing Barèmes will not change them. |
| 8 | **Hall of Fame reads capped at 20 000–50 000 rows** | §16A | `.limit()` truncates silently on large data. Move aggregation into SQL. |

## B. Missing features

| Feature | PRD | Note |
|---|---|---|
| "Next match in…" countdown in the shell | §1.3, §20.4 | Not found anywhere. |
| Public match profile page (score boxes link to it) | §26.2, §27 | Only `admin/saisie/[day]/[match]` exists. |
| Player profile page / filled quick-profile panel (goals, assists, cards, last scores) | §20.9, §27 | `player-panel.tsx` is a shell with a close button. No `/joueurs/[id]`. |
| Free unlimited transfers until the initial squad is validated | §6.2 | No "validated" state. |
| Mercato 24 h window / thaw enforced automatically | §7.5, §9.1 | Hours are free admin input; every phase change is a manual admin step. No scheduler. |
| Prediction UI: real result shown, "can no longer be changed" tooltip | §12.6, §26.1 | Only the picked button turns green/red. |
| Dedicated Transaction History screen with filters | §5, §20 | Fields are PRD-OPEN; history exists per matchday. |
| Duplicate-account report for admins | §18 | Only a per-manager "comptes liés" card (same hashed IP). |
| Historical browser and a distinct "full closure" trigger | §19.4 | Publish = distribute; no browser for past sheets/values. |
| Chosen trophy shown in all rankings | §16.2 | Shown in the sidebar only. |
| Friends tab search | §17 | Not found. |
| Players: clean-sheets column, goalkeeper column swap | §15.2 | Not found. |
| Players Mercato record (buy/sell gain) in Hall of Fame | §16A | PRD itself inconsistent (§24 item 23). Only the manager version exists. |
| Several tooltips (captain N times, limit message, +/−) | §26.1 | Partial. |

## C. Partial

| Feature | PRD | What is missing |
|---|---|---|
| Real value formula | §10.3 | Only the prime term is applied; the ±10k `a`/`v` term is never applied. PRD-OPEN (§10.5). |
| Demand effect on direct transfers | §10.4 | Value moves only at Mercato execution; direct transfers apply no ±20k. Confirm intent. |
| Sidebar ranking window | §15.1/§20.4 | Shows top 3 + me + next 2, not centred on the gamer. |
| Sidebar "Mon effectif" | §15.2 | Shows wealth − budget (squad + blocked), not pure squad value. |
| Admin console (every function) | §19 | Built but **never clicked through with an admin session**. Correction = rollback + republish, no automatic cascade. |
| Players/matches CRUD on an *active* season | §19.1–19.2 | Roster editing seen only in draft seasons. |
| Responsive layout | §22 | ~25 media queries; phone width never checked on most screens. |
| Terminology | §2.1 | Code, routes and admin still say "Mercado"; PRD says "Mercato". |
| Profile season selector | §17 | A label, not confirmed working. |
| My Space | §17 | Title maps to `bio`; consent/legal links not verified. |
| Player/match links everywhere | §26.2 | Gamer links done; player and match links not checked. |

## D. PRD-OPEN (nothing to build until the client answers)

Year-1 value update and initial-value formula (§10.2) · initial-budget formula replacement · bonus scales and per-season cap (placeholder 4) · tax tables · negative prediction payout and which gamers form the average (§12.5) · ranking eligibility and tie-break (currently by gamer id) · hat-trick and 8-saves bonus lines · GK-only saves · Performance Index bar · phase names (Freeze/Fixing/Open) · reset-account scope for rankings/trophies/history · Mercato under Managers vs Players (§24 item 23) · transaction-history fields.

## E. Done (verified in code)

- **Auth & onboarding:** welcome, sign-up (username/e-mail/password), Google OAuth (needs provider configured), team creation, 3/6/5/5 squad with budget and 4-per-club checks.
- **Football data:** results, player stats, postponed flag, admin edits with audit, Year 0 values supplied as data.
- **Finance:** budget, blocked account (70/30, negatives 100 % to Budget), ledger, total wealth.
- **Squad & lineup:** 1-4-3-3, captain rules (starter, ≤ 6 uses, counter UI), freeze = kickoff − 2 h enforced in SQL, one bonus per matchday locked 2 h before first match.
- **Transfers:** combined quota of 4, cancellation frees a slot, same-club projection, negative-budget exception, tax tables 8/7/6 and 10/9/8.
- **Mercato:** order book, acceptance rule, closing price (±20k ÷ 2, floor 500 000), initial-squad sales not counted, commission 100 000, execution RPC.
- **Earnings:** prime tables, malus, team result, captain ×2, six bonuses, 70/30 split (all match the PRD tables).
- **Predictions:** 1/N/2 until kickoff, formula G with ±2 M clamp, 70/30, rolled into settlement.
- **Rankings (rebuilt 2026-11-15):** six rankings, periods, search, friends filter, sorting, paging, favourite club, rank delta for the matchday view.
- **Honours & Hall of Fame:** points table identical to PRD 16.1, trophy selection, podium/top 10/own rank, profile pictures, per-matchday and per-season scope.
- **Friends & profiles:** private one-way follows, public profile, performance chart, matchday history, My Space (avatar, username, club, password, theme, deletion).
- **Admin:** dashboard, saisie (grid, match sheet, postpone), saison, mercato phases, managers (ban/delete/reset/adjust), Barèmes in DB, parameters, audit log, role promotion.
- **Screens:** all primary-navigation routes, Ligue 1 results/ranking (general/home/away), club profile.

## F. Suggested order of work

1. **Correctness:** items A1 (bench), A4 (server-side tax), A3 (activation), A7 (Barèmes everywhere), A6 (rank deltas).
2. **Postponed-match deferral (A2)** — design the deferred-earnings table first.
3. **Admin click-through** with a real admin login (blocks sign-off of §19).
4. **Missing screens:** match profile, player profile/quick panel, countdown, prediction-state UI, tooltips.
5. **Automation:** scheduler for Mercato open/close/thaw and honours awarding.
6. **Responsive pass** at 390 / 768 / 1024 on every screen; terminology sweep (Mercado → Mercato).
7. Resolve the PRD-OPEN list with the client (section D) before building anything in it.
