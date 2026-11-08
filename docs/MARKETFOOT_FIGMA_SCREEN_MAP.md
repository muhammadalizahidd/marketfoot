# MarketFoot: Figma-to-platform screen map

Audited: **23 October 2026**  
Design: [MarketFoot](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot)  
Machine-readable companion: [figma-screen-inventory.json](figma-screen-inventory.json)

## 1. Outcome and evidence boundary

The file maps to a shared application shell, existing route families, several missing profile/catalogue views, and two proposed new destinations: a football club profile and Hall of Fame. Each design frame has a destination below. Selection, hover, filter, result and Mercado frames are states of their owning workspace.

Coverage: **35 top-level screens on Screens, 1 nested composition reference, 16 desktop screens on Draft, and 65 supporting top-level nodes/assets: 117 mapped nodes total.** The JSON preserves every top-level node from all five pages, plus the nested reference screen. Repeated player rows, icon children and internal layout layers belong to their parent component; they are not additional screens.

This is an audit of the current repository, Figma structure, selected live Figma screenshots, and older PNG exports in `UI design/`. Existing implementation means code exists; it does not certify authenticated runtime behavior, deployed migrations, data correctness or pixel fidelity. No application routes or behavior were changed for this mapping.

The Figma Starter tool-call limit was reached after retrieval of all page/root inventories. Several duplicate frames and Draft variants were identified structurally but could not be compared visually. These are explicitly marked in the JSON evidence field and in section 10. Older PNGs show a dark hero layout while inspected live Screens frames show a compact blue header on a light canvas. Use live Screens as the proposed current visual baseline; keep local PNGs for interaction context rather than mixing both shells.

Status meanings:

- **existing-partial**: the route/component exists, but the complete Figma screen or its fields/states still needs work.
- **new-view**: add a tab, detail state or data view to an existing route.
- **new-route**: introduce the proposed destination.
- **reference / draft-reference**: retain as a design reference; no additional route.
- **new-feature**: new UI with game/data rules still to define.
- **shared-component / asset**: reusable pieces placed inside the owning pages.

## 2. Navigation and page placement

Existing paths below are confirmed in source. Paths/query parameters labeled proposed are implementation recommendations. `{playerId}`, `{clubId}`, `{gamerId}`, `{dayId}` and `{seasonId}` are placeholders, not literal URLs. Profile tabs, player speculation periods/activity detail, and history tabs do not currently work merely by adding their proposed query strings.

| User entry point | Owning destination | What appears there | Current implementation |
|---|---|---|---|
| First account setup → create team | `/onboarding` | Username setup, then 19-player selection: pitch, bench, catalogue and budget | TeamBuilder exists; current design is a list rather than Figma pitch selection |
| Header → Mon équipe → Composition | `/mon-equipe?tab=composition` | Pitch + bench, Valeur/Spéculation/Possesseur switcher, Bonus drawer | Lineup substitutions exist; metric switcher and Bonus drawer missing |
| Mon équipe → Capitaine | `/mon-equipe?tab=capitaine` | Same squad workspace, captain selection and captain drawer | Selection/persistence exist; align all visual states |
| Mon équipe → Transfert | `/transferts` | Same squad workspace, sell/buy/cost drawer, direct/Mercado modes | TransferManager exists |
| Mon équipe → Pronostics | `/pronostics?season={seasonId}&day={dayId}` | Same squad workspace and 1/N/2 prediction drawer | Choices, locks and settled summary exist; complete result styling |
| Header → Classements | `/classements` | General, gains, predictions, speculation, achievements and bench ranking tabs; filters | Six metrics exist including extra Effectif; Palmarès and friend filtering missing |
| Header → Ligue 1 → Résultats | `/ligue-1?view=results&match={matchId}` | Fixture strip, selected match and player lineups | Existing |
| Ligue 1 → Classement | `/ligue-1?view=ranking&scope=all` | Club league table, general/home/away | Existing |
| Club name/badge → club profile | **Proposed:** `/ligue-1/clubs/{clubId}` | Real football club overview, player squad and fixture calendar | Missing route |
| Header → Joueurs | `/joueurs?view=general` | General player catalogue | Existing |
| Joueurs → Performances | `/joueurs?view=performance` | Outfield/goalkeeper performance table | Existing, partial fields/controls |
| Joueurs → Spéculation | **Proposed view:** `/joueurs?view=speculation&period=all` | Purchases/sales/holders/value by interval | Missing; currently falls back to general |
| Player name or “voir sa fiche” | `/joueurs?player={playerId}` | Shared full player profile with owned/unowned presentation | Basic aside exists; full profile missing |
| Player profile → market activity detail | **Proposed view:** `/joueurs?player={playerId}&detail=activity` | Movement ledger and activity filters | Missing |
| Gamer name/avatar in rankings, friends or records | `/profil/{gamerId}?tab=performance` | Public gamer performance; public achievements where allowed | Basic public profile exists; tabs/history views missing |
| Owner avatar → Mon espace | `/profil?tab=espace` | Private account/settings screen | Summary/sign-out exists; full settings missing |
| Profile → Historique → Gains / Transferts | **Proposed tabs:** `/historique?tab=gains`, `/historique?tab=transferts` | Rich gains and transfer history | Financial ledger exists; detailed history views missing |
| Header → Hall of Fame | **Proposed:** `/hall-of-fame` | Records, managers/players, category and period selection | Missing header entry and route |

Use one team-tab component across composition, captain, transfers and predictions. Transfer/prediction routes must keep Mon équipe active, as the current PrimaryNavigation already does. The old `/mon-equipe?tab=transfert` alias already redirects to `/transferts`; `/mon-equipe?tab=pronostics` currently falls back to composition and must not be used as a destination.

Keep `/profil` as the private owner account surface. Let `/profil/{gamerId}` own public gamer content, with a clear route to the owner's public card. History can remain in the existing `/historique` route and share profile navigation. If public gamer history is approved later, expose a scoped public view in the public profile rather than allowing arbitrary account IDs into the owner's ledger.

## 3. Every screen on Screens

### Initial squad creation

| Figma screen | Node | Destination | Placement / state | Work required |
|---|---|---|---|---|
| Select your player | [1:13444](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-13444) | `/onboarding` | Empty 19-player pitch plus selection drawer | **existing-partial** — Restyle TeamBuilder as pitch + bench + catalogue; disable other team tabs until squad creation. |
| Select your player | [630:59504](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=630-59504) | `/onboarding` | Partially filled initial squad | **existing-partial** — Use same builder state; update selected slots, count and remaining budget. |
| Select your player - Detail player | [584:50096](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=584-50096) | `/onboarding` | Initial player selection with quick detail panel | **existing-partial** — Add contextual player preview without losing draft squad. |

The initial team must contain the existing rule-defined 19 players and respect position/club/budget constraints. Figma's partially filled example still shows a static 0/19 counter: implement a live count, not the sample label. Once the squad exists, transition to composition. A reset/rebuild flow is separate and must follow the product's retention rules.

### Team composition and captain

| Figma screen | Node | Destination | Placement / state | Work required |
|---|---|---|---|---|
| Team Page - Captain choice GOOD | [1:13921](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-13921) | `/mon-equipe?tab=capitaine` | Captain workspace, named GOOD | **existing-partial** — Reuse captain selection and right panel; GOOD is a design label, not a routing instruction. |
| Team Page - Captain choice | [1:14458](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-14458) | `/mon-equipe?tab=capitaine` | Alternate captain state | **existing-partial** — Reuse same page and selected captain state; exact visual difference needs final comparison. |
| Team Page - Composition | [1:11578](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-11578) | `/mon-equipe?tab=composition` | Composition baseline | **existing-partial** — Reuse LineupManager and shared pitch; implement Bonus panel and metric switcher. |
| Team Page - Composition | [1:11996](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-11996) | `/mon-equipe?tab=composition` | After substitution | **existing-partial** — Persist same-position swap, refresh pitch/bench and captain consistently. |
| Team Page - Composition | [1:12415](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-12415) | `/mon-equipe?tab=composition` | Starter selected; eligible replacements emphasized | **existing-partial** — Use selected starter and same-position bench state; no extra route. |
| Team Page - Composition | [207:18191](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=207-18191) | `/mon-equipe?tab=composition` | Value view with neutral/zero change badges and Bonus panel | **existing-partial** — Render real value/change data and Bonus choices; zero is a data state. |
| Team Page - Composition | [207:18591](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=207-18591) | `/mon-equipe?tab=composition` | Alternate composition metric/state; exact active metric unverified | **existing-partial** — Keep in shared composition workspace; verify metric styling before implementation. |
| Team Page - Composition | [207:18978](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=207-18978) | `/mon-equipe?tab=composition` | Possesseur metric: owner counts on player cards | **existing-partial** — Add holders metric from player data without changing lineup. |
| Team Page - Composition | [206:16534](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=206-16534) | `/mon-equipe?tab=composition` | Composition inside GOOD DISPOSITION1 section | **reference** — Use as layout reference; not a separate page. |

Placement correction: the completed composition designs place **Bonus** on the right. `LineupManager` currently renders a “Choisis tes joueurs”/bench selector there. Initial purchase selection belongs to onboarding. Same-position substitutions remain a pitch/bench interaction; a supplementary selector can support accessibility, but should not replace the designed Bonus workspace.

Valeur, Spéculation and Possesseur are display metrics for the same squad. Switching them must not mutate starters, captain or squad membership. Holder counts are a new display data requirement. Never use sample percentages as calculated values.

### Transfers and predictions

| Figma screen | Node | Destination | Placement / state | Work required |
|---|---|---|---|---|
| Team Page - Pronostics | [1:16074](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-16074) | `/pronostics` | Prediction choice state | **existing-partial** — Reuse PredictionWorkspace and match 1/N/2 controls; exact variant delta unverified. |
| Team Page - Pronostics | [134:4967](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=134-4967) | `/pronostics` | Alternate prediction state | **existing-partial** — Same workspace; represent saved/locked/result states with real match data; exact visual delta unverified. |
| Team Page - Pronostics | [333:24507](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=333-24507) | `/pronostics` | Settled predictions with correctness, score, average and gains | **existing-partial** — Reuse result data; match per-choice result coloring and summary footer. |
| Team Page - Transfert | [1:14861](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-14861) | `/transferts` | Direct transfer workflow baseline | **existing-partial** — Reuse TransferManager; sell, buy, cost, tax, resulting budget and validation. |
| Team Page - Transfert MERCATO | [7:1370](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=7-1370) | `/transferts` | Mercado-open mode | **existing-partial** — Select mode from authoritative matchday status; orders are pending until server execution. |
| Team Page - Transfert | [1:15670](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-15670) | `/transferts` | Direct transfer selection/preview variant | **existing-partial** — Represent within soldPlayerId/boughtPlayerId state; exact frame delta unverified. |
| Team Page - Transfert | [200:11727](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=200-11727) | `/transferts` | Pitch showing changed player (Ajorque) | **existing-partial** — Use preview/persisted squad state; do not infer successful execution from artwork alone. |

Transfer sequence: open workspace → select outgoing owned player → filter/select incoming player → preview sale/purchase/tax/budget → validate → show server result. Direct transfers and Mercado share the route, but Mercado creates pending orders and must not be presented as an executed swap. Preserve frozen-player, quota, position, club-limit and budget validation.

Prediction sequence: select matchday → choose/change 1/N/2 before kickoff → save feedback → lock started fixtures → show correct/incorrect/missing outcomes and settled score/average/gain. Postponed fixtures need their own excluded state. The layout should retain the squad context. The result frame contains copied composition guidance; replace that with relevant prediction guidance rather than reproducing stale copy.

### Rankings, Ligue 1 and club profile

| Figma screen | Node | Destination | Placement / state | Work required |
|---|---|---|---|---|
| Team Form | [1:25200](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-25200) | `/ligue-1/clubs/{clubId}` | Real club profile, squad and calendar | **new-route** — Build club profile under Ligue 1. This is not a gamer team page; entry via club names/badges. |
| Ligue 1 - Results page | [1:20558](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-20558) | `/ligue-1?view=results` | Fixture strip and selected match details | **existing-partial** — Reuse season/day/match selection; refine lineups, substitutes, unavailable players and match/player links. |
| Ligue 1 - Ranking | [1:22964](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-22964) | `/ligue-1?view=ranking` | Club standings | **existing-partial** — Reuse standings and all/home/away scope; link club rows to new club profile. |
| Ranking Page - 1 | [1:16634](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-16634) | `/classements?tab=general&period=all` | General gamer rankings | **existing-partial** — Reuse rankings; add profile links, favorite club, achievements, friend-only filter. |
| Ranking Page - 2 | [333:13460](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=333-13460) | `/classements?tab=general&period=day` | General ranking for selected matchday | **existing-partial** — Reuse period=day plus day ID; no second ranking page. |

**Team Form is a real football club page, not another gamer squad page.** Link to it from Ligue 1 club rows, fixture club names and player club badges. Its “Voir tout l'effectif” action should open the player catalogue filtered by that club; fixture links return to the selected match in Ligue 1.

Ranking Page 2 is a matchday-filter state of the general ranking, not a separate ranking metric. Link gamer names to public gamer profiles and player names to player profiles. Preserve season, day, metric, period, search and pagination when refining filters.

### Player catalogue and profiles

| Figma screen | Node | Destination | Placement / state | Work required |
|---|---|---|---|---|
| Player Form (activity details) | [1:28470](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-28470) | `/joueurs?player={playerId}&detail=activity` | Player market activity detail | **new-view** — Add full chronological movements/impact/value and activity filters; proposed detail query. |
| Player Form (not in my team) | [1:27785](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-27785) | `/joueurs?player={playerId}` | Unowned-player full profile | **existing-partial** — Share player detail component; ownership determines controls and private acquisition section. |
| Player Form (in my team) | [494:46367](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=494-46367) | `/joueurs?player={playerId}` | Owned-player full profile | **existing-partial** — Expand existing detail aside into full profile state; show acquisition info, personal returns and earnings breakdown. |
| Player Table - 2 | [1:28841](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-28841) | `/joueurs?view=performance` | Player performance table / filter variants | **existing-partial** — Reuse performance view; add full fields/sorting and proper club/position controls. |
| Player Table - 3 | [587:52028](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=587-52028) | `/joueurs?view=speculation&period=all` | Player speculation since beginning | **new-view** — Add speculation view and interval aggregates; route exists but view=speculation does not. |
| Player Table - 4 | [587:54124](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=587-54124) | `/joueurs?view=speculation&period=today&sort=purchases` | Player speculation today, purchases sort | **new-view** — Add interval and column sorting, preserve filters; today boundary needs definition. |
| Player Table - 1 | [1:19126](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-19126) | `/joueurs?view=general` | General player table | **existing-partial** — Reuse catalogue filters/table; add missing earnings/demand columns, season and page-size controls. |

Keep `/joueurs?player=...` as the canonical player-detail state to reuse the existing selected-player contract. It can render a full profile layout on direct visits and contextual previews from workflows. The quick preview and full profile should share data, ownership rules and a “view full profile” action.

Current ownership must be determined from the signed-in gamer's squad; do not introduce an owned/unowned URL flag that a caller can falsify. Owned profiles add acquisition and personal return information; unowned profiles use public data and workflow-appropriate selection/transfer entry. The activity screen is a deeper view of that same player, not an unrelated page.

Speculation intervals must be real aggregate periods, not price-sort aliases. The live screenshot confirms Player Table 3 = “Depuis le début” and Player Table 4 = “Aujourd'hui”, with purchases sorting emphasized in Table 4. Also include “Depuis le dernier mercato”, shown in the same navigation, even though no separate full frame is named for it.

### Gamer profile, account and Hall of Fame

| Figma screen | Node | Destination | Placement / state | Work required |
|---|---|---|---|---|
| Gamer Form - Palmarès | [313:25325](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=313-25325) | `/profil/{gamerId}?tab=palmares` | Achievements, trophies and displayed badge | **new-view** — Build trophy awards/history/points and owner-only badge selection; public visibility needs policy. |
| Gamer Form - Amis | [333:12005](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=333-12005) | `/profil/{gamerId}?tab=amis` | Friends/followed gamers table | **new-view** — Build social relationship layer and table; other users' list visibility is unresolved. |
| Gamer Form - Performance | [313:27758](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=313-27758) | `/profil/{gamerId}?tab=performance` | Gamer performance, historical squad and earnings | **existing-partial** — Expand public profile scaffold; season/day selectors, settled squad, transfers and starter/bench gains. |
| Gamer Form - My Space | [319:29473](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=319-29473) | `/profil?tab=espace` | My Space / account settings | **existing-partial** — Expand owner-only profile: avatar, identity, security, preferences, consent/legal links and account actions. |
| Hall Of Fame | [622:57553](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=622-57553) | `/hall-of-fame` | Records overview, managers/players and categories | **new-route** — Add header button, records cards/table, category and day/season selectors; define record metrics. |

A public gamer profile and private account settings are different surfaces. Public Performance is a gamer-specific historical report, not the global gamer ranking and not the real-football-player performance catalogue. Use settled squad snapshots for historic lineups rather than substituting today's squad.

Achievements: public trophy display and history; selecting the displayed badge is an owner action. Friends: following/list/search interactions need a relationship contract and public/private visibility decision. My Space: avatar/profile editing, account security, theme, consent/legal access and account actions. Current source only implements a summary and sign-out, so the remaining controls need real handlers and states.

Hall of Fame is reachable from the prominent header button and owns managers/players, gains/bench/Mercado/purchases/sales and day/season record views. These controls are within one records area; duplicate layouts do not create independent routes. Define record aggregation and eligibility before populating them.

## 4. Every desktop screen on Draft

Draft contains **16** full desktop frames. Use Screens as the proposed visual default where duplicates exist; the two history screens are unique references that should not be discarded merely because they live on Draft.

| Figma screen | Node | Destination | Placement / state | Work required |
|---|---|---|---|---|
| Team Page - Captain choice | [137:7361](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=137-7361) | `/mon-equipe?tab=capitaine` | Draft captain variants | **draft-reference** — Reference current Screens captain design; no separate routes. |
| Team Page - Captain choice | [137:7895](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=137-7895) | `/mon-equipe?tab=capitaine` | Draft captain variants | **draft-reference** — Reference current Screens captain design; no separate routes. |
| Team Page - Composition | [194:9001](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=194-9001) | `/mon-equipe?tab=composition` | Draft composition variants | **draft-reference** — Reference shared composition/Bonus states; use Screens as proposed default. |
| Team Page - Composition | [245:21621](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=245-21621) | `/mon-equipe?tab=composition` | Draft composition variants | **draft-reference** — Reference shared composition/Bonus states; use Screens as proposed default. |
| Team Page - Composition | [245:22021](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=245-22021) | `/mon-equipe?tab=composition` | Draft composition variants | **draft-reference** — Reference shared composition/Bonus states; use Screens as proposed default. |
| Ligue 1 - Ranking | [333:15613](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=333-15613) | `/ligue-1?view=ranking` | Draft standings | **draft-reference** — Compare relevant styling with Screens standings, not a second page. |
| Gamer Form - Historique (Gains) | [340:30377](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=340-30377) | `/historique?tab=gains` | Draft gains history | **new-view** — Extend ledger page into gains history with season/day detail; keep financial ledger as a separate tab. |
| Gamer Form - Historique (Transferts) | [491:43153](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=491-43153) | `/historique?tab=transferts` | Draft transfers history | **new-view** — Add sold/bought players, cost/tax/mode/status history; current ledger lacks this detail. |
| Player Form (in my team) | [494:45636](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=494-45636) | `/joueurs?player={playerId}` | Draft owned-player profile | **draft-reference** — Reuse owned-player component; compare acquisition/returns fields with Screens. |
| Hall Of Fame | [618:56499](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=618-56499) | `/hall-of-fame` | Draft record/category layouts; exact active categories unverified | **draft-reference** — Keep as references for category and period states, not six routes. Inspect active selections before final visual implementation. |
| Hall Of Fame | [622:57761](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=622-57761) | `/hall-of-fame` | Draft record/category layouts; exact active categories unverified | **draft-reference** — Keep as references for category and period states, not six routes. Inspect active selections before final visual implementation. |
| Hall Of Fame | [625:57973](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=625-57973) | `/hall-of-fame` | Draft record/category layouts; exact active categories unverified | **draft-reference** — Keep as references for category and period states, not six routes. Inspect active selections before final visual implementation. |
| Hall Of Fame | [625:58157](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=625-58157) | `/hall-of-fame` | Draft record/category layouts; exact active categories unverified | **draft-reference** — Keep as references for category and period states, not six routes. Inspect active selections before final visual implementation. |
| Hall Of Fame | [625:58341](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=625-58341) | `/hall-of-fame` | Draft record/category layouts; exact active categories unverified | **draft-reference** — Keep as references for category and period states, not six routes. Inspect active selections before final visual implementation. |
| Hall Of Fame | [625:58522](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=625-58522) | `/hall-of-fame` | Draft record/category layouts; exact active categories unverified | **draft-reference** — Keep as references for category and period states, not six routes. Inspect active selections before final visual implementation. |
| Ligue 1 - Results page | [647:68882](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=647-68882) | `/ligue-1?view=results` | Taller draft results frame (1060px) | **draft-reference** — Allow natural document height; no separate route or fixed 940px page limit. |

The six Draft Hall of Fame variants have repeated placeholder headings and names. Their exact selected categories have **not** been established; all belong to Hall of Fame, but it would be inaccurate to assign one node to purchases, another to sales, etc. solely from frame order. Keep their node IDs and reconcile the selected states when Figma reads are available.

## 5. Supporting components and assets: placement of all 65 nodes

The following table accounts for every other top-level node. Metadata can represent component/variant containers as frames; treat the design's reusable semantics as authoritative rather than assuming every metadata frame is a page. Children of the Trophies/Icons library frames inherit the library destination.

| Page | Node / source name | Where it belongs | Work / treatment |
|---|---|---|---|
| Screens | [1:30563](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-30563) In/out budget | Budget delta / resulting budget inside transfer workflow — `/transferts` | Reuse TransferManager; ensure real price/tax/quota/order data. |
| Screens | [1:30572](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-30572) Transferts | Right-side sell/buy/cost/confirm workflow — `/transferts` | Reuse TransferManager; ensure real price/tax/quota/order data. |
| Screens | [1:30505](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-30505) Panel Player out | Contextual player quick-view panel from onboarding, transfers or player links — `/joueurs?player={playerId}` | Select variant by actual ownership, not the ambiguous in/out name. Full-profile CTA opens shared player detail; retain caller context. |
| Screens | [1:30442](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=1-30442) Panel Player in | Contextual player quick-view panel from onboarding, transfers or player links — `/joueurs?player={playerId}` | Select variant by actual ownership, not the ambiguous in/out name. Full-profile CTA opens shared player detail; retain caller context. |
| Screens | [513:49197](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=513-49197) 3d-metal-star-isolated 1 | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Screens | [372:34283](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=372-34283) Footer | Shared document footer | Add reusable footer with appropriate legal/social destinations. |
| Screens | [373:34393](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=373-34393) Frame 26093213 | Small selection/help fragment adjacent to onboarding — `/onboarding` | Verify exact role visually before implementing; no standalone route. |
| Screens | [129:1901](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=129-1901) Navigation Team Page | Composition, Capitaine, Transfert, Pronostics tabs — `/mon-equipe` | Share one nav across team pages and onboarding disabled states. |
| Screens | [285:23547](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=285-23547) Navigation My Page | Performance, history, achievements/friends and owner account entry — `/profil/{gamerId}` | Build common gamer profile navigation; keep private settings owner-only. |
| Screens | [134:6795](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=134-6795) Pronostics | Right side of team predictions workspace — `/pronostics` | Reuse PredictionWorkspace; support open, locked, settled and postponed matches. |
| Screens | [136:7150](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=136-7150) Captain | Right side of captain workspace — `/mon-equipe?tab=capitaine` | Reuse starter-only captain selector, preview and validation feedback. |
| Screens | [245:23052](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=245-23052) Bonus | Right side of completed composition workspace — `/mon-equipe?tab=composition` | Build Bonus list/selection/remaining uses; rules are now defined in PRD v1.3 section 6.4 (six named bonuses, one per matchday, +10% of starters' primes, locks 2h before the first match); the amount scale, usage maximum and settlement integration remain open. |
| Screens | [141:9597](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=141-9597) Top Menu | AppShell header on authenticated pages | Use shared header and add Hall of Fame destination; maintain correct active state. |
| Screens | [141:17157](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=141-17157) Select player planel | Right-side initial catalogue and quick preview — `/onboarding` | Use TeamBuilder state, budget and selected 19-player count; retain existing spelling only as Figma source label. |
| Screens | [630:60131](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=630-60131) Select player planel/Variant4 | Right-side initial catalogue and quick preview — `/onboarding` | Use TeamBuilder state, budget and selected 19-player count; retain existing spelling only as Figma source label. |
| Screens | [206:17167](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=206-17167) GOOD DISPOSITION1 | Section contains reference screen 206:16534 — `/mon-equipe?tab=composition` | Use layout reference only; section itself is not a page. |
| Draft | [333:21113](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=333-21113) bi:twitter-x | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [333:21110](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=333-21110) bxl:discord | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [333:21106](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=333-21106) akar-icons:instagram-fill | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [333:21103](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=333-21103) ant-design:instagram-filled | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [167:190](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=167-190) ballon or 1 | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [167:191](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=167-191) ballon argent 1 | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [167:192](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=167-192) ballon bronze 1 | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [167:193](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=167-193) ant-design:euro-circle-twotone | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [167:194](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=167-194) ant-design:euro-circle-twotone | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [167:195](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=167-195) ant-design:euro-circle-twotone | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [167:196](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=167-196) Frame 30 | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [163:22389](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=163-22389) ph:football-helmet-fill | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [163:22386](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=163-22386) openmoji:football-figure-black | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [163:22375](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=163-22375) boxicons:football-kick | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [167:198](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=167-198) money 1 | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [167:199](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=167-199) money(1) 1 | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [167:200](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=167-200) money(2) 1 | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [167:201](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=167-201) Frame 29 | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [163:22435](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=163-22435) emojione-v1:soccer-ball | Reusable asset, no standalone route | Reuse in relevant screens; inspect asset meaning before substituting artwork. |
| Draft | [194:9463](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=194-9463) Navigation Team Page | Composition, Capitaine, Transfert, Pronostics tabs — `/mon-equipe` | Share one nav across team pages and onboarding disabled states. |
| Draft | [333:20938](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=333-20938) Top Menu | AppShell header on authenticated pages | Use shared header and add Hall of Fame destination; maintain correct active state. |
| Draft | [435:35915](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=435-35915) Frame 26093260 | Reference fragment; no standalone page | Exact parent/purpose could not be verified before Figma limit. Keep as reference until inspected; do not invent a feature. |
| Draft | [435:36188](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=435-36188) Panel Player in | Contextual player quick-view panel from onboarding, transfers or player links — `/joueurs?player={playerId}` | Select variant by actual ownership, not the ambiguous in/out name. Full-profile CTA opens shared player detail; retain caller context. |
| Draft | [466:38232](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=466-38232) Top Menu | AppShell header on authenticated pages | Use shared header and add Hall of Fame destination; maintain correct active state. |
| Draft | [491:45214](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=491-45214) Navigation My Page | Performance, history, achievements/friends and owner account entry — `/profil/{gamerId}` | Build common gamer profile navigation; keep private settings owner-only. |
| Draft | [513:49816](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=513-49816) Frame 83 | Reference fragment; no standalone page | Exact parent/purpose could not be verified before Figma limit. Keep as reference until inspected; do not invent a feature. |
| Draft | [674:73113](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=674-73113) Group 1 | Reference fragment; no standalone page | Exact parent/purpose could not be verified before Figma limit. Keep as reference until inspected; do not invent a feature. |
| Jerseys | [629:59482](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59482) angers-sco 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59483](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59483) as-monaco 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59484](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59484) auxerre 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59485](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59485) estac-troyes 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59486](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59486) fc-lorient 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59487](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59487) le-havre 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59488](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59488) le-mans 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59489](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59489) losc-lille 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59490](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59490) ogc-nice 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59491](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59491) olympique-lyonnais 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59492](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59492) olympique-marseille 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59493](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59493) paris-fc 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59494](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59494) paris-saint-germain 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59495](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59495) rc-lens 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59496](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59496) rc-strasbourg 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59497](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59497) stade-brestois 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59498](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59498) stade-rennais 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Jerseys | [629:59499](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=629-59499) toulouse-fc 1 | Player cards, pitch, bench, catalogue and detail panels | Match club IDs to assets through jersey-map; verify latest Figma shirts against bundled exports. |
| Icons | [128:1797](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=128-1797) Icons — MarketFoot | Shared navigation, action and status icons | Use consistent existing icon components or export exact vectors where required. |
| Icons | [170:6450](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=170-6450) boxicons:calendar-alt | Shared navigation, action and status icons | Use consistent existing icon components or export exact vectors where required. |
| Icons | [315:29459](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=315-29459) griddy-icons:log-out | Shared navigation, action and status icons | Use consistent existing icon components or export exact vectors where required. |
| Trophies | [161:22209](https://www.figma.com/design/U4ePGYsS5Rv13Z28qFaRG0/MarketFoot?node-id=161-22209) Frame 2 | Achievements page, gamer cards, rankings and Hall of Fame — `/profil/{gamerId}?tab=palmares` | Split/use trophy assets by award type; connect real award data. |

### Detail panel naming

The Figma names “Panel Player in” and “Panel Player out” are ambiguous: the inspected text in `1:30442` includes purchase date/personal gains, while `1:30505` shows public-style player information. Map by **content and actual ownership**, not by interpreting “in” as incoming purchase or “out” as outgoing sale. These panels can be used in onboarding, transfers and player quick previews; their full-profile link resolves to the same player detail.

### Shared shell

The global shell should own the header, current account card, sidebar rankings, Top Achats/Top Ventes cards and footer. Individual screens own their center workspace and optional right drawer. Do not duplicate the entire shell in every implementation.

The existing sidebar has placeholder Top Achats/Top Ventes text, a hardcoded sample gamer label, and an account budget card; it does not reproduce all live Figma card fields. Wire real identity, squad value, rank and current budget. “Tout voir” from rankings opens rankings; Top Achats/Top Ventes should open the corresponding player speculation interval/sort after the metric contract is decided. Existing unfiltered `/joueurs` links are only a partial match.

Jersey assets are already present under `public/images/jerseys` and mapped by `src/lib/jersey-map.ts`. This supersedes the older progress note that says all shirts are generic. Verify club/season correspondence and fallbacks rather than rebuilding this system.

## 6. Existing code ownership and gap checklist

| Feature | Existing code to extend | Main implementation gap |
|---|---|---|
| Shell/navigation | `src/components/layout/app-shell.tsx`, `primary-navigation.tsx`, `src/app/(app)/layout.tsx` | Current live shell, Hall of Fame link, real sidebar data, shared footer |
| Initial squad | `src/app/(app)/onboarding/page.tsx`, `src/features/onboarding/team-builder.tsx` | Pitch/bench selection UI and contextual detail preview |
| Composition/captain | `src/app/(app)/mon-equipe/page.tsx`, `src/features/squad/lineup-manager.tsx` | Bonus panel, three display metrics, full visual states |
| Transfers | `src/app/(app)/transferts/page.tsx`, `src/features/transfers/transfer-manager.tsx` | Rich quick details, real club filter and reconciled preview/order states |
| Predictions | `src/app/(app)/pronostics/page.tsx`, `src/features/predictions/prediction-workspace.tsx` | Per-choice correctness styling, final drawer/summary layout |
| Gamer rankings | `src/app/(app)/classements/page.tsx` | Palmarès, friends filter, favorite club/trophy columns, profile links |
| Ligue 1 | `src/app/(app)/ligue-1/page.tsx`, `src/data/repositories/league-repository.ts` | Club profile destination and full lineup states |
| Players | `src/app/(app)/joueurs/page.tsx`, `src/data/repositories/catalogue-repository.ts` | Speculation view/periods, full player profiles, activity history |
| Gamer public profile | `src/app/(app)/profil/[gamerId]/page.tsx` | Performance, achievements/friends tabs, profile navigation |
| Owner account | `src/app/(app)/profil/page.tsx` | Complete My Space settings and actions |
| History | `src/app/(app)/historique/page.tsx` | Gains/transfer detail tabs alongside existing financial ledger |
| Hall of Fame | No dedicated route/component | New `src/app/(app)/hall-of-fame/page.tsx` and records data layer |
| Club profile | No dedicated route/component | New `src/app/(app)/ligue-1/clubs/[clubId]/page.tsx` and club detail data |

Specific source findings affecting completeness:

1. `mon-equipe` accepts composition/capitaine and redirects transfert. It has no supported prediction query-tab alias.
2. `LineupManager` already auto-saves substitutions and captain choices, rolls back failed local changes, and exposes saving/error/success states. Preserve that lifecycle when updating the design.
3. `TransferManager` already has sold/bought selection, price/tax/budget preview, orders/cancellation and a small player modal. Its Club filter currently clears search; it does not actually select a club.
4. The composition drawer's Club button has no handler. A displayed filter is not sufficient evidence of implemented behavior.
5. `joueurs` accepts only general/performance views. Its existing detail aside has a short value history, not the full owned/unowned earnings and market activity designs.
6. `classements` has a prediction RPC, but its prediction header falls through to the general wealth columns while its rows render prediction amounts. Resolve that mismatch. Its footer also incorrectly says predictions remain unavailable.
7. Ranking gamer names are rendered as text, so the public profile entry is currently missing from this table.
8. Profile routes are basic summaries. The public route is still behind the authenticated application layout; “public” currently means another signed-in gamer can view it, not anonymous web access.
9. `historique` loads up to 100 financial ledger rows. That is not a complete matchday earnings report or sold/bought player transfer history.
10. A search of local migrations did not reveal a dedicated friends/following or trophy-award implementation. Build these data contracts rather than assuming the profile tabs can be filled from existing summary data.

## 7. Required navigation journeys

| Start | Action | Destination / state | Return behavior |
|---|---|---|---|
| Sign-in → username setup | Complete username | Initial squad on `/onboarding` | Continue same draft team |
| Initial squad | Add/remove player | Update slot, counter, positional allowance and budget | Remain in onboarding |
| Initial squad | Eye / details | Contextual quick player preview | Close preview without losing squad |
| Complete valid squad | Validate | Existing squad on composition | Other team tabs become available |
| Composition | Select starter, then valid same-position substitute | Highlight → swap → save/feedback | Stay on composition and preserve metric |
| Captain | Select eligible starter | Captain marker + saved result | Stay on captain view |
| Transfer | Select sale then purchase | Cost/budget preview → confirm | Keep filters; refresh actual squad/order status |
| Any player preview | View full profile | `/joueurs?player=...` | Retain safe caller context; do not lose unsubmitted transfer/builder state |
| Player profile | Activity details | Same player + activity detail | Return to player profile, then caller |
| Catalogue | Club/name/price/period/page filter | Same table with preserved compatible filters | Closing details restores table context |
| League fixture | Select match | Same Ligue 1 results route + match ID | Preserve season/day |
| Club badge | Open club | Club profile | Calendar fixture opens correct Ligue 1 match |
| Rankings/friends/records | Open gamer | Public performance profile | Preserve originating filters |
| Public profile | Performance / Palmarès / Amis | Profile tabs subject to visibility | Keep gamer ID and relevant season/day |
| Own account | History | Existing history route with selected tab | Return to own profile |
| Header | Hall of Fame | Records overview/category/period | Record gamer/player links open correct entity |

All queries should tolerate invalid IDs and have explicit empty/loading/error states. Use actual entity IDs; do not link by sample names. Destructive/security/account actions require their real product flows, not decorative buttons.

## 8. Platform routes without a matching full design

| Existing route | Treatment |
|---|---|
| `/` | Keep product landing/welcome entry; no matching full screen in this file |
| `/connexion` | Keep authentication and sign-up flow; no full login screen found |
| `/auth/callback` | Auth callback endpoint, not a screen |
| `/onboarding` username step | Keep before designed squad builder; no full dedicated username design found |
| `/historique` financial ledger | Retain as a financial/operations tab when adding designed history views |
| `/admin`, `/admin/[resource]`, `/admin/edit/[resource]/[id]` | Administrative screens; no matching Figma screens found |
| `/admin/fixtures`, `/admin/mercado`, `/admin/settlements` | Keep operational tools; do not place consumer designs here |
| App loading/error states | Extend shared visual system; no separate full frames found |
| Consent/legal destinations linked from My Space | Required links/actions, but dedicated full page designs/routes were not found |

The source specifications remain authoritative for game rules. Consumer Figma screens do not replace admin controls or authorize different settlement, payout or retention rules.

## 9. Recommended build order

1. **Shared shell and navigation:** settle the live visual baseline; consolidate team/profile navigation and shared cards.
2. **Onboarding and team workspace:** implement initial pitch selection, align composition/captain; build Bonus presentation once its rule contract is specified.
3. **Transfers and predictions:** complete workflows already supported by services, including every pending/locked/result state.
4. **Players and club profiles:** shared quick/full details, activity history, speculation periods and club destination.
5. **Rankings and gamer profiles:** route links, performance/history, friends, trophies and owner settings.
6. **Hall of Fame and cross-screen QA:** records data/metrics, desktop and mobile layouts, deep links and state restoration.

For each slice, verify the relevant journey with authenticated data and compare the owning screen plus state variants. Test data/actions where behavior changes; a documentation-only mapping does not need application build/test runs.

## 10. Decisions and remaining visual checks

These do not block the placement map, but must be resolved before claiming complete implementation:

- **Draft precedence:** Screens is the proposed default; Draft has unique gains/transfer history and potentially newer component experiments. Do not choose a duplicate solely because its name contains GOOD.
- **Bonus:** its location is confirmed from live Screens, and Game Rules v2 now defines it (PRD v1.3 section 6.4): one bonus per matchday, six named bonuses (The Cholismo, The Turpin, Clean Sheets, Out of the Fridge, Caviar in Stock, Fergie Time), +10% of the starters' total primes if the event happens, a usage counter per bonus (greyed out at the maximum), and a deadline of 2h before the first match. Still open: bonus names/scale confirmation and the usage maximum per bonus. Player bonus/malus arithmetic is a different concept (those are "primes").
- **Social/public visibility:** one-way following versus mutual friendship; which friends, history and financial fields another gamer can see; whether anonymous public profiles are intended.
- **Trophies/records:** resolved in part by Game Rules v2. The Palmarès screens are the **Honours** tab: honours points follow the table in PRD v1.3 section 16.1 (replacing the older 100/75/50 trophy points), the gamer ticks one trophy to display, and the Hall of Fame has defined categories (PRD section 16A). Still open: the Performance Index bar, exact eligibility/tie-break rules, and whether the Mercato record sits under Managers or Players.
- **Period boundaries:** define timezone/day boundary for “Aujourd'hui” and the exact “Depuis le dernier mercato” interval before implementing aggregate queries.
- **State reconciliation:** exact selected styling for `207:18591`, captain duplicate `1:14458`, transfer variant `1:15670`, prediction variants `1:16074`/`134:4967`, and six Draft Hall of Fame frames still require visual comparison. Their owning destinations are mapped.
- **Fragments:** Draft `513:49816`, `435:35915`, `674:73113` and Screens `373:34393` are recorded but their precise role is unverified. They do not warrant invented routes.
- **Design sample content:** sample identities, zero counters, old season labels, repeated record text and stray imported text such as “Hardware 1”/“License” are not live product data.
- **Responsive behavior:** the screen frames are desktop-width designs; a mobile interaction/layout treatment must be implemented and checked rather than inferred as visually approved.
- **Runtime:** no authenticated browser journeys, production database state or deployment status were verified in this audit.

## 11. Coverage verification

The companion inventory records node ID, Figma link, page, size, destination, placement, status, work and evidence level for **all 117 mapped nodes**. It includes all 52 full desktop frames and all 65 supporting nodes. Every existing code reference was checked against the repository. Proposed routes and query states are identified separately from existing ones.

This document is the implementation placement plan; it does not mark the underlying product work complete.


## 12. Game Rules v2 cross-reference (5 November 2026)

`MarketFoot_Game_Rules_v2.pdf` (part 20) inventories the same **35 screens** as this map's Screens page, so no screen was added or removed. What it changes for implementation:

- **Naming:** "Gamer Form - Palmarès" is the **Honours** tab; rankings are Overall, Primes (was Gains), Predictions, Speculation, Honours (was Palmarès/Achievements) and Bench. The Players page views are Overall, Performance and Speculation; Speculation periods are since the start, since the last Mercato, and today.
- **Team tabs:** Game Rules v2 lists 1st Line-up, Line-up, Captain, Transfer, Predictions and Speculation with the Bonus panel. The Speculation display is a metric of the composition screen (Valeur / Spéculation / Possesseur), not a separate route.
- **Hall of Fame:** categories, podium + top 10, per-matchday/per-season selector (see PRD section 16A). The header button is required on every screen.
- **Sidebar:** username, squad value, Budget, overall rank always centred, Top Buys / Top Sells with impact and transaction count, plus the "Next match in..." countdown.
- **Behaviours to implement as written:** tooltips and click targets (PRD section 26), frozen-team handling, captain counter and red-icon state at 6 uses, out-of-Ligue-1 player message, prediction colour semantics (green/red/black).
- **Gamer area:** Performance, Honours, Friends and My Space tabs with the fields in PRD section 17; My Space includes a theme choice (dark theme still to be decided) and account deletion.
- **Club profile (Team Form):** squad table with a "See full squad" link and fixtures; reached from any shirt or club name.
- **Still not defined by Game Rules v2:** the amount scales (primes, taxes, budget), Bonus scale, and Hall of Fame Mercato placement.
