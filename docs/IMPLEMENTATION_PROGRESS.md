# Completion work — 20 September 2026

Sources: functional PRD v1.2, technical specification v1.0, provisional source rules v3.2.0, and MarketFoot PNG designs.

## Plan

- Repair initial remaining budget, positional lineup validation and progressive club freeze.
- Repair direct/Mercado transaction constraints, combined quota, demand accounting and ledger coverage.
- Repair per-player settlement valuation, deferred fixtures, correction replay and ranking validity.
- Implement Ligue 1 results, match detail and home/away standings.
- Implement authenticated predictions with kickoff locking and postponed-match exclusions; keep unresolved payout decisions explicit.
- Complete catalogue filters/statistics, ranking dimensions and profile/history screens.
- Extend admin editing and audit workflows.
- Verify exact arithmetic, database concurrency/idempotency, desktop and mobile UI.

## Verification boundary

Local migrations are proposals until applied to Supabase. Passing TypeScript and unit tests does not verify database privileges, actual migrations, or authenticated browser journeys.

## Implemented in this pass

- Ligue 1: season/day selection, fixtures/results, individual match statistics, standings and home/away filters. Equal-point sorting is explicitly indicative, not a complete official tie-break policy.
- Predictions: authenticated saved 1/N/2 choices, updates, kickoff locks and postponed exclusions. Prediction earnings (PRD �12) are now computed in `src/rules/predictions.ts` and committed atomically with each matchday settlement (migration `202610010019`): `prediction_results`, ledger event `prediction_earnings`, 70/30 split, rollback reversal, and a Pronostics ranking. PROVISIONAL policies in `rules/config.ts` (PRD �24 items 9-11): negative G is deducted, the average covers every gamer with a frozen squad, G is rounded to the nearest euro. Postponed matches played later are not retro-paid.
- Catalogue: price/name sorting, price cap, position/club/search filters, pagination, holders, initial values, demand and additional performance statistics.
- Rankings: general, squad, gains, speculation and bench views; search, season/day/phase filters and pagination. Prediction/trophy rankings remain unavailable.
- Team management: reference-inspired green pitch and bench, same-position substitution, captain selection and frozen-player feedback, with mobile stacking. Shirts remain generic placeholders.
- Admin: record listings, edit pages, stale-write protection, guarded deletion and atomic before/after audit records. Fixture scheduling edit links are included.
- Integrity: initial purchases deducted from budget, acquisition ledger, formation checks, progressive club freeze, combined transfer quotas, direct-transfer ledger/demand updates, Mercado reservation/cancellation and closing-price execution.
- Settlement: one global value update per included player rather than per owner, preserved committed payload, completed-only ranking data, retry protection and a conservative guard against rolling back across later ledger activity. This is NOT a full historical correction/replay engine.
- Shared active navigation, loading/error pages, responsive tables/filter forms and mobile budget visibility.
- Production auth cleanup: hardcoded development users, session bypasses and login autofill buttons have been removed. OAuth callback failures now return to the French sign-in screen.
- Completion UI: welcome screen, named/filterable squad creation, persisted composition/captain save controls, linked My Team transfer/prediction tabs, financial ledger history, own profile and public team-profile route.
- Admin player editing now includes MARKETFOOT value changes with the same audited stale-write protection as other admin edits.

## Database deployment

Apply the seven new migrations `202609200010` through `202609200016` in filename order before using these screens. They are available in `supabase/migrations/`; they have not been applied to the hosted database by this implementation session. Back up existing data first. The legacy initial-player flag is inferred from available transfer history and should be reviewed if earlier transactions were recorded outside these tables.

## Checks actually performed

- TypeScript and ESLint pass.
- Production Next.js build passes.
- 10 pure-rule tests pass.
- An isolated PGlite PostgreSQL integration test applies every migration and exercises onboarding budget, formation rejection, prediction locking, settlement/Mercado retry safety, direct transfers, order cancellation, stale admin writes and unsafe rollback rejection.
- This test runs as a database owner; it does not establish complete role/RLS coverage or concurrent-session correctness.
- Browser check reached the authentication screen; protected desktop/mobile journeys and screenshot comparisons remain unverified without an authenticated test session.
- The design skill's strict static audit was attempted but Python failed to import its standard `encodings` module. No audit pass is claimed.

## Still required — not completed by this pass

1. Full correction-point rollback/replay, later economic dependency rebuilding, and deferred/postponed fixture settlement.
2. Settlement completeness for unowned players, complete immutable official input records, activation-matchday enforcement and broader race-condition/RLS tests.
3. Prediction scoring/payouts after the remaining population and negative-payout policy decisions, then prediction rankings.
4. Friends/social features, trophies/palmarès and moderation/reset workflows with confirmed retention/visibility rules.
5. Complete reference fidelity: real club shirt assets, catalogue detail drawer, transfer side-panel composition and authenticated mobile/desktop visual QA.
6. Wider rule-boundary coverage, historical-data reconciliation, unified exact-money handling across all remaining calculations, and deployment smoke tests.

Recommended next engineering slice: complete settlement correction/deferred execution before adding payout-dependent features. In parallel with user testing, verify the new migrations and protected flows on a staging database.

## Client-dependent work

PRD §24 remains authoritative for unresolved formulas, prediction population/negative payouts, friend visibility, sanctions/reset retention and final valuation/trophy presentation. Do not silently choose these policies.

## Documentation sync with Game Rules v2 — 5 November 2026

`MarketFoot_Game_Rules_v2.pdf` was reconciled against the PRD (now v1.3), the Figma screen map and this log. No application code or migration was changed.

Code and data work implied by the new rules (none implemented yet):

- **Bonus:** six bonuses, one per matchday, +10% of starters' primes, usage counters, 2h deadline, settlement with the matchday. Needs a rules module, tables and UI; scale/max still open.
- **Honours points:** replace the trophy points in the source rules v3.2.0 (100/75/50…) with the new table (300/250/200…, plus first-half, primes, predictions and matchday columns). Needs an honours ledger, the Honours ranking, trophy selection and season history.
- **Rankings:** Primes replaces Gains; Squad ranking dropped; add friends filter, favourite club, period filters (season, halves, matchday), sortable columns and rank-evolution arrows (needs previous-rank data).
- **Bench primes:** substitutes' primes must be recorded and ranked separately without crediting the Budget.
- **Hall of Fame:** records aggregation (per matchday and per season) and a route; header button.
- **Mercato:** cancellable orders free quota, maximum 4 orders, 24h window with configurable times.
- **Admin:** manual prime distribution at full closure, post-Mercato update, account deletion.
- **UX rules:** tooltips, frozen-team messages, captain-at-limit state, out-of-Ligue-1 player state, countdown banner.
- **Encoding fix:** four source files contained Windows-1252 bytes and broke the build; they were converted to UTF-8.
