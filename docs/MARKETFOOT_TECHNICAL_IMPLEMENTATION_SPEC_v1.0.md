---
title: "MARKETFOOT — Technical Implementation Specification"
version: "1.0"
companion_document: "MARKETFOOT_PRODUCT_FUNCTIONAL_PRD_v1.2.md"
intended_for:
  - GPT coding agents
  - Gemini coding agents
  - human developers
application_type: "Responsive web application"
frontend: "Next.js + TypeScript"
database: "Supabase PostgreSQL"
status: "Technical baseline"
---

# MARKETFOOT — Technical Implementation Specification

This document defines **how MARKETFOOT should be engineered**.

It is intentionally separate from the product/functional PRD.

The companion product document is the authority for:

- game behavior;
- business rules;
- formulas;
- product constraints;
- user flows;
- rankings;
- administrator behavior;
- confirmed client decisions;
- pending client clarifications.

This document is the authority for:

- application architecture;
- code organization;
- rules-engine boundaries;
- database access patterns;
- security requirements;
- coding standards;
- UI implementation practices;
- testing expectations;
- agent workflow.

If this document and the product PRD appear to conflict on a **business rule**, follow the product PRD.

---

# 1. Core Technical Stack

## 1.1 Application

- **Framework:** Next.js
- **Language:** TypeScript
- **Rendering:** use the standard Next.js server/client component model
- **Responsive target:** desktop + mobile
- **Database:** Supabase PostgreSQL
- **Deployment:** compatible with a standard Next.js production deployment
- **Version control:** Git

Use the existing repository conventions where they already exist. Do not rewrite working project structure merely to match an example in this document.

## 1.2 Next.js approach

Prefer the **App Router** for new application code unless the existing repository is already built around another supported Next.js structure.

Default behavior:

- Server Components where browser-only behavior is not required.
- Client Components only where interactivity, browser APIs, local state, or client hooks are actually needed.
- Server-side data access for protected or sensitive data.
- Route Handlers / Server Actions only where they fit the use case cleanly.

Do not make the entire application client-rendered.

---

# 2. Mandatory Engineering Principles

Every implementation must satisfy the following.

## 2.1 Scalable and clean code

Code must be:

- modular;
- readable;
- maintainable;
- strongly typed;
- easy to test;
- easy to extend;
- free from duplicated business logic;
- organized by responsibility.

Avoid:

- giant components;
- giant service files;
- circular dependencies;
- deeply nested conditionals when a clearer model is possible;
- business logic inside JSX;
- duplicated constants;
- duplicated database queries;
- repeated validation logic;
- premature abstraction.

Do not over-engineer simple features.

## 2.2 Secure by default

Security is a requirement, not a cleanup step.

Any implementation involving:

- authentication;
- user-owned data;
- balances;
- squads;
- transfers;
- Mercado;
- predictions;
- rankings;
- administrator actions;
- historical corrections;

must enforce authorization on the server.

Never trust the browser to enforce a business or security rule.

## 2.3 Plan before implementation

**No feature should be implemented before the agent creates an implementation plan.**

Before changing code, the agent must:

1. understand the task;
2. inspect the relevant existing code;
3. read the relevant section of the product PRD;
4. identify affected modules;
5. identify database changes, if any;
6. identify rules-engine changes, if any;
7. identify security implications;
8. identify UI/Figma references;
9. identify tests that must be added or updated;
10. produce a concise implementation plan;
11. only then begin implementation.

The plan should be practical and task-specific.

A suitable plan format is:

```md
## Implementation Plan

### Scope
What is being built or changed.

### Existing Code Affected
Files/modules/features involved.

### Rules Impact
Any rules-engine methods or constants involved.

### Data Impact
Tables, migrations, queries, indexes, or transactions involved.

### UI Impact
Screens/components and Figma references involved.

### Security
Authentication, authorization, validation, RLS, admin permissions.

### Steps
1. ...
2. ...
3. ...

### Validation
Unit, integration, and/or UI tests required.
```

For a trivial visual adjustment, the plan may be very short.  
For a calculation, database, authentication, transfer, or admin change, it must be detailed enough to prevent accidental rule violations.

---

# 3. Agent Operating Contract

These instructions apply to GPT, Gemini, Codex-style agents, IDE agents, and other automated coding assistants working on MARKETFOOT.

## 3.1 Before touching code

The agent must:

- inspect the repository first;
- locate existing implementations before creating new ones;
- read the product requirement relevant to the task;
- read this technical document;
- identify whether Figma screenshots/design references are available;
- create the implementation plan;
- call out unresolved product requirements rather than guessing.

## 3.2 During implementation

The agent must:

- make the smallest coherent change required;
- preserve existing conventions unless there is a clear technical reason to improve them;
- keep business rules inside the rules module;
- keep authorization on the server;
- validate external/user input;
- use typed interfaces;
- avoid copy-pasting logic;
- reuse existing primitives/components/services;
- avoid unrelated refactors;
- avoid changing APIs or database schemas unless necessary;
- avoid adding dependencies for problems already solved by the existing stack.

## 3.3 After implementation

The agent must:

- run the relevant lint/type checks;
- run relevant tests;
- verify the changed user flow;
- verify responsive behavior if UI changed;
- verify authorization if protected behavior changed;
- verify no product rule was duplicated outside the rules engine;
- summarize exactly what changed;
- list any unresolved dependency or follow-up.

## 3.4 Agent must never

- invent missing product rules;
- silently resolve pending client questions;
- hardcode provisional product values in random application files;
- put business calculations inside React components;
- trust client-side checks for authorization;
- expose secrets or service-role credentials to the browser;
- rewrite large working areas without need;
- replace Figma-defined UI with a different design;
- create a second implementation of a rule that already exists in the rules module.

---

# 4. Application Architecture

MARKETFOOT should use a clear layered structure.

A recommended high-level flow is:

```text
UI / Pages / Components
        ↓
Application Actions / Route Handlers
        ↓
Services / Use Cases
        ↓
MARKETFOOT Rules Module
        ↓
Data Access / Repositories
        ↓
Supabase PostgreSQL
```

The exact number of layers should remain proportional to the complexity of the feature.

Do not create abstraction layers that add no real value.

---

# 5. Recommended Folder Structure

Use a structure similar to the following for new code.

```text
src/
  app/
    (auth)/
    (app)/
    admin/
    api/
    layout.tsx
    page.tsx

  components/
    ui/
    layout/
    shared/

  features/
    auth/
    onboarding/
    squad/
    players/
    transfers/
    mercado/
    predictions/
    rankings/
    profiles/
    league/
    admin/

  rules/
    index.ts
    config.ts
    squad.ts
    freeze.ts
    transfers.ts
    mercado.ts
    valuation.ts
    earnings.ts
    predictions.ts
    rankings.ts
    trophies.ts
    postponed.ts
    types.ts

  services/
    auth/
    players/
    squads/
    transfers/
    mercado/
    predictions/
    rankings/
    admin/
    recalculation/

  data/
    repositories/
    queries/

  lib/
    supabase/
      client.ts
      server.ts
      admin.ts
    validation/
    errors/
    utils/

  types/
  config/

  tests/
    unit/
    integration/
    e2e/

supabase/
  migrations/
  seed/

docs/
  MARKETFOOT_PRODUCT_FUNCTIONAL_PRD_v1.2.md
  MARKETFOOT_TECHNICAL_IMPLEMENTATION_SPEC.md
```

This is a recommended structure, not a reason to reorganize a healthy existing codebase without need.

---

# 6. Rules Engine Architecture

## 6.1 Single authoritative business-rules boundary

All MARKETFOOT game rules must live behind one authoritative rules module.

```text
src/rules/
```

The entire platform should consume rules through:

```text
src/rules/index.ts
```

`index.ts` is the **public interface** to the rules engine.

Internal files may separate domains for maintainability, but other parts of the application should not bypass the public rules interface without a strong reason.

Example:

```ts
import { marketfootRules } from "@/rules";
```

## 6.2 Rules module responsibilities

The rules module may contain logic for:

- squad validation;
- formation constraints;
- same-club limits;
- captain eligibility;
- captain limits;
- progressive team freeze;
- transfer eligibility;
- transfer quota;
- Mercado order validation;
- Mercado settlement calculations;
- player valuation;
- earnings;
- bonuses;
- maluses;
- predictions;
- rankings;
- trophies;
- postponed-match rules;
- earnings distribution;
- other documented game calculations.

## 6.3 Rules must not be duplicated

Bad:

```ts
if (playersFromSameClub >= 4) {
  // block player
}
```

inside a React component.

Good:

```ts
const result = marketfootRules.squad.canAddPlayer(input);
```

Bad:

```ts
const frozenAt = kickoff.getTime() - 2 * 60 * 60 * 1000;
```

inside an API route.

Good:

```ts
const frozenAt = marketfootRules.freeze.getTeamFreezeTime(kickoff);
```

Bad:

```ts
const reward = winnings * 0.7;
```

inside an admin page.

Good:

```ts
const distribution = marketfootRules.earnings.distribute(winnings);
```

## 6.4 Rules module must remain independent of UI

The rules module must not depend on:

- React;
- UI components;
- Next.js page components;
- browser APIs.

Where practical, calculation functions should be deterministic and side-effect-free.

This makes rules reusable by:

- server actions;
- API routes;
- admin tools;
- background processes;
- tests;
- recalculation jobs.

## 6.5 Rules versus data access

The rules module decides:

```text
what is allowed
what a calculation produces
what business state should result
```

The repository/data layer decides:

```text
how data is loaded
how data is persisted
```

Do not mix SQL/database calls directly into pure calculation functions.

A service may orchestrate both.

Example:

```text
Transfer Service
    ↓ loads state
Repository
    ↓
Transfer Rules
    ↓ returns decision/calculation
Transfer Service
    ↓ persists result
Repository
```

## 6.6 Provisional rules

The product PRD contains rules that are still awaiting final client values.

Those values must be centralized.

Use a single rules configuration location such as:

```text
src/rules/config.ts
```

Do not scatter provisional values across:

- components;
- route handlers;
- database code;
- services;
- tests.

The exact configuration shape may follow the existing codebase.

---

# 7. Service Layer

Services should coordinate application behavior that requires more than a pure calculation.

Examples:

- create a squad;
- perform a direct transfer;
- submit a Mercado order;
- settle Mercado;
- submit/change a prediction;
- enter matchday results;
- recalculate historical results;
- reset an account;
- update rankings.

A service may:

1. load required state;
2. authorize the actor;
3. validate input;
4. call the rules engine;
5. persist the result;
6. return a typed result.

Services should not redefine rules already owned by `src/rules`.

---

# 8. Data Access and Supabase

## 8.1 Database role

Supabase PostgreSQL stores application state.

Examples include:

- users;
- profiles;
- players;
- clubs;
- matchdays;
- matches;
- match events;
- squads;
- squad membership;
- captain history;
- balances;
- transaction history;
- transfers;
- Mercado orders;
- predictions;
- player values;
- rankings;
- trophies;
- historical snapshots;
- admin/audit data.

Actual schema design should follow the product model and implementation needs.

## 8.2 Database access boundary

Prefer central data-access functions or repositories instead of writing Supabase queries throughout UI code.

Example:

```text
data/repositories/playerRepository.ts
data/repositories/squadRepository.ts
data/repositories/transferRepository.ts
```

UI components should not contain complex persistence logic.

## 8.3 Database migrations

All schema changes must be represented through version-controlled Supabase migrations.

Do not make undocumented production-only schema edits.

Migration changes should include:

- table changes;
- constraints;
- indexes;
- functions;
- policies;
- triggers where genuinely required.

## 8.4 Database constraints

Where a rule is also a data-integrity invariant, use database constraints where practical.

Examples:

- required values;
- valid foreign keys;
- uniqueness;
- non-negative fields where the product guarantees non-negative state;
- enum/check constraints for stable state values.

Do not duplicate complex game formulas in database constraints.

## 8.5 Exact money/value handling

Game balances and player values must not rely on imprecise JavaScript floating-point arithmetic.

Use an exact representation.

Recommended options:

- PostgreSQL `NUMERIC` with decimal-safe application arithmetic; or
- integer smallest units where the product rules support an unambiguous smallest unit.

Do not invent a rounding rule.

If a calculation can create fractional currency and the product specification does not define rounding, flag it before production behavior is finalized.

---

# 9. Supabase Security

## 9.1 Client and server Supabase clients

Keep separate Supabase utilities for browser and server usage.

Example:

```text
lib/supabase/client.ts
lib/supabase/server.ts
lib/supabase/admin.ts
```

The service-role/admin client must be **server-only**.

Never import service-role credentials into client code.

## 9.2 Authorization

Authentication alone is not enough.

Every protected operation must verify whether the current actor is allowed to perform it.

Examples:

- a gamer may modify only their own squad;
- a gamer may submit only their own prediction;
- a gamer may submit only their own transfer/order;
- administrative actions require administrator authorization;
- account deletion/reset requires administrator authorization;
- match data editing requires administrator authorization.

## 9.3 Row Level Security

Use Supabase/PostgreSQL RLS where appropriate as defense in depth.

RLS is not a substitute for clear server-side application authorization.

Server code using privileged credentials must still explicitly enforce authorization because privileged clients may bypass normal RLS behavior.

## 9.4 Input validation

All external input must be validated on the server.

This includes:

- form submissions;
- route parameters;
- search/filter input;
- transfer requests;
- predictions;
- admin match data;
- player edits;
- schedule edits;
- historical corrections.

A schema-validation library such as **Zod** is appropriate if it fits the project.

Client-side validation may improve UX, but it is never the security boundary.

---

# 10. Atomicity and Consistency

Financial and game-state changes must not partially apply.

Operations that update several related records should use an atomic database transaction where necessary.

High-risk examples:

- direct transfer;
- Mercado settlement;
- earnings distribution;
- matchday settlement;
- historical recalculation;
- balance adjustment;
- account reset.

When multi-step Supabase client calls cannot guarantee atomic behavior, use a PostgreSQL function / RPC or another transaction-safe server-side database operation.

Do not implement a multi-record financial update as unrelated writes that can partially succeed.

---

# 11. Concurrency

The application must assume multiple users can act concurrently.

Particular attention is required for:

- Mercado orders;
- Mercado settlement;
- balances;
- transfer quota;
- player demand counts;
- ranking updates;
- administrator settlement actions.

Never depend only on data previously loaded by the browser to validate a financial action.

Final validation must occur against current server/database state.

Where necessary, use:

- transactions;
- row locks;
- database constraints;
- idempotency;
- unique operation identifiers.

---

# 12. Idempotency

Operations that may be retried must not create duplicate financial or game effects.

Examples:

- settling a matchday;
- settling Mercado;
- recalculating after corrections;
- applying earnings;
- generating trophies.

Where appropriate, store settlement/recalculation identifiers or state so the same operation cannot accidentally be applied twice.

---

# 13. Historical Recalculation

The product PRD requires corrected historical data to propagate through affected values.

The recalculation system must be designed so that an administrator can initiate a correction without manually editing all dependent outputs.

A recalculation workflow may need to update:

- earnings;
- balances;
- player values;
- predictions;
- rankings;
- trophies/history where affected.

The recalculation process should be:

- deterministic;
- safe to rerun;
- auditable;
- isolated from presentation logic.

Do not implement historical corrections as arbitrary direct edits to calculated outputs.

---

# 14. Authentication

The final authentication implementation must satisfy the product PRD:

- Username;
- Email;
- Password;
- Google sign-in;
- email-based account/authentication flow through SMTP where required.

Do not expose authentication secrets or raw credentials.

Passwords must never be stored in plaintext.

If the existing application uses an authentication provider or pattern, preserve it unless the project intentionally changes authentication architecture.

---

# 15. API and Server-Side Actions

Every endpoint/action should have one clear responsibility.

A protected mutation should generally follow this order:

```text
1. Authenticate user
2. Authorize action
3. Validate input
4. Load current state
5. Apply MARKETFOOT rules
6. Persist atomically
7. Return typed result
```

Do not trust values such as:

- price;
- tax;
- resulting Budget;
- calculated reward;
- transfer eligibility;
- player value;

when supplied by the browser.

The server calculates authoritative values.

---

# 16. Error Handling

Errors should be predictable and typed where useful.

Separate:

- validation errors;
- authentication errors;
- authorization errors;
- business-rule rejections;
- not-found errors;
- conflict/concurrency errors;
- unexpected internal errors.

Do not return raw database errors or stack traces to end users.

Log sufficient server-side detail for debugging without logging secrets.

For user-facing rule failures, return meaningful messages such as:

```text
Player is already frozen for this matchday.
Transfer quota has been reached.
Order exceeds available Mercado Budget.
You are not authorized to perform this action.
```

---

# 17. UI Implementation and Figma Rules

## 17.1 Figma/design references are authoritative where available

When a Figma design, screenshot, or supplied design image exists for a screen:

- use it as the primary visual reference;
- match layout;
- match spacing;
- match hierarchy;
- match typography;
- match component style;
- match colors;
- match border radius;
- match table/card treatment;
- match responsive intent.

Do not redesign an existing supplied screen based on personal preference.

## 17.2 Missing screens

When no direct design exists:

- infer the visual language from existing Figma/design screens;
- reuse the same design tokens;
- reuse the same component patterns;
- maintain the same density;
- maintain the same navigation patterns;
- maintain the same table/card/form behavior.

The goal is for newly designed screens to look like they belong to the same product.

## 17.3 Design system

As Figma screens are implemented, extract reusable tokens for:

- colors;
- typography;
- spacing;
- radius;
- shadows;
- container widths;
- buttons;
- inputs;
- tabs;
- tables;
- cards;
- badges;
- modals;
- side panels.

Avoid one-off styling for every page.

## 17.4 Reusable UI

Shared visual patterns should become reusable components.

Examples:

```text
Button
Input
Select
Modal
Drawer
DataTable
Tabs
Badge
Pagination
EmptyState
LoadingState
FormField
PageHeader
StatCard
```

Do not turn every tiny element into an abstraction. Reuse only where there is a real repeated pattern.

---

# 18. Responsive UI

All user-facing product screens must support desktop and mobile.

For every Figma-based implementation, verify:

- desktop layout;
- tablet/intermediate widths where relevant;
- mobile layout;
- tables;
- forms;
- modals/drawers;
- navigation;
- overflow;
- long usernames/player names;
- empty states;
- loading states.

Do not simply shrink desktop UI until it fits.

Where a desktop table cannot reasonably fit mobile:

- use responsive columns;
- horizontal scrolling where appropriate;
- card/list representation if consistent with the design language.

---

# 19. Accessibility

UI implementation should include:

- semantic HTML;
- correct labels;
- keyboard-accessible controls;
- visible focus states;
- reasonable color contrast;
- accessible dialogs;
- meaningful button names;
- alt text where images require it.

Do not sacrifice accessibility to visually mimic a design.

---

# 20. State Management

Prefer the simplest state model that works.

Use:

- server state from the server/database;
- URL state for filters/search/pagination when useful;
- local component state for local interaction.

Do not introduce a global state library unless the product actually needs shared client-side state that cannot be handled cleanly otherwise.

Authoritative financial/game state lives on the server/database, not only in browser state.

---

# 21. Caching and Freshness

Be careful with caching around rapidly changing game state.

Data such as:

- balances;
- Mercado orders;
- transfer availability;
- freeze state;
- predictions;
- settlement results;

must not remain stale in ways that permit invalid actions or misleading financial state.

Cache static or slow-moving data when useful.

After mutations, invalidate or refresh relevant data deliberately.

---

# 22. Date and Time Handling

Match kickoff and freeze logic are time-sensitive.

Requirements:

- use explicit timestamps;
- avoid depending on the browser's local clock as the authority;
- compare freeze/action eligibility on the server;
- use consistent timezone handling;
- store database timestamps in a normalized form;
- format dates/times for display separately.

The product rule defining a team's freeze as two hours before kickoff must be enforced from authoritative server time/state.

---

# 23. Testing Strategy

## 23.1 Rules engine tests

The rules engine should receive the strongest unit-test coverage because it contains core game behavior.

Test:

- valid cases;
- invalid cases;
- boundaries;
- provisional-rule configurations;
- historical cases;
- calculation examples from the product PRD.

## 23.2 Integration tests

Integration tests should cover flows involving:

- database state;
- authorization;
- transfers;
- Mercado;
- predictions;
- settlement;
- recalculation;
- admin actions.

## 23.3 UI tests

For important user journeys, verify:

- onboarding;
- squad creation;
- transfer submission;
- Mercado order submission;
- prediction submission;
- admin data entry;
- responsive behavior.

Use the testing stack already established in the repository where possible.

## 23.4 Regression rule

Every bug caused by business logic should receive a regression test before or alongside the fix whenever practical.

---

# 24. Code Quality

## 24.1 TypeScript

Avoid unnecessary `any`.

Prefer:

- explicit domain types;
- validated external input;
- discriminated unions for states where useful;
- typed service outputs.

## 24.2 Naming

Use names that match the product terminology.

Examples:

```text
Mercado
BlockedAccount
Matchday
Squad
PlayerValue
PerformanceIndex
```

Do not introduce multiple names for the same concept without a reason.

## 24.3 Functions

Functions should have focused responsibilities.

If a function:

- validates;
- queries;
- calculates;
- mutates;
- formats;
- sends notifications;

all at once, it probably needs separation.

## 24.4 Comments

Comments should explain **why**, not restate obvious code.

Use comments for:

- unusual business behavior;
- provisional rules;
- non-obvious consistency decisions;
- links/references to product requirements.

Do not fill files with redundant comments.

---

# 25. Dependency Policy

Before adding a package:

1. check whether the repository already solves the problem;
2. check whether Next.js/platform APIs solve it;
3. check whether the dependency is maintained;
4. check bundle/runtime impact;
5. add it only when it clearly improves the implementation.

Avoid adding a library for a trivial helper.

---

# 26. Environment Variables and Secrets

Secrets belong in environment configuration and must never be committed.

Examples:

- Supabase keys;
- service-role key;
- OAuth secrets;
- SMTP credentials.

Browser-exposed variables must contain only values safe for public exposure.

Never log secrets.

---

# 27. Admin Security

Admin functionality is high privilege.

Every admin mutation must verify administrator authorization on the server.

Sensitive admin operations include:

- player creation/edit/delete;
- matchday creation;
- match data entry;
- phase control;
- historical correction;
- recalculation;
- account deletion;
- account reset;
- sanctions.

Where useful, record an audit trail containing:

- actor;
- action;
- affected entity;
- timestamp;
- relevant before/after identifiers.

Do not expose admin capability based only on hiding UI controls.

---

# 28. Logging and Observability

Server-side logs should make important failures diagnosable.

Useful events include:

- settlement failure;
- Mercado execution failure;
- recalculation failure;
- authorization rejection;
- unexpected database conflict.

Avoid logging:

- passwords;
- secrets;
- tokens;
- unnecessary personal data.

For financial/game mutations, logs should be useful enough to reconstruct what operation failed without exposing sensitive credentials.

---

# 29. Performance

Avoid premature optimization, but prevent obvious scaling problems.

Watch for:

- N+1 database queries;
- loading entire large datasets unnecessarily;
- unindexed filtering/sorting;
- giant client bundles;
- excessive Client Components;
- unnecessary repeated calculations;
- recalculating global rankings on every render.

Use pagination for large tables where appropriate.

Add database indexes according to actual query patterns.

---

# 30. Database Query Design

Queries should:

- select only needed columns;
- filter at the database where practical;
- paginate large lists;
- use deterministic ordering;
- avoid N+1 patterns;
- use indexes for high-frequency filters and joins.

Complex reporting/ranking queries may use:

- SQL views;
- materialized views where justified;
- PostgreSQL functions;
- optimized aggregate queries.

Do not move expensive database aggregation to the browser.

---

# 31. Rules Versioning and Future Client Changes

Several product rules are still pending final client values.

The architecture must make those changes localized.

Good:

```text
one rule/config changes
→ all consumers use new behavior
```

Bad:

```text
update frontend component
update admin route
update API
update background job
update SQL
update tests
because each contains its own copy of the rule
```

When a product rule changes:

1. update the product PRD;
2. update the rules module/config;
3. update affected tests;
4. update this technical document only if architecture/implementation guidance changes.

---

# 32. Figma-to-Code Agent Procedure

When an agent is asked to implement a screen from Figma or supplied screenshots:

1. inspect all supplied design images for that flow;
2. identify reusable existing components;
3. identify typography, spacing, color, radius, and layout patterns;
4. map product requirements to visible UI;
5. write the implementation plan;
6. build the page using existing design primitives where possible;
7. create missing reusable primitives only when justified;
8. implement responsive behavior;
9. compare the result with the supplied design;
10. fix visual inconsistencies before calling the task complete.

When a screen has no direct Figma design:

1. inspect neighboring/product-related screens;
2. derive the established design language;
3. design the missing screen using those same patterns;
4. do not introduce a visually unrelated style.

---

# 33. Required Implementation Plan Gate

Agents should treat implementation planning as a gate.

Unless the change is an extremely trivial edit such as correcting a typo, the workflow is:

```text
REQUEST
  ↓
READ PRODUCT REQUIREMENT
  ↓
INSPECT EXISTING CODE
  ↓
INSPECT FIGMA / DESIGN
  ↓
CREATE IMPLEMENTATION PLAN
  ↓
REVIEW RISKS / SECURITY / DATA IMPACT
  ↓
IMPLEMENT
  ↓
TEST
  ↓
VERIFY UI + RULES
  ↓
SUMMARIZE
```

Starting implementation before understanding the current code and relevant requirement is considered an incorrect workflow.

---

# 34. Definition of Done

A feature is not done merely because the UI works.

A feature is done when all applicable items below are satisfied:

- product behavior matches the functional PRD;
- implementation follows the approved plan;
- business logic uses the central rules module;
- server authorization is enforced;
- input is validated;
- database changes are migrated;
- financial/game mutations are consistent and atomic where needed;
- relevant tests pass;
- TypeScript passes;
- linting passes;
- desktop UI is verified;
- mobile UI is verified;
- Figma is matched where available;
- missing-design UI follows the same visual system;
- no pending client requirement was guessed;
- no secrets are exposed;
- no unrelated regressions are introduced.

---

# 35. Quick Agent Checklist

Before coding:

- [ ] Read the relevant functional PRD section.
- [ ] Inspect existing implementation.
- [ ] Inspect Figma/screenshots if available.
- [ ] Check whether the requirement is confirmed or pending.
- [ ] Write the implementation plan.
- [ ] Identify rules impact.
- [ ] Identify database impact.
- [ ] Identify security impact.

While coding:

- [ ] Keep business rules in `src/rules`.
- [ ] Keep rules behind the public rules interface.
- [ ] Validate server-side.
- [ ] Authorize server-side.
- [ ] Use exact financial arithmetic.
- [ ] Avoid duplicated logic.
- [ ] Preserve existing clean conventions.
- [ ] Avoid unrelated refactors.
- [ ] Match Figma.

Before finishing:

- [ ] Run type checks.
- [ ] Run lint.
- [ ] Run relevant tests.
- [ ] Verify database behavior.
- [ ] Verify authorization.
- [ ] Verify responsive UI.
- [ ] Verify no business rule is duplicated outside the rules module.
- [ ] Report unresolved dependencies.
- [ ] Summarize changed files and behavior.

---

# 36. Final Instruction for Coding Agents

MARKETFOOT should be built as a clean, secure, maintainable system.

The most important architectural rule is:

> **The product PRD defines what MARKETFOOT does. The rules module is the single implementation authority for game rules. The rest of the application consumes those rules instead of reimplementing them.**

The most important workflow rule is:

> **Understand → inspect → plan → implement → test → verify.**

The most important UI rule is:

> **Use supplied Figma/design references where they exist. Where a design is missing, extend the same visual language rather than inventing a new one.**

The most important security rule is:

> **The browser is never the authority for permissions, balances, eligibility, or game calculations.**
