---
title: "MARKETFOOT — Source Rules & Formula Reference"
version: "v3.2.0-source-extract"
source: "MARKETFOOT Technical Specifications v3.2.0"
purpose: "Temporary implementation reference for building the app from the supplied specification"
status: "Contains provisional and internally conflicting source rules exactly as documented"
---

# MARKETFOOT — Source Rules & Formula Reference

This file extracts the formulas, constants, calculations, constraints, rankings, sanctions, and operational rules from the supplied **MARKETFOOT Technical Specifications v3.2.0**.

It is intended to be used as the **current implementation reference** while building the application.

> **Superseded in part (5 November 2026):** `MarketFoot_Game_Rules_v2.pdf` is the newer client statement. Where it conflicts with this extract — notably section 37 trophy points (now honours points), the starter/substitute earnings rule, the ranking set and terminology — follow PRD v1.3. This file is kept unchanged below as the record of the v3.2.0 source; see PRD v1.3 section 28 for the change list.

## Important source warning

The source explicitly states:

> EVERYTHING ON A YELLOW BACKGROUND WILL PROBABLY CHANGE

Therefore, rules marked in the source as likely to change are still included here because they are the current available rules, but they should be treated as provisional.

This file does **not** silently correct or reconcile contradictions in the source. Where the source contains conflicting values or unclear definitions, the conflict is recorded explicitly.

---

# 1. Core Game Objective

MARKETFOOT is a football simulation game based on the French Championship.

A gamer:

- builds and manages a squad;
- buys and sells players through transfers;
- gains or loses virtual money through player-performance earnings;
- gains virtual money through match predictions;
- aims to maximize total virtual wealth.

## 1.1 Total wealth

```text
TOTAL_WEALTH = SQUAD_VALUE + BUDGET + LOCKED_ACCOUNT
```

Virtual currency: EUR (€).

The game is recreational and pays no real money.

---

# 2. Core Entities

| Term | Source definition |
|---|---|
| Gamer | Participant in the game |
| Player | Real footballer taking part in competitions |
| Squad | Set of players held by a gamer |
| Transfer budget / Budget | Money available for transfers, credited/debited by bonuses, predictions, and transfer differential |
| Transfer-window budget | Temporary budget modified by transfer orders and valid only during the transfer-window period |
| Locked account | Portion of earnings set aside; cannot be used for transfers; included in general wealth ranking |
| Closure | Period during which no transaction is possible |
| Transfer window | First period after a matchday; transfer orders + predictions possible; direct transfers impossible |
| Open period | Period outside the transfer window during which transactions are possible |

## 2.1 Squad value

```text
SQUAD_VALUE = SUM(CURRENT_VALUE_OF_EACH_OWNED_PLAYER)
```

---

# 3. Game Cycle and Timing

## 3.1 Matchday cycle

```text
1. Team freeze
2. Start of matchday matches
3. End of matchday matches
4. Match-sheet entry + value calculations + earnings distribution
   + budget update + ranking update
5. Transfer window for 24h
6. Closure / team freeze
   + execute transfer orders
   + recalculate values
   + update budgets
   + update rankings
7. Unfreeze / open period
```

## 3.2 Team freeze

```text
TEAM_FREEZE_TIME = MATCH_KICKOFF_TIME - 2 HOURS
```

Rules:

- a team's players become frozen when that team's match is within 2 hours;
- no transaction is allowed on players due to participate in that match;
- no transaction is allowed on players who already participated earlier in the same matchday;
- if matches are not simultaneous, freezing is progressive/partial;
- players from teams whose match is not yet approaching remain available;
- full freeze occurs once all teams of the matchday have played.

## 3.3 Full closure

During full closure:

- the administrator enters match information;
- earnings are distributed;
- values are revalued;
- rankings are updated;
- budgets are updated.

The updated rankings and budgets become visible when the game reopens.

## 3.4 Transfer-window permissions

During the transfer window:

- transfer orders can be placed;
- predictions are possible;
- substitutions are possible;
- captain choice is possible;
- direct transfers are impossible.

Orders are executed at the end of the transfer window.

## 3.5 Unfreeze / open period

During unfreeze/open period:

- squad creation is possible;
- direct transfers are possible;
- substitutions are possible;
- captain choice is possible;
- predictions are possible;
- all players can generally be bought/sold.

---

# 4. Squad Rules

## 4.1 Mandatory squad composition

Formation:

```text
1-4-3-3
```

```text
TOTAL_PLAYERS = 19
STARTERS = 11
SUBSTITUTES = 8

GOALKEEPERS = 3
DEFENDERS = 6
MIDFIELDERS = 5
FORWARDS = 5
```

The source describes this as:

```text
11 starters + 2 substitutes per position
```

## 4.2 Same-club limit

```text
MAX_PLAYERS_FROM_SAME_CLUB = 4
```

The source also states this may be reassessed in international knockout competitions.

## 4.3 Starter earnings rule

Source rule:

```text
ONLY THE 11 STARTERS EARN BONUSES
```

### Source inconsistency

The detailed BONUS and PENALTY tables later provide separate starter/substitute values.

Both source rules are preserved.

---

# 5. Initial Budget

## 5.1 Formula

```text
INITIAL_BUDGET =
    AVG * 19 * COEFF_INI
    + (NB_MATCHDAY * COEFF_STEP)
```

Parameters:

```text
AVG = average Marketfoot value of players participating in the competition
      when the squad is created

NB_MATCHDAY = number of matchdays already played in the current season

COEFF_INI = 0.8
COEFF_STEP = 0.02
```

## 5.2 Examples

At competition start:

```text
INITIAL_BUDGET = AVG * 19 * COEFF_INI
```

Before Matchday 12:

```text
INITIAL_BUDGET =
    AVG * 19 * COEFF_INI
    + (11 * 0.02)
```

## 5.3 Status

The source marks this area:

```text
WILL CHANGE
```

---

# 6. Initial Squad Creation

```text
INITIAL_SQUAD_VALUE <= AVAILABLE_BUDGET
```

Additional rules:

- maximum 4 players from one club;
- initial squads do not generate player capital gain;
- if a team is created during closure/team freeze, it is validated only at the next open period;
- transfers are free and unlimited until the initial squad is validated.

---

# 7. Squad Changes

## 7.1 Substitution

```text
STARTER ↔ SUBSTITUTE
```

Rules:

- free operation;
- both players must already be among the 19 owned players;
- no effect on Budget.

## 7.2 Transfer

```text
SELL / REMOVE ONE OWNED PLAYER
+
BUY ONE MARKET PLAYER
```

It is a paid squad replacement operation.

## 7.3 Captain

Rules:

- captain must be one of the starters;
- same player may be captain at most 6 times per Championship;
- after the sixth use, that player cannot be captain again in that Championship;
- a player from a frozen team cannot be selected as captain.

Multiplier:

```text
CAPTAIN_EFFECT = BASE_EFFECT * 2
```

This applies to positive and negative bonuses/maluses.

---

# 8. Transfer Quota

```text
MAX_TRANSFERS_BETWEEN_TWO_MATCHDAYS = 4
```

---

# 9. Transfer Costs and Taxes

Each transfer debits a tax based on the value of the purchased player.

## 9.1 Tax schedule — Section 4.3

### During transfer window

```text
MD1-MD17  = 8%
MD18-MD26 = 7%
MD27-MD34 = 6%
```

### Outside transfer window

```text
MD1-MD17  = 10%
MD18-MD26 = 9%
MD27-MD34 = 8%
```

## 9.2 Outside-window transfer feasibility

```text
BUDGET + VALUE_PLAYER_SOLD
>=
VALUE_PLAYER_BOUGHT + TAX
```

A transfer outside the transfer window cannot be completed if it makes Budget negative.

## 9.3 Negative Budget after transfer window

If Budget becomes negative after transfer-window settlement:

```text
NEXT_OUTSIDE_WINDOW_TRANSFER_ALLOWED
ONLY IF
NEW_BUDGET > OLD_NEGATIVE_BUDGET
```

The next transfer must make Budget less negative.

---

# 10. Transfer Tax — Source Conflict

The source provides multiple schedules.

## Section 4.3

```text
Transfer window: 8% → 7% → 6%
Outside window: 10% → 9% → 8%
```

Periods:

```text
MD1-MD17
MD18-MD26
MD27-MD34
```

## Section 5.1

```text
variable tax in effect = 7% / 6% / 4% championship
```

Marked:

```text
WILL CHANGE
```

## Section 14.3

```text
Transfer window:
8%
→ 7% post-MD17
→ 6% post-MD28

Outside transfer window:
10%
→ 9% post-MD17
→ 8% post-MD28
```

These definitions conflict and must remain configurable until replaced.

---

# 11. Transfer Business Rules

The source states:

- sell a player to buy a more expensive player → squad value increases;
- sell a player to buy a cheaper player → can cover a Budget shortfall;
- players transferred outside the Championship no longer generate earnings and their value drops.

The exact value-drop formula for a player leaving the Championship is not defined.

---

# 12. Transfer-Window / Mercado Order Book

## 12.1 Order acceptance

An order is accepted only if transfer-window Budget remains positive.

Source expression:

```text
BUDGET
+ SUM(VALUE_OF_PLAYERS_TO_SELL)
>=
SUM(VALUE_OF_PLAYERS_TO_BUY_WITH_TAX)
+ NB_ORDERS
+ (% OF SUM(VALUE_PLAYERS_TO_BUY))
```

The source also defines:

```text
FIXED_TRANSFER_WINDOW_COMMISSION = €100,000
```

Current intended expression:

```text
BUDGET
+ SUM(VALUE_PLAYERS_TO_SELL)
>=
SUM(VALUE_PLAYERS_TO_BUY)
+ (NUMBER_OF_ORDERS * 100000)
+ (VARIABLE_TAX_RATE * SUM(VALUE_PLAYERS_TO_BUY))
```

Order validation uses player values from before the transfer window.

### Source inconsistency

The worked examples apply percentage tax but do not visibly include the fixed €100,000 commission.

---

# 13. Transfer-Window Value Recalculation

```text
VALUE_PLAYER_AFTER_WINDOW =
    VALUE_PLAYER_BEFORE_WINDOW
    + (NUMBER_PURCHASES - NUMBER_SALES) * (20000 / 2)
```

Where:

```text
NUMBER_PURCHASES = purchases by ALL gamers for the player during the window
NUMBER_SALES = sales by ALL gamers for the player during the window
```

Rules:

- initial-squad sales are not counted;
- 20,000 is the source change per purchase/sale;
- the `/2` represents 50% of capital gain/loss.

Equivalent net effect:

```text
TRANSFER_WINDOW_EFFECT_PER_NET_ORDER = €10,000
```

---

# 14. Insufficient Budget After Transfer-Window Execution

If updated values make an accepted order unaffordable:

- transfer still executes;
- Budget may become negative;
- next outside-window transfer is allowed only if it makes Budget less negative.

---

# 15. Transfer-Window Worked Examples

## 15.1 Inputs

```text
P1 = 3,000,000
P2 = 1,000,000
P3 = 4,000,000
P4 = 1,000,000
G1 Budget = 3,300,000
```

## 15.2 Order 1

Sell P2, buy P1:

```text
3,300,000 + 1,000,000
>=
3,000,000 + (0.08 * 3,000,000)
```

Remaining transfer-window Budget:

```text
1,060,000
```

Result: accepted.

## 15.3 Order 2

Sell P4, buy P3:

```text
1,060,000 + 1,000,000
>=
4,000,000 + (0.08 * 4,000,000)
```

Source result:

```text
TRANSFER_WINDOW_BUDGET = -2,260,000
```

Result: rejected.

## 15.4 Execution Scenario 1

P1:

```text
3,000,000 + (5 - (22 - 2)) * (20000 / 2)
= 2,850,000
```

P2:

```text
1,000,000 + (5 - 20) * (20000 / 2)
= 850,000
```

G1 Budget:

```text
3,300,000 + 850,000 - (2,850,000 + 0.08 * 2,850,000)
= 1,072,000
```

## 15.5 Execution Scenario 2

P1:

```text
3,000,000 + (200 - 5) * (20000 / 2)
= 4,950,000
```

P2:

```text
1,000,000 + (5 - 5) * (20000 / 2)
= 1,000,000
```

G1 Budget:

```text
3,300,000 + 1,000,000 - (4,950,000 + 0.08 * 4,950,000)
= -1,046,000
```

The transfer still executes.

---

# 16. Player Value Model

The source marks this section:

```text
WILL CHANGE
```

## 16.1 Reference variables

```text
NbPtsClub = previous-season points earned by player's club

Total bonuses N-1 / N-2 = bonuses earned by player in seasons N-1 / N-2

NbJCompetN-1 / N-2 = matchdays completed by player in those seasons,
including not-played matchdays

NbJCompetCourante = matchdays already completed in current season

VMeq = average market value of a club's players
```

The initial-value formulas also use `VM`.

---

# 17. Initial Player Value — Bonuses Component

## PriN-1

```text
PriN-1 =
    TOTAL_BONUSES_N-1 * 34
    / NbJCompetN-1
```

## PriN-2

```text
PriN-2 =
    TOTAL_BONUSES_N-2 * 34
    / NbJCompetN-2
```

## Reduced participation adjustment

If:

```text
NbJCompetN-1 / 34 <= 0.6
```

then:

```text
PriN-1 =
    TOTAL_BONUSES_N-1
    * 34
    / NbJCompetN-1
    * 0.7
```

---

# 18. Bonus Value by Historical Participation

N-1 only:

```text
BONUS_VALUE = PriN-1
```

N-1 and N-2, with `PriN-2 > PriN-1`:

```text
BONUS_VALUE =
    0.5 * PriN-1
    + 0.5 * PriN-2
```

N-1 and N-2, with `PriN-2 < PriN-1`:

```text
BONUS_VALUE = PriN-1
```

N-2 only:

```text
BONUS_VALUE = 0.8 * PriN-2
```

Floor:

```text
if BONUS_VALUE < 0:
    BONUS_VALUE = 0
```

The source does not define the equality branch for:

```text
PriN-2 == PriN-1
```

---

# 19. Initial Player Value by Player Type

Previous-season player:

```text
CLUB_VALUE = 55000 * NbPtsClub
INITIAL_VALUE = CLUB_VALUE + BONUS_VALUE
```

Promoted player:

```text
CLUB_VALUE = 30000 * NbPtsClub
INITIAL_VALUE = CLUB_VALUE + BONUS_VALUE
```

New professional:

```text
INITIAL_VALUE = CLUB_VALUE * 0.75
```

Source ambiguity: the relevant `CLUB_VALUE` base is not defined.

New to Championship — non-star:

```text
INITIAL_VALUE = AVERAGE_VALUE_OF_NEW_CLUB_PLAYERS
```

New to Championship — star:

```text
INITIAL_VALUE =
    AVERAGE_VALUE_OF_NEW_CLUB_PLAYERS
    + 0.25 * (VM - VMeq)
```

Winter transfer — non-star:

```text
INITIAL_VALUE =
    AVERAGE_VALUE_OF_CLUB_PLAYERS_WHO_PLAYED_AT_LEAST_ONE_MATCH
```

Winter transfer — star:

```text
INITIAL_VALUE =
    AVERAGE_VALUE_OF_CLUB_PLAYERS_WHO_PLAYED_AT_LEAST_ONE_MATCH
    + 0.25 * (VM - VMeq)
```

---

# 20. Real Value

```text
REAL_VALUE =
    i
    + a * 10000
    - v * 10000
    + d
```

Where:

```text
i = initial value
a = number of times player has been bought
v = number of times player has been sold
d = sum of player's bonuses
```

Floor:

```text
REAL_VALUE >= €0
```

---

# 21. Marketfoot Value

Marketfoot Value is the actual buy/sell price.

Floor:

```text
MARKETFOOT_VALUE >= €500,000
```

---

# 22. Demand Effect on Player Value

Normal buy:

```text
PLAYER_BOUGHT → PLAYER_VALUE + €20,000
```

Normal sale:

```text
PLAYER_SOLD → PLAYER_VALUE - €20,000
```

Initial-squad exception:

- initial squads do not generate capital gain;
- sale of a player acquired in the initial squad does not generate normal capital loss.

---

# 23. Value-Model Difference

The source simultaneously contains:

```text
REAL_VALUE demand:
+€10,000 per buy
-€10,000 per sale
```

and:

```text
Marketfoot demand:
+€20,000 per buy
-€20,000 per sale
```

and:

```text
Transfer-window:
(NUMBER_PURCHASES - NUMBER_SALES) * (20000 / 2)
```

The source does not define one unified relationship among these mechanisms.

---

# 24. Earnings Principles

Positive earnings:

```text
70% → BUDGET
30% → LOCKED_ACCOUNT
```

Negative earnings:

```text
100% → BUDGET
```

Captain:

```text
CAPTAIN_BONUS_OR_MALUS = NORMAL_EFFECT * 2
```

---

# 25. BONUS Scale — Player

The source says:

```text
1st number = starter
2nd number = substitute
```

All values are in k€.

| Event | Goalkeeper | Defender | Midfielder | Forward |
|---|---:|---:|---:|---:|
| Starter | 100 | 100 | 100 | 100 |
| Substitute | 20 | 20 | 20 | 20 |
| Goal scored | 210 / 230 | 190 / 210 | 170 / 190 | 150 / 170 |
| Penalty scored | 100 / 120 | 100 / 120 | 100 / 120 | 100 / 120 |
| Assist | 180 / 200 | 160 / 180 | 140 / 160 | 120 / 140 |
| Clean Sheet | 50 / 30 | 100 / 80 | 70 / 50 | 30 / 10 |
| Hat trick `*` | 100 / 120 | 100 / 120 | 100 / 120 | 100 / 120 |
| Goalkeeper save | 15 | 15 | 15 | 15 |
| Bonus 8 saves and + `*` | 100 / 120 | 100 / 120 | 100 / 120 | 100 / 120 |

Conversion:

```text
1 k€ = €1,000
```

Undefined items:

- meaning of `*` on Hat trick;
- meaning of `*` on 8+ saves;
- whether goalkeeper-save events should apply only to goalkeepers.

---

# 26. PENALTY / MALUS Scale — Player

All values are in k€.

| Event | Goalkeeper | Defender | Midfielder | Forward |
|---|---:|---:|---:|---:|
| Match not played | -200 | -200 | -200 | -200 |
| Red card | -150 / -170 | -150 / -170 | -150 / -170 | -150 / -170 |
| Yellow card | -60 / -80 | -50 / -70 | -60 / -80 | -70 / -90 |
| Own goal | -100 / -120 | -100 / -120 | -100 / -120 | -100 / -120 |
| Substituted during match | -20 / -20 | -20 / -20 | -20 / -20 | -20 / -20 |
| Goal conceded, starting with 2nd conceded | -20 | -20 | -20 | -20 |
| Missed penalty | -100 | -100 | -100 | -100 |

Goals-conceded rule:

```text
0 conceded → 0
1 conceded → 0
2 conceded → -20k
3 conceded → -30k
4 conceded → -40k
5 conceded → -50k
```

The source states:

```text
from the 2nd goal conceded = -20k
then -10k per additional goal
```

---

# 27. Team Result Scale

| Team result | Scale |
|---|---:|
| Away win | +150k |
| Home win | +100k |
| Away draw | +50k |
| Home draw | 0 |
| Away loss | -50k |
| Home loss | -150k |

---

# 28. Predictions

Format:

```text
1 = home win
N = draw
2 = away win
```

Rules:

- match can be predicted only before kickoff;
- prediction can change until kickoff;
- end-of-match result is used;
- no penalty is stated for a wrong prediction;
- forgotten prediction counts as wrong;
- future matchdays may be predicted;
- postponed matches cannot be predicted;
- postponed matches are excluded from prediction calculation;
- an advance prediction for a postponed match is ignored.

Source example:

```text
9 correct out of 10 eligible matches
with one forgotten
=
90%
```

Source-derived percentage expression:

```text
GAMER_RESULT_PERCENT =
    CORRECT_PREDICTIONS
    / TOTAL_ELIGIBLE_MATCHES
    * 100
```

---

# 29. Prediction Earnings Formula

Marked by source:

```text
WILL CHANGE
```

Difference from average:

```text
x =
    gamer_result
    - matchday_average_result
```

Earnings:

```text
G =
    (
        (0.008 * x^3)
        + (8 * x)
        + 400
    )
    * 1200
```

Limits:

```text
MIN_G = -€2,000,000
MAX_G = +€2,000,000
```

Equivalent:

```text
G = clamp(calculated_G, -2000000, 2000000)
```

Special case:

```text
if gamer_result == 0% and G > 0:
    PREDICTION_EARNINGS = €0
```

Distribution:

```text
70% → BUDGET
30% → LOCKED_ACCOUNT
```

---

# 30. Prediction Source Inconsistency

The source example says:

```text
average = 56%
gamer = 70%
x = 24
```

but the preceding formula gives:

```text
x = 70 - 56 = 14
```

The source also states:

```text
((0.008 * 24^3) + 8*24 + 400) * 1200 = €702,592
```

This is preserved as a source inconsistency.

---

# 31. Postponed Match Earnings

Rules:

- player value increases according to earnings when postponed match is played;
- original starters for that matchday are recorded;
- earnings are paid later when the match occurs;
- payout is still received even if the gamer sold the player meanwhile;
- affected players do not contribute to the original matchday earnings ranking at freeze;
- deferred earnings use normal distribution.

```text
70% → BUDGET
30% → LOCKED_ACCOUNT
```

---

# 32. Locked Account

```text
POSITIVE_EARNINGS:
70% BUDGET
30% LOCKED_ACCOUNT

NEGATIVE_EARNINGS:
100% BUDGET
```

Locked Account:

- cannot be used for transfers;
- counts toward total wealth/general ranking.

---

# 33. Rankings

General:

```text
GENERAL_RANKING_VALUE =
    BUDGET
    + LOCKED_ACCOUNT
    + SQUAD_VALUE
```

Achievements:

```text
ACHIEVEMENTS_VALUE =
    SUM(TROPHY_POINTS)
```

Squad:

```text
SQUAD_RANKING_VALUE =
    CURRENT_SQUAD_VALUE
```

Bonuses Total:

```text
BONUSES_TOTAL =
    SUM(STARTERS_BONUSES_FOR_EACH_MATCHDAY)
```

Predictions Total:

```text
PREDICTIONS_TOTAL =
    SUM(PREDICTION_EARNINGS_FOR_EACH_MATCHDAY)
```

Matchday Bonuses ranking:

```text
STARTERS_BONUSES_FOR_SELECTED_MATCHDAY
```

Matchday Predictions ranking:

```text
PREDICTION_EARNINGS_FOR_SELECTED_MATCHDAY
```

Source also requires a:

```text
"see my friends" box
```

---

# 34. Gamer Ranking Table Fields

## General

- Rank
- Name
- Favorite club
- Squad value
- Budget
- Achievements

## Earnings

- Rank
- Name
- Favorite club
- Total earnings
- Latest earnings

## Predictions

- Rank
- Name
- Favorite club
- Total predictions
- Latest predictions

## Speculation

```text
SPECULATION =
    TOTAL_SALES - TOTAL_PURCHASES
```

Fields:

- Rank
- Name
- Favorite club
- Speculation
- Number of transfers made

## Achievements

- Rank
- Name
- Favorite club
- Best ranking
- Top 10 count
- Top 20 count
- Top 30 count

## Bench

- Rank
- Name
- Favorite club
- Value
- Total earnings
- Latest earnings

---

# 35. Players Ranking / Table

Sortable by:

- position;
- club;
- price.

General fields:

- Rank
- Club + name
- Current value
- Initial value
- Total earnings
- Holders
- Last transfer-window purchases minus sales

```text
LAST_WINDOW_NET_DEMAND =
    NUMBER_PURCHASES - NUMBER_SALES
```

Performance fields:

- Rank
- Club + name
- Current value
- Goals
- Assists
- Penalty
- Yellow card
- Red card
- Matches played
- Starts

Goalkeeper fields:

- Rank
- Club + name
- Current value
- Saves
- Clean sheets
- Yellow card
- Red card
- Matches played
- Starts

---

# 36. Season Boundaries

```text
FIRST_HALF  = MD1  → MD17
SECOND_HALF = MD18 → MD34
```

---

# 37. Trophies and Performance Index

```text
PERFORMANCE_INDEX =
    SUM(POINTS_OF_ALL_TROPHIES_EARNED)
```

## General ranking points

```text
1st        = 100
2nd        = 75
3rd        = 50
4th-10th   = 40
11th-20th  = 30
21st-30th  = 20
31st-50th  = 10
51st-100th = 5
```

## Bonuses / Predictions ranking points

```text
1st        = 12
2nd        = 9
3rd        = 6
4th-10th   = 3
11th-20th  = 2
21st-30th  = 1
```

## Matchday trophies

```text
1st Top Bonuses of matchday = 6
1st Top Predictions of matchday = 2
```

## First-half ranking

```text
1st = 20
2nd = 15
3rd = 10
```

## Performance Index bar

Marked:

```text
WILL CHANGE
```

Current description:

- bar fill proportional to gap between gamer index and best gamer of all time;
- displayed on profile;
- displayed in rankings.

No exact proportional formula is supplied.

---

# 38. Code of Conduct and Sanctions

Ghosting is prohibited, including:

- multiple accounts by one individual to distort competition;
- identical play within the same geographic entity to obtain an equivalent team.

Sanctions:

```text
DELETE secondary accounts
RESET main account
```

Current reset behavior:

```text
squad must be rebuilt
prediction earnings retained
```

Admin must be able to:

- detect/report multiple accounts;
- reset an account;
- delete an account.

---

# 39. Constants Summary

```text
SQUAD_SIZE = 19

GOALKEEPERS = 3
DEFENDERS = 6
MIDFIELDERS = 5
FORWARDS = 5

STARTERS = 11
SUBSTITUTES = 8

MAX_PLAYERS_SAME_CLUB = 4

MARKETFOOT_VALUE_FLOOR = €500,000
REAL_VALUE_FLOOR = €0

NORMAL_DEMAND_CHANGE = ±€20,000
TRANSFER_WINDOW_CONSTANT = €20,000

CAPTAIN_MAX_USES_PER_CHAMPIONSHIP = 6
TRANSFER_QUOTA_PER_MATCHDAY = 4

COEFF_INI = 0.8
COEFF_STEP = 0.02

FIXED_TRANSFER_WINDOW_COMMISSION = €100,000

POSITIVE_EARNINGS_BUDGET_SHARE = 70%
POSITIVE_EARNINGS_LOCKED_SHARE = 30%
NEGATIVE_EARNINGS_BUDGET_SHARE = 100%

PREDICTION_MIN = -€2,000,000
PREDICTION_MAX = +€2,000,000
```

---

# 40. Source Conflicts and Undefined Areas

Keep these visible during implementation.

1. **Transfer tax conflict**  
   Source contains `8/7/6`, `10/9/8`, and another `7/6/4` transfer-window reference, plus inconsistent MD28 wording.

2. **Fixed Mercado commission vs worked examples**  
   Source defines `€100,000`, but worked examples do not visibly include it.

3. **Starter-only bonuses vs substitute values**  
   General rule says only starters earn bonuses; detailed tables include substitute values.

4. **New professional player value**  
   `INITIAL_VALUE = CLUB_VALUE * 0.75`, but the `CLUB_VALUE` base is not defined.

5. **Real Value vs Marketfoot Value demand**  
   Source contains both `±€10,000` and `±€20,000`.

6. **Prediction example arithmetic**  
   Source says `70% - 56% = 24`, conflicting with the formula.

7. **Prediction negative result**  
   Source says no penalty for wrong prediction, but `G` has a `-€2,000,000` floor.

8. **Hat-trick and 8+ saves asterisk**  
   `*` is not defined.

9. **Goalkeeper saves in every position column**  
   Applicability is not explicitly clarified.

10. **PriN equality branch**  
    `PriN-2 == PriN-1` is not explicitly handled.

11. **Performance Index bar**  
    No exact proportional formula is supplied.

---

# 41. Current Implementation Rule

Until updated client rules are supplied:

1. Use this file as the direct rules reference extracted from Technical Specifications v3.2.0.
2. Treat every source-marked `WILL CHANGE` value as provisional.
3. Keep conflicting values configurable.
4. Do not silently invent behavior for undefined cases.
5. Keep Section 40 visible to developers.
6. When the client supplies a replacement rule, update this file and the centralized rules engine together.
