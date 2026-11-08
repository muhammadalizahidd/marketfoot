---
title: "MARKETFOOT — Product Functional Requirements"
version: "1.3-product"
based_on: "MARKETFOOT Product Requirements Document v1.2; MarketFoot Game Rules & Mechanics v2 (PDF, 23 pages, supplied 5 November 2026)"
status: "Reconciled with MarketFoot Game Rules v2 on 5 November 2026; remaining client inputs explicitly marked"
scope: "French Championship / Ligue 1 only"
---

# MARKETFOOT — Product Functional Requirements

This document contains only MARKETFOOT product behavior, business rules, calculations, user-facing requirements, administrator capabilities, confirmed client decisions, and unresolved product dependencies.

It intentionally excludes implementation architecture, code organization, framework guidance, database design guidance, coding conventions, testing strategy, and AI-development instructions. Those belong in a separate technical specification.

## Source precedence (added in v1.3)

`MarketFoot_Game_Rules_v2.pdf` ("Game Rules & Mechanics v2") is the newest client-supplied statement of how the game works. Where it differs from earlier text in this document or in `MARKETFOOT_SOURCE_RULES_AND_FORMULAS_v3.2.0.md`, Game Rules v2 wins and this document has been updated to match. Numeric scales that Game Rules v2 does not restate (prime amounts, tax rates, budget coefficients, demand effect) keep their current v3.2.0 reference values and remain provisional. Section 28 lists every change made in v1.3.

---

# 1. Product Overview

MARKETFOOT is a football simulation and virtual trading game.

A gamer:

- builds and manages a squad of real football players;
- buys and sells players through transfers;
- gains or loses virtual money from real player performances;
- makes 1/N/2 match predictions;
- competes using French Championship / Ligue 1 results;
- aims to maximize total virtual wealth.

The game is recreational and does not pay out real money.

## 1.1 Total wealth

```text
TOTAL_WEALTH = SQUAD_VALUE + BUDGET + BLOCKED_ACCOUNT
```

Virtual currency: **Euro (€)**.

## 1.2 Competition scope

**Client confirmed**

- French Championship / Ligue 1 only.
- No international competition is in scope.
- The base same-club squad limit of 4 applies.
- No international-knockout override is required.

## 1.3 Season and game loop

**Client confirmed (Game Rules v2)**

- Championship: Ligue 1, **2026/2027** season, **18 clubs, 34 matchdays** (MD1 to MD34), split into a **first half** and a **second half**.
- A "Next match in..." countdown is shown at the top of the screen: it is the time left before the next match and therefore before matchday choices lock.
- Each gamer's loop is: **1 Recruit** (pick players within budget) → **2 Prepare** (line-up, captain, bonus and predictions before each matchday) → **3 Cash in** (real matches produce primes and malus) → **4 Adjust** (free transfers or Mercato orders) → **5 Climb** (rankings, trophies, Hall of Fame).
- A player's MarketFoot value changes for two reasons: real-life performance (primes and malus) and the market (purchases raise it, sales lower it).
- The game is free to play.

---

# 2. Core Product Concepts

| Term | Meaning |
|---|---|
| Gamer | User participating in the game |
| Player | Real football player |
| Squad | Players owned by a gamer |
| Budget | Available virtual money usable for transfers |
| Mercado Budget | Temporary budget used while validating Mercado orders |
| Blocked Account | Portion of positive earnings not usable for transfers but included in total wealth |
| Closure | Period in which transactions are not possible |
| Mercado / Transfer Window | First period after a matchday; orders are submitted to an order book |
| Opening / Unfreeze | Period outside Mercado where permitted operations resume |
| Matchday / Gameweek | Group of matches settled together |
| Match | Scheduled fixture whose result and player data are entered by the administrator |
| Transfer | Replacement of one squad player with another |
| Mercado Order | Transfer intention submitted during the transfer window |
| Prediction | Gamer's 1/N/2 match prediction |
| Trophy | Award contributing points to Performance Index |
| Performance Index | Sum of trophy points earned since account creation |
| Primes | Euro amounts earned (positive) or lost (negative) by a player for events in a match; the user-facing word for what earlier documents call bonuses/maluses or dividends |
| Bonus | One optional bet per matchday on a specific match event; if it comes true the gamer earns +10% on the starters' primes (see 6.4) |
| Honours points | Points awarded for final positions in rankings; they accumulate across seasons and feed the Honours ranking (same concept as Performance Index — see section 16) |
| Bench primes | Primes earned by substitutes; they raise squad value but add no money to the Budget |
| Holders / Owners | Number of gamers who have a given player in their squad |
| Form | A player's or club's recent results shown as V (win), N (draw), D (loss) with the primes of the last matches |
| Hall of Fame | All-time records page for managers and players (see section 16A) |
| My Space | The signed-in gamer's private profile and settings area |

## 2.1 Terminology (added in v1.3)

Game Rules v2 fixes the user-facing vocabulary:

| Use | Instead of |
|---|---|
| Primes (positive "primes", negative "malus") | Bonuses / Dividends / Gains |
| Squad ("My squad", squad value) | Portfolio |
| Mercato | Mercado, transfer window (the codebase and existing documents still use "Mercado"; user-facing French/English copy should say "Mercato") |
| Honours | Palmarès / Achievements |

Remaining pending naming points are tracked in section 24.

---

# 3. Authentication and Onboarding

## 3.1 First-time user flow

```text
Welcome
→ Connexion
→ Account Informations
→ Create Your Team
→ Pick the Players / List of Players
→ Manage Your Team
```

## 3.2 Account information

**Client confirmed**

Required fields:

- Username
- Email
- Password

Google sign-in is also supported.

---

# 4. Football and Match Data Management

All football and match data required by the game is entered manually by an administrator.

The administrator must be able to enter and manage:

- match results;
- individual player statistics;
- match events;
- data required for bonus/dividend calculations;
- data required for player-value calculations;
- postponed matches;
- matchdays;
- matches;
- schedules.

The current technical specification names **Flashscore** as the reference source for:

- goals;
- own goals;
- cards;
- assists;
- successful and missed penalties;
- goalkeeper saves.

Obvious source errors may be corrected by the moderation/admin team.

## 4.1 VM values

**Client confirmed**

- Transfermarkt must not be used for VM.
- Year 0 VM values are supplied directly by the client.

**Pending client input**

- Year 1 VM update formula.

---

# 5. Gamer Financial State

Each gamer has:

- Budget;
- Squad / player portfolio;
- Blocked Account;
- Transaction History.

## 5.1 Initial Budget

Current v3.2.0 reference:

```text
INITIAL_BUDGET =
    AVG * 19 * COEFF_INI
    + (NB_MATCHDAY * COEFF_STEP)
```

| Parameter | Meaning | Current reference |
|---|---|---:|
| `AVG` | Average Marketfoot value of players taking part in the competition when the squad is created | Dynamic |
| `NB_MATCHDAY` | Matchdays already played in the current season | Dynamic |
| `COEFF_INI` | Initial difficulty coefficient | 0.8 |
| `COEFF_STEP` | Differential difficulty coefficient | 0.02 |

**Pending client input**

The client will provide a replacement Initial Budget formula. The current formula and coefficients remain provisional until then.

---

# 6. Squad Composition and Team Management

## 6.1 Required squad

Mandatory formation: **1-4-3-3**

Total squad size: **19 players**

| Position | Count |
|---|---:|
| Goalkeepers | 3 |
| Defenders | 6 |
| Midfielders | 5 |
| Forwards | 5 |

Composition:

- 11 starters;
- 8 substitutes;
- 2 substitutes per positional category.

## 6.2 Squad rules

- Maximum 4 players from the same club.
- Initial squad acquisition value must be less than or equal to the available Budget.
- Initial squads do not generate capital gains under the demand-effect rule.
- Substitution is free and swaps a starter with a substitute among the 19 owned players.
- A transfer is a paid replacement of a squad player with a market player.
- Transfers are free and unlimited until the initial squad is validated.
- If a team is created while teams are frozen/closed, the squad becomes valid only at the next open period.

## 6.3 Captain

- Captain must be one of the starters.
- The same player may be captain a maximum of **6 times per Championship**.
- Captain effects are doubled for both positive and negative bonuses.
- A player from a frozen team cannot be newly selected as captain.
- Captain choice follows the same team-specific two-hour freeze as transfers and other player actions.

### Captain presentation (Game Rules v2)

- Captain effects apply to the next matchday; the captain is picked from the 11 starters and then confirmed (the Confirm button becomes active once a player is selected).
- Each player shows a usage counter in "used / maximum" form (for example 4/6). Choosing a player as captain increments it by 1.
- A player already captain 6 times shows a red captain icon with the message: "your captain has already been used 6 times, their primes can no longer be doubled".
- An eye icon opens the player's quick profile so the gamer can compare before choosing.
- Captain choice is possible up to 2 hours before the match, as long as the player's team is not frozen. Once the captain's team is frozen the captain can no longer be changed.

## 6.4 Bonus

**Client confirmed (Game Rules v2)**

Help message shown to the gamer: "Play one bonus per matchday. If it comes true, you earn 10% more on your starters' total primes."

- A gamer may play **one bonus per matchday**.
- Every bonus corresponds to a match event and every bonus pays the same: if the event happens, the gamer earns **+10% of the total primes collected by their starters** over that matchday.
- Each bonus has a usage counter. When it reaches its maximum the bonus is greyed out and unavailable.
- A bonus can be chosen up to **2 hours before the first match of the matchday**.
- The Bonus panel is open by default on the My Team composition screen.

| Bonus | Comes true if... |
|---|---|
| The Cholismo | At least 2 players in the line-up win 1-0 |
| The Turpin | A player in the line-up scores a penalty |
| Clean Sheets | The line-up's goalkeeper wins their match without conceding a goal |
| Out of the Fridge | A player in the line-up comes off the bench and scores |
| Caviar in Stock | A player in the line-up provides two assists in the same match |
| Fergie Time | A player in the line-up scores in stoppage time |

**Pending client input:** the exact scale for each bonus, the final bonus names, and the usage maximum per bonus.

## 6.5 Recruitment interaction (Game Rules v2)

- Message shown: "Pick your players according to your budget. You can have a maximum of 4 players from the same club."
- Clicking an empty pitch or bench slot opens a panel listing the available players for that position with their value.
- A player's quick profile can be opened before choosing; it opens to the left of the existing panel.
- A player cannot be recruited when the price exceeds the remaining budget (in-budget / out-of-budget indicator) or when the 4-per-club limit is already reached.
- Each signing deducts the player's price from the Budget; what remains is the available Budget.
- The squad is frozen-aware: players from a frozen team cannot be recruited or modified.

---

# 7. Matchday Cycle and Progressive Freeze

## 7.1 Cycle sequence

1. Team freeze begins two hours before the relevant match.
2. Matchday matches begin.
3. Matchday matches end.
4. Admin enters match sheets; values, earnings, budgets, and rankings are calculated or updated.
5. Transfer window opens for 24 hours; transfer orders are submitted.
6. Closure/team freeze; orders execute and values, budgets, and rankings are recalculated.
7. Unfreeze/open period.

Exact schedule times remain configurable.

## 7.2 Progressive team freeze

**Client confirmed**

The game uses a progressive team-by-team freeze.

For each team:

```text
TEAM_FREEZE_AT = TEAM_MATCH_KICKOFF - 2 hours
```

Example:

```text
Team 1 vs Team 2 kickoff: Friday 20:45
→ Team 1 and Team 2 freeze: Friday 18:45

Team 3 vs Team 4 kickoff: Saturday 17:00
→ Team 3 and Team 4 freeze: Saturday 15:00
```

Before a team's freeze:

- that team's players remain transferable/changeable where the current phase allows;
- captain choice remains available where the current phase allows.

At and after a team's freeze:

- that team's players are locked for the relevant matchday operations;
- captain selection or change for that team's player is locked.

## 7.3 Phase terminology

The Project Brief uses:

- Freeze
- Fixing
- Open

The client-confirmed functional behavior is the progressive team-by-team freeze described above.

**Pending UI clarification**

Final user-facing naming and mapping between:

- Freeze;
- Fixing;
- Open;
- team freeze;
- transfer window;
- closure;
- unfreeze

may be finalized with the UI/Figma.

## 7.4 Transfer-window permissions

Current v3.2.0 behavior:

- predictions allowed;
- substitutions allowed;
- captain choice allowed subject to team freeze;
- direct transfers disabled;
- Mercado orders used instead.

## 7.5 Indicative schedule and phase rules (Game Rules v2)

Indicative weekly schedule:

1. Friday 18:30 — teams playing Friday 20:30 freeze; Saturday 15:00 — teams playing at 17:00 freeze; Saturday 19:00 — teams playing at 21:00 freeze; and so on until Sunday 19:00 (last match).
2. Matches are played; then all match sheets are entered and primes are calculated; rankings and budgets update.
3. Monday 20:00 — Mercato opens for 24 hours. Gamers place orders in the order book (maximum 4).
4. Tuesday 20:00 — Mercato closes; orders execute; rankings and budgets update. Tuesday 20:30 — unfreeze: transfers open again (a gamer may still make any transfers left out of the 4 allowed) until the start of the next matchday.

Times are indicative and remain configurable.

**Freeze rules**

- Trigger: 2 hours before kick-off.
- No transactions on players who take part in the match concerned, or who took part in an earlier match of the same matchday.
- Progressive/partial freeze when matches are not simultaneous: only players of teams whose kick-off is within 2 hours are frozen.
- Full freeze: every team of the matchday has played.
- Prime distribution and revaluation are done **manually by the admin** in the input console during a full closure (usually the day after the last match). New rankings and budgets become visible when the game reopens.

**Mercato rules**

- First period after a matchday; orders are placed in an order book and executed at the end of the window. The post-Mercato update may be done manually by the admin.
- Predictions, substitutions and captain choice remain possible; direct transfers are not possible.

**Opening / unfreeze rules**

- All transactions are possible (squad creation, transfers, substitutions, captain choice, predictions) and any player can be bought or sold.
- Opening happens once prime distribution and revaluation are complete.

**General interaction rules**

- Whichever panel is open (predictions, transfer, bonus), substitutions with starters can always be made.
- Clicking a player opens their profile ("player panel") to the left of the open panel; clicking a shirt opens that club's page.
- A free transfer is possible as long as the player's team is not frozen.

---

# 8. Transfers

## 8.1 Transfer quota

**Client confirmed**

```text
MAX_TRANSFERS_PER_MATCHDAY_CYCLE = 4
```

This is one combined quota across:

- transfers outside the transfer window;
- Mercado / transfer-window transfer activity.

## 8.2 Same-club limit

```text
MAX_PLAYERS_FROM_SAME_CLUB = 4
```

## 8.3 Outside transfer-window feasibility

Current rule:

```text
BUDGET + VALUE_PLAYER_SOLD
>= VALUE_PLAYER_BOUGHT + TAX
```

Normal rule:

- a transfer outside the transfer window must not make the Budget negative.

Exception after Mercado:

- if Mercado settlement has already made the Budget negative;
- an outside-window transfer may still be completed only if it makes the Budget less negative.

## 8.4 Transfer tax

Current v3.2.0 reference:

| Context | MD1-MD17 | MD18-MD26 | MD27-MD34 |
|---|---:|---:|---:|
| During transfer window | 8% | 7% | 6% |
| Outside transfer window | 10% | 9% | 8% |

**Pending client input**

The source is internally inconsistent and the client has confirmed that these values will change.

Final rates and exact matchday cutovers are still pending.

---

# 9. Mercado / Transfer Window

## 9.1 General behavior

During Mercado:

- direct transfers are impossible;
- users submit transfer orders;
- orders are held in an order book;
- orders execute at the end of the window;
- a temporary Mercado Budget is used for order validation;
- Mercado Budget does not survive beyond the window.
- the window lasts 24 hours and a gamer may hold at most 4 orders in the order book (the combined quota of 4 transfers still applies);
- an order can be cancelled for as long as the window is open, which frees a slot in the quota;
- with 3 orders placed in the window, 1 free transfer remains for the cycle.

Current fixed commission:

```text
FIXED_TRANSFER_WINDOW_COMMISSION = €100,000 per order
```

## 9.2 Order acceptance

Current reference:

```text
BUDGET
+ SUM(VALUE_PLAYERS_TO_SELL)
>=
SUM(VALUE_PLAYERS_TO_BUY)
+ (NUM_ORDERS * €100,000)
+ (TAX_PERCENT * SUM(VALUE_PLAYERS_TO_BUY))
```

Order acceptance uses player values from before the transfer window.

## 9.3 Aggregate player-value recalculation

At settlement:

```text
VALUE_PLAYER_AFTER_WINDOW =
    VALUE_PLAYER_BEFORE_WINDOW
    + (NUMBER_PURCHASES - NUMBER_SALES) * (20000 / 2)
```

Rules:

- purchase and sale counts are aggregate counts across all gamers;
- sales of players acquired in the initial squad are not counted;
- transfers made during the transfer window earn 50% of the player's capital gain/loss, represented by `/2`.

## 9.4 Insufficient Budget after execution

If updated values make the final Budget insufficient:

- the accepted transfer still executes;
- the Budget may become negative;
- a later outside-window transfer is allowed only if it makes that negative Budget less negative.

## 9.5 Current validation example

Reference input:

```text
P1 = €3,000,000
P2 = €1,000,000
P3 = €4,000,000
P4 = €1,000,000
G1 Budget = €3,300,000
tax = 8% in the current example
```

First order:

```text
sell P2 / buy P1

€3,300,000 + €1,000,000
>=
€3,000,000 + €240,000

remaining transfer-window Budget = €1,060,000
→ accepted
```

Second order:

```text
sell P4 / buy P3
→ resulting transfer-window Budget would be negative
→ rejected
```

Scenario 1:

- P1: 5 purchases, 22 sales, including 2 initial-squad sales → €2,850,000.
- P2: 5 purchases, 20 sales → €850,000.
- G1 final Budget → €1,072,000.

Scenario 2:

- P1: 200 purchases, 5 sales → €4,950,000.
- P2 stays €1,000,000.
- Transfer executes.
- G1 final Budget → `-€1,046,000`.

---

# 10. Player Value Model

## 10.1 Variables

| Variable | Meaning |
|---|---|
| `NbPtsClub` | Points obtained in previous season by player's club |
| `Total bonuses N-1` | Player bonuses in season N-1 |
| `Total bonuses N-2` | Player bonuses in season N-2 |
| `NbJCompetN-1` | Matchdays completed by player in N-1, including not played |
| `NbJCompetN-2` | Matchdays completed by player in N-2, including not played |
| `NbJCompetCourante` | Matchdays already completed in current season |
| `VMeq` | Average market value of a club's players |
| `VM` | Year 0 market value supplied directly by client; Year 1 formula pending |
| `Star` | New/winter-arrival player receiving the VM uplift rule relative to `VMeq` |

## 10.2 Initial value — current v3.2.0 reference

```text
PriN-1 = TotalBonusesN-1 * 34 / NbJCompetN-1

PriN-2 = TotalBonusesN-2 * 34 / NbJCompetN-2
```

If:

```text
NbJCompetN-1 / 34 <= 0.6
```

then:

```text
PriN-1 =
    TotalBonusesN-1
    * 34
    / NbJCompetN-1
    * 0.7
```

### Bonus value by participation

| Participation case | `Bonus_value` |
|---|---|
| N-1 only | `PriN-1` |
| N-1 and N-2, with `PriN-2 > PriN-1` | `0.5 * PriN-1 + 0.5 * PriN-2` |
| N-1 and N-2, with `PriN-2 < PriN-1` | `PriN-1` |
| N-2 only | `0.8 * PriN-2` |

Floor:

```text
if Bonus_value < 0:
    Bonus_value = 0
```

### Initial value by player type

| Player type | Club-value/reference | Current initial-value rule |
|---|---|---|
| Took part in previous season | `55,000 * NbPtsClub` | `Club_value + Bonus_value` |
| Promoted | `30,000 * NbPtsClub` | `Club_value + Bonus_value` |
| New pro | Base not redefined | `Club_value * 0.75` |
| New to championship — non-star | — | Average of new club players |
| New to championship — star | — | Average of new club players `+ 25% * (VM - VMeq)` |
| Winter transfer — non-star | — | Average of club players who played at least one match in current competition |
| Winter transfer — star | — | Same average `+ 25% * (VM - VMeq)` |

**Pending client input**

The client will provide the final player initial-value formula later.

The current v3.2.0 rules remain the current reference until then.

The `Club_value` base for **New pro** is also not yet final.

## 10.3 Real Value

Current reference:

```text
REAL_VALUE = i + a * 10000 - v * 10000 + d
```

Where:

- `i` = initial value;
- `a` = number of times player has been bought;
- `v` = number of times player has been sold;
- `d` = sum of player bonuses.

Floor:

```text
REAL_VALUE >= €0
```

## 10.4 Marketfoot Value

Marketfoot Value is the effective buy/sell value.

Floor:

```text
MARKETFOOT_VALUE >= €500,000
```

Current demand effect:

```text
player bought → +€20,000
player sold   → -€20,000
```

Exception:

- a sale of a player acquired in the initial squad does not create the normal capital loss;
- initial squads do not generate capital gain.

## 10.5 Pending player-value clarification

The client must clarify the intended relationship among:

- Real Value demand term: `+€10k / -€10k`;
- Marketfoot demand effect: `+€20k / -€20k`;
- transfer-window recalculation: `€20,000 / 2`.

These remain current reference values until replaced.

---

# 11. Player Earnings: Bonuses and Maluses

## 11.1 Starter and substitute earnings

**Resolved in v1.3 (Game Rules v2)**

- Only the 11 starters bring matchday earnings to the gamer's Budget.
- Substitutes' primes are counted separately as **Bench primes**. They increase squad value and have their own ranking (Bench), but add no money to the transfer Budget.
- The two-value cells (`A / B`) in the detailed tables remain as the v3.2.0 reference. Game Rules v2 shows the same table layout (starter / substitute) but does not restate the amounts and marks the scale as "to be decided; the amounts in the mock-ups are fictitious". The amounts below therefore stay provisional.

## 11.2 BONUS scale

For cells shown as `A / B`:

- first value = starter;
- second value = substitute.

| Event | Goalkeeper | Defender | Midfielder | Forward |
|---|---:|---:|---:|---:|
| Starter | €100,000 | €100,000 | €100,000 | €100,000 |
| Substitute | €20,000 | €20,000 | €20,000 | €20,000 |
| Goal scored | €210k / €230k | €190k / €210k | €170k / €190k | €150k / €170k |
| Penalty scored | €100k / €120k | €100k / €120k | €100k / €120k | €100k / €120k |
| Assist | €180k / €200k | €160k / €180k | €140k / €160k | €120k / €140k |
| Clean sheet | €50k / €30k | €100k / €80k | €70k / €50k | €30k / €10k |
| Hat trick `*` | €100k / €120k | €100k / €120k | €100k / €120k | €100k / €120k |
| Goalkeeper save | €15,000 | €15,000 | €15,000 | €15,000 |
| Bonus 8 saves and + `*` | €100k / €120k | €100k / €120k | €100k / €120k | €100k / €120k |

### Pending BONUS questions

- Meaning of `*` on Hat trick.
- Meaning of `*` on Bonus 8 saves and +.
- Whether goalkeeper-save events apply only to goalkeepers despite values appearing in all position columns.

## 11.3 MALUS scale

| Event | Goalkeeper | Defender | Midfielder | Forward |
|---|---:|---:|---:|---:|
| Match not played | -€200,000 | -€200,000 | -€200,000 | -€200,000 |
| Red card | -€150k / -€170k | -€150k / -€170k | -€150k / -€170k | -€150k / -€170k |
| Yellow card | -€60k / -€80k | -€50k / -€70k | -€60k / -€80k | -€70k / -€90k |
| Own goal | -€100k / -€120k | -€100k / -€120k | -€100k / -€120k | -€100k / -€120k |
| Substituted during match | -€20k / -€20k | -€20k / -€20k | -€20k / -€20k | -€20k / -€20k |
| Goal conceded, starting from 2nd | -€20k, then -€10k per additional goal | Same | Same | Same |
| Missed penalty | -€100,000 | -€100,000 | -€100,000 | -€100,000 |

## 11.4 Team-result scale

| Team result | Amount |
|---|---:|
| Away Win | +€150,000 |
| Home Win | +€100,000 |
| Away Draw | +€50,000 |
| Home Draw | €0 |
| Away Loss | -€50,000 |
| Home Loss | -€150,000 |

## 11.5 Captain multiplier

Captain doubles positive and negative bonus effects.

## 11.6 Earnings distribution

Positive earnings:

```text
70% → Budget
30% → Blocked Account
```

Negative earnings:

```text
100% → Budget
```

## 11.7 Playing-time calculation

The current v3.2.0 specification does not include the playing-time weighting formulas that appeared in the earlier PRD.

No playing-time weighting formula is currently part of the confirmed product rules.

## 11.8 Matchday earnings and presentation (Game Rules v2)

```text
MATCHDAY_EARNINGS =
    starters' primes (captain x2 included)
  + Bonus (+10% of the starters' primes, if successful)
  + Predictions earnings
```

- Only starters' primes feed the Budget.
- The match sheet on the Ligue 1 page shows each club's starters, substitutes and players not in the squad, minutes played, events and the prime earned by each player; the captain's x2 multiplier also appears there. A player in the viewer's own squad is highlighted.
- The Gamer Profile Performance page breaks squad value into **performance earnings** (starters' primes, captain, bonus, predictions), **Mercato earnings** (capital gains/losses on transfers) and the **Locked account**.
- The prime data source for manual entry is Flashscore.
- A player who has left Ligue 1 may remain in a gamer's squad. Such a player earns nothing and counts as 0 (their primes too). The interface shows: "This player is no longer in Ligue 1, so their value can no longer change".

---

# 12. Predictions

## 12.1 Prediction rules

Format:

- `1` = home win
- `N` = draw
- `2` = away win

Rules:

- a prediction can be made only before kickoff;
- a prediction can be changed until that match starts;
- the end-of-match result is used for scoring;
- a forgotten prediction counts as wrong;
- future matchdays may be predicted in advance;
- postponed matches cannot be predicted;
- postponed matches are excluded from prediction calculations;
- an advance prediction for a match that becomes postponed is ignored.

Example:

```text
9 correct out of 10 eligible matches
+ 1 forgotten prediction
= 90%
```

## 12.2 Gamer result

```text
GAMER_RESULT_PERCENT =
    (CORRECT_PREDICTIONS / TOTAL_ELIGIBLE_MATCHES) * 100
```

## 12.3 Matchday comparison

```text
x = gamer_result - matchday_average_result
```

`x` is measured in percentage points.

## 12.4 Prediction reward formula

Current reference:

```text
G = ((0.008 * x^3) + (8 * x) + 400) * 1200
```

Range:

```text
-€2,000,000 <= G <= +€2,000,000
```

Special case:

```text
if gamer_result == 0% and G > 0:
    payout = €0
```

Prediction winnings follow:

```text
70% → Budget
30% → Blocked Account
```

## 12.5 Pending prediction clarifications

1. The rules say there is no penalty for a wrong prediction, but `G` has a negative floor. Confirm whether a negative `G` is ever deducted.
2. The source worked example is inconsistent:
   - average = 56%;
   - gamer = 70%;
   - source says `x = 24`;
   - `70 - 56 = 14`;
   - the displayed payout also does not match the written formula with `x = 24`.
3. Define which gamers are included when computing `matchday_average_result`.

## 12.6 Prediction presentation (Game Rules v2)

- Predictions are made matchday by matchday with navigation between MD1 and MD34.
- After the matches each prediction is marked: **green = correct**, **red = wrong**, and the real result is then shown in **black**.
- The matchday summary shows the score (rate of correct predictions), the average of all managers and the earnings obtained.
- Prediction earnings are added to matchday earnings and feed the **Predictions** ranking.
- While a match is in progress the prediction tooltip reads "your prediction can no longer be changed".

---

# 13. Postponed Matches

Rules:

- a player in a postponed match receives the normal bonus-based value increase when the postponed match is eventually played;
- the original starters for the affected matchday are remembered;
- those starters receive the deferred earnings when the match is played;
- the gamer still receives those earnings even if the player has since been sold;
- at freeze, players involved in a postponed match do not contribute to the matchday earnings ranking;
- deferred earnings follow the normal `70% Budget / 30% Blocked Account` split.

---

# 14. Blocked Account

- The Blocked Account cannot be used for transfers.
- The Blocked Account counts toward total wealth/general ranking.
- Positive earnings are split 70/30 between Budget and Blocked Account.
- Negative earnings are charged 100% to Budget.

---

# 15. Rankings and Tables

## 15.1 Gamer rankings

**Updated in v1.3 (Game Rules v2)** — there are six gamer rankings:

| Ranking | What it ranks | Required fields |
|---|---|---|
| Overall (General) | Total squad value (`Budget + Blocked Account + Squad Value`) — the main ranking | Rank, name, favourite club, squad value, budget, honours |
| Primes | Earnings generated by the starters | Rank, name, favourite club, squad value, total primes, latest primes |
| Predictions | Prediction earnings | Rank, name, favourite club, squad value, total predictions, latest predictions |
| Speculation | Capital gain made on purchases and sales | Rank, name, favourite club, squad value, speculation (total sales − total purchases), number of transfers made |
| Bench | Substitutes' earnings | Rank, name, favourite club, squad value, bench primes, latest bench primes |
| Honours | Honours points accumulated over all seasons | Rank, name, favourite club, best ranking, TOP10 count, TOP20 count, TOP30 count |

Behaviour common to all rankings:

- viewable for the whole season, the first half, the second half, or a specific matchday;
- search by username and a "show only my friends" filter;
- every column sortable (blue arrow);
- pagination, and a championship selector (2026/2027);
- the rank shows its evolution (up/down arrow with places gained or lost);
- the persistent sidebar shows the signed-in gamer's overall position, always centred among neighbours.

The earlier "Squad" ranking (squad value at a precise moment), "Gain/Dividend" ranking and "Portfolio" ranking are not separate rankings in Game Rules v2: squad value is part of Overall, and "Gain/Dividend" is now **Primes**.

## 15.2 Player table/ranking requirements

### General

- Rank
- club + name
- current value
- initial value
- total earnings
- holders
- last transfer-window purchases - sales

### Performance

- Rank
- club + name
- current value
- goals
- assists
- penalties
- yellow card
- red card
- matches played
- starts

### Goalkeeper

- Rank
- club + name
- current value
- saves
- clean sheets
- yellow card
- red card
- matches played
- starts

Sorting:

- position;
- club;
- price.

### Players page views (Game Rules v2)

The Players page offers three views, sortable by position, club and price, with search, a price slider, a club multi-select (all 18 clubs) and a position filter (All, Goalkeepers, Defenders, Midfielders, Forwards):

- **Overall:** rank, club + name, current value, initial value, total primes, last prime, holders, last Mercato (purchases − sales).
- **Performance:** rank, club + name, current value, goals, assists, penalties, yellow cards, red cards, matches played, starts. When sorted by goalkeeper the columns become: rank, club + name, current value, saves, clean sheets, yellow cards, red cards, matches played, starts.
- **Speculation:** period filter (**since the start**, **since the last Mercato**, **today**); columns: value, initial value, primes, purchases, sales, holders, impact of the last Mercato.

### Persistent sidebar (Game Rules v2)

On every screen: username, squad value, Budget, overall rank (centred among neighbours), and the current **Top Buys / Top Sells** (most bought and most sold players, with the impact on their value and the number of transactions in brackets). The sidebar's "see all" opens the rankings / the Speculation view.

## 15.3 Pending ranking definitions

- The exact time period of Top Buys / Top Sells (the metric is now defined as value impact with transaction count; "today" is the period used by the Speculation view).
- Eligibility and tie-break rules for rankings.

---

# 16. Honours, Trophies and Performance Index

**Replaced in v1.3 (Game Rules v2).** The earlier trophy points table (100/75/50 …) is superseded by the honours points table below. "Performance Index" and "Honours points" refer to the same running total; Game Rules v2 uses "Honours".

```text
HONOURS_POINTS =
    SUM(points from all honours earned since account creation, across seasons)
```

## 16.1 Honours points

At the end of a period the final ranking awards decreasing points by position. Points are awarded for: the overall season ranking, the first-half ranking, the primes ranking, the predictions ranking, and matchday badges (best managers of a matchday).

| Rank | Overall | First half | Primes | Predictions | Matchday primes | Matchday predictions |
|---|---:|---:|---:|---:|---:|---:|
| 1st | 300 | 15 | 70 | 35 | 15 | 5 |
| 2nd | 250 | 10 | 60 | 30 | 12 | — |
| 3rd | 200 | 5 | 50 | 25 | 10 | — |
| 4th–10th | 150 | — | 30 | 15 | 5 | — |
| 11th–20th | 100 | — | 25 | 10 | 4 | — |
| 21st–30th | 75 | — | 20 | 8 | 3 | — |
| 31st–50th | 50 | — | 10 | 6 | 2 | — |
| 51st–100th | 25 | — | 6 | 4 | 1 | — |

## 16.2 Trophies

- Each notable performance unlocks a trophy shown with a "won / total" counter.
- The gamer ticks the trophy of their choice; it then appears on their player card and in all MarketFoot rankings.
- A season-by-season history shows points, best rank and the position in each ranking.
- The Honours tab shows honours points, honours rank, trophies won out of the total, best ranking and a trophy grid.

**Pending UI clarification**

The final visual behaviour of the Performance Index bar is not locked. Game Rules v2 does not describe it.

---

# 16A. Hall of Fame

**New in v1.3 (Game Rules v2)**

The Hall of Fame keeps all-time records, per matchday or per season (a selector switches between them). Each record shows a **podium** (1st–3rd) and the **top 10**, including the matchday and season of the record, and also shows the signed-in gamer's own position.

| Category | Record | Definition |
|---|---|---|
| Managers | Primes | Biggest earnings from starters |
| Managers | Bench | Biggest earnings from substitutes |
| Players | Mercato | Biggest buy/sell capital gain |
| Players | Primes | Ligue 1 players who generated the most primes |
| Players | Purchases | Most bought in the Mercato |
| Players | Sales | Most sold in the Mercato |

Game Rules v2 is not consistent about where "Mercato" sits: the rules table lists it under Players, while the Hall of Fame screen description lists a manager "Mercato" record (buy/sell capital gain) under Managers. This is recorded in section 24.

Header navigation includes a prominent **Hall of Fame** button.

---

# 17. Friends / Following and Profiles

**Client confirmed**

- Friends are used to follow other gamers' results.
- Every gamer has a public profile.
- Some profile information remains private.
- `Only my friends` / `see my friends` is a ranking/filtering requirement for viewing friends' results.

**Pending UI clarification**

Figma will define:

- add/follow interaction;
- whether the relationship is one-way follow or another model;
- exact public profile fields;
- exact private profile fields.

**Game Rules v2 detail**

- The gamer area has four tabs: **Performance**, **Honours**, **Friends**, **My Space**.
- **Friends:** username search, period filters (Overall, First half, Second half, Matchday), and a table with rank, username, favourite club, squad value, budget, primes, latest primes and honours points. The signed-in gamer's row appears among their friends.
- **Performance:** season selector; rank in each ranking (Overall, Primes, Predictions, Bench, Speculation, Honours) and a rank-evolution chart; squad value broken into total primes, total Mercato and Locked account; last-matchday details (each starter's prime, bench, bonus, predictions) with a matchday selector (latest by default); matchday history (ranking, performance, primes, trophies); and the transfer history (date, type Mercato or Free, outgoing player and value, incoming player and value, balance).
- **My Space (private):** avatar (file upload), username, status, favourite club, title and region; login and security (email, password); theme (light, dark, automatic); personal data (consents, terms of use, privacy policy, legal notice); logout; account deletion. A dark theme is **to be decided**.
- Every gamer name links to that gamer's profile; every player name to the player's profile; every match score to the match profile.

---

# 18. Conduct, Ghosting, and Sanctions

Ghosting is prohibited.

A user may not create multiple accounts to distort competition, including equivalent play within the same geographic entity.

Required administrator controls include:

- detection/reporting of multiple accounts;
- deletion of secondary accounts;
- reset of the main account;
- ability for an administrator to delete an account.

Current documented reset behavior:

- squad must be rebuilt;
- prediction earnings are retained.

**Pending client input**

The reset/retention behavior for the following still requires confirmation:

- Budget;
- Blocked Account;
- rankings;
- trophies;
- historical records;
- other account state.

---

# 19. Administration Panel Requirements

## 19.1 Player Management

Administrator can:

- create players;
- edit players;
- delete players;
- assign players to clubs;
- manage player values.

## 19.2 Competition Management

Administrator can:

- create matchdays;
- create matches;
- manage schedules.

## 19.3 Match Data Entry

Administrator can enter:

- results;
- individual player statistics;
- match events;
- postponed-match data;
- all data required by the calculation engine.

## 19.4 Game Management

Administrator can:

- open/close game phases;
- configure phase timings;
- launch calculation processes;
- review historical data;
- manually correct data;
- manually trigger recalculation.
- distribute primes and revalue players manually during a full closure (usually the day after the last match);
- run the post-Mercato update manually when required;
- delete an account (stated again in Game Rules v2, part 19, "For developers").

## 19.5 Historical corrections

**Client confirmed**

When historical match/player data is corrected, every affected:

- earning/bonus;
- Budget;
- player value;
- prediction;
- ranking

must be recalculated.

The administrator may manually initiate the recalculation, but the affected product results must update automatically from that correction.

---

# 20. Required Screens and Information Architecture

## 20.1 Onboarding

- Welcome page
- Connexion
- Account Informations
  - Username
  - Email
  - Password
- Create Your Team
- Pick the Players / List of Players

## 20.2 My Team / Manage Your Team

- Your Team
- Team options
- Composition
- Captain
- Transfer
- Prediction
- Bonus panel (open by default on the composition tab)
- Value / Speculation / Owners display selector above the pitch
- Choose your captain
- Make your transfers
- Make your predictions

## 20.3 Primary navigation

Updated in v1.3:

- My Team
- Rankings
- Ligue 1
- Players
- Hall of Fame (header button)
- My Space (account area)

The Ligue 1 page opens directly on the league table, with the last matchday's results in a banner below the menu.

## 20.4 Persistent shortcuts

- Username, squad value and Budget
- General ranking (signed-in gamer always centred)
- Top Buys
- Top Sells
- "Next match in..." countdown

## 20.5 Ranking page

- Datatable
- Overall
- Primes
- Predictions
- Speculation
- Honours
- Bench
- Period filter: whole season, first half, second half, matchday
- Username search
- Only my friends
- Pagination and championship selector

## 20.6 Players area

- Overall
- Performance
- Speculation (since the start / since the last Mercato / today)
- Goalkeeper
- Defender
- Midfield
- Attack
- Price
- Club
- Championship
- Search player
- datatable

## 20.7 Ligue 1 Results

- Score Table
- Championship
- Gameweek
- Results

## 20.8 Ligue 1 Ranking

- Ranking Table
- Championship
- Gameweek
- General
- Home
- Away

## 20.9 Player Profile side panel

- Club
- Name
- Position
- Goal
- Assist
- Cards
- Value
- Last scores

## 20.10 Team Profile

- player/team detail datatable
- Ranking
- General ranking
- Top Buying
- Top Selling
- General/Home/Away ranking
- Championship
- Results
- Calendar

Team (club) profile content from Game Rules v2: the club's squad table (position G/D/M/F, matches, starts, value) with a "See full squad" link that also shows players who have not played, followed by the club's fixtures matchday by matchday (date, time, opponent, score) with past and upcoming matches. The club page is reached by clicking a shirt or any club name.

**Pending client input**

- remaining Team Profile datatable fields;
- Transaction History fields and filters.

---

# 21. Historical Product Requirements

The product must retain enough history to support:

- gamer Transaction History;
- administrator review of historical data;
- user performance history;
- seasonal rankings;
- original starter selections for postponed matches;
- corrected historical values and their recalculated effects.

---

# 22. Responsive Product Requirement

The product must support both:

- desktop;
- mobile.

---

# 23. Current Constants and Rule Status

| Rule | Current value / status |
|---|---|
| Squad size | 19 |
| Position split | 3 GK / 6 DF / 5 MF / 5 FW |
| Formation | 1-4-3-3 |
| Starters | 11 |
| Substitutes | 8 |
| Same-club limit | 4 |
| Transfer quota | 4 total per matchday cycle, combined across outside-window and Mercado |
| Marketfoot Value floor | €500,000 |
| Real Value floor | €0 |
| Real Value demand term | +€10k buy / -€10k sale — provisional relationship |
| Marketfoot demand effect | +€20k buy / -€20k sale — provisional relationship |
| Transfer-window recalculation constant | €20,000 with `/2` |
| Captain reuse limit | 6 times per Championship per player |
| Current `COEFF_INI` | 0.8 — provisional |
| Current `COEFF_STEP` | 0.02 — provisional |
| Transfer-window tax schedule | 8/7/6% current reference, pending replacement |
| Outside-window tax schedule | 10/9/8% current reference, pending replacement |
| Fixed Mercado commission | €100,000 per order |
| Positive earnings distribution | 70% Budget / 30% Blocked Account |
| Negative earnings | 100% Budget |
| Prediction `G` limits | -€2m to +€2m |
| Team freeze offset | 2 hours before each team's kickoff |
| Season | 2026/2027, 18 clubs, 34 matchdays, first and second half |
| Bonus | 1 per matchday; success pays +10% of starters' primes; locks 2h before the first match of the matchday; scale per bonus pending |
| Captain deadline | Up to 2h before the match, while the player's team is not frozen |
| Mercato window | 24 hours; maximum 4 orders; cancellable while open |
| Honours points | Table in section 16.1 (replaces the v1.2 trophy points) |

---

# 24. Remaining Client Inputs and Clarifications

The following product decisions are still open:

1. Final UI/state terminology for Freeze / Fixing / Open and transfer-window/closure/unfreeze labels.
2. Replacement Initial Budget formula.
3. Final transfer-tax rates and cutover points.
4. Final player initial-value formula and New pro `Club_value` base.
5. Final relationship between Real Value and Marketfoot Value.
6. ~~Starter-only earnings rule versus substitute values~~ — resolved in v1.3: only starters feed the Budget; substitutes' primes are Bench primes (squad value and Bench ranking only). The starter/substitute amounts in the prime tables remain to be confirmed.
7. Meaning of the asterisks on Hat trick and 8+ saves.
8. Whether goalkeeper-save events apply only to goalkeepers.
9. Whether negative prediction `G` is deducted.
10. Corrected prediction worked example/formula behavior.
11. Population used to calculate `matchday_average_result`.
12. Friend/follow interaction and profile field visibility.
13. ~~Gain ranking metric~~ — resolved in v1.3: the "Gain/Dividend" ranking is the Primes ranking (starters' earnings).
14. Top Buying time period (metric now defined: value impact and number of transactions).
15. Top Selling time period (same).
16. Remaining Team Profile datatable fields.
17. Transaction History fields and filters.
18. Year 1 VM update formula.
19. ~~Terminology for Bonuses vs Dividends and Portfolio vs Squad~~ — resolved in v1.3: Primes and Squad (see 2.1).
20. Ghosting reset scope beyond squad rebuild and retained prediction earnings.
21. Final Performance Index bar behavior (Game Rules v2 does not describe it).
22. Bonus scale per bonus, final bonus names, and the usage maximum per bonus.
23. Whether the Mercato record belongs to Managers or Players in the Hall of Fame.
24. Dark theme.
25. Impact of a purchase/sale on a player's value: fixed or proportional amount, and when it is applied (real time or deferred) — restated as open in Game Rules v2, part 18.
26. Locked account: Game Rules v2 describes the 30% / 70% split but also lists the locked-account share as still to be defined, so 70/30 stays provisional.
27. Whether the transfer-tax rate differs between free transfers and Mercato (Game Rules v2 says it does, without amounts — consistent with the current schedule).
28. Game Rules v2 omits the amounts of every prime, malus and team-result scale.

---

# 25. Functional Completion Criteria

MARKETFOOT is functionally complete when the confirmed product rules allow the following end-to-end behavior:

- a gamer can register/login and create a valid initial squad;
- a gamer can view and manage Budget, Blocked Account, squad/portfolio, and transaction history;
- a gamer can manage starters, substitutes, and captain subject to freeze rules;
- a gamer can make transfers and submit Mercado orders under the documented quota and financial conditions;
- a gamer can submit match predictions under the documented prediction windows;
- administrator-entered player and match data produces the required bonus/malus, value, Budget, and ranking updates;
- postponed fixtures preserve original starter eligibility and settle later;
- rankings, seasonal statistics, trophies, honours points, the Hall of Fame, and performance history are available according to the confirmed definitions;
- a gamer can play one bonus per matchday and the +10% effect is settled with the matchday;
- Ligue 1, Players, Player Profile, Team (club) Profile, My Team, Ranking, Hall of Fame and My Space screens are available;
- administrators can manage players, matchdays, matches, schedules, match data, phases, history, corrections, and recalculation;
- the product works on desktop and mobile.

Where a rule remains explicitly pending, that part of the product remains pending client confirmation rather than being treated as finalized.

---

# 26. Interaction Rules (Game Rules v2)

## 26.1 Tooltips

- Shirt: "see the [Club] profile". Club code in a profile (PSG, SB29…): same.
- Player name: "see [player name]'s profile". Eye icon: "see quick profile".
- (+) in a panel: "add to my team". (−): "remove from my team". Bin icon: "delete". Logout icon: "log me out".
- Captain marker: number of times captained (for example "captain 4 times"); at the limit: "this player has already been captain 6 times, their primes will no longer be doubled".
- Each icon explains its meaning (for example ball = "goal").
- Player who cannot be replaced or transferred: "team frozen".
- Prediction in progress: "your prediction can no longer be changed". Prediction result: green "correct prediction", black "result", red "wrong prediction".

## 26.2 Click targets

- Every manager name links to that manager's profile; every player name to the player's profile; every match score box to the match profile.
- Boxes in the primes history, the match sheet, and the ranking box on the gamer profile show a clickable selection gradient.

## 26.3 General rules

- Frozen team: its players cannot be modified and cannot be recruited.
- Every table is sortable by each column.
- The first-line-up flow uses a quick player profile ("player-out panel") that moves in to the left of the open panel.

---

# 27. Screen Inventory (Game Rules v2, part 20)

Game Rules v2 documents **35 Figma screens**: Select your player (3 states, one with a quick player profile), Team Page Composition (6 states), Captain choice (2), Transfer (3 plus Mercato), Predictions (3), Hall Of Fame, Ranking Page (2), Ligue 1 Ranking and Results, Player Table (4), Player Form (in my team, not in my team, activity details), Team Form (club), and Gamer Form (Performance, Honours, Friends, My Space). `docs/MARKETFOOT_FIGMA_SCREEN_MAP.md` maps every one of them to a route.

---

# 28. Change Log

## v1.3 — 5 November 2026 (reconciled with Game Rules v2)

**Added:** section 1.3 (season and game loop), 2.1 (terminology), 6.4 (Bonus), 6.5 (recruitment interaction), captain presentation, 7.5 (indicative schedule and phase rules), 9.1 order-book details, 11.8 (matchday earnings), 12.6 (prediction presentation), the Players page views and sidebar, 16A (Hall of Fame), the gamer-area tab details, new admin duties, new constants, sections 26 and 27, and pending items 22–28.

**Changed:** the ranking set (six rankings, renamed fields and filters), the trophy points table (now honours points, much higher values), the starter/substitute rule (resolved), Gain ranking (resolved), terminology (resolved), primary navigation, and the Players area.

**Unchanged:** all numeric scales not restated by Game Rules v2 (prime amounts, tax rates, budget coefficients, demand effect, prediction formula).
