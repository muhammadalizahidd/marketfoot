# UX Contract

## Product context

- Audience: Ligue 1 fantasy-football participants and administrators.
- Primary jobs: manage a squad, inspect football data, and administer competition data in later features.
- Target market: French Championship/Ligue 1 only (PRD §1.2).
- Active locale: French-first; localization architecture has not yet been selected.
- Timezone/calendar policy: unresolved; server-authoritative match timing will be defined with the concrete feature.
- Accessibility target: WCAG 2.2 AA.

## Business-context sources

| Domain / scope | Authoritative source | Source type | Reviewed date |
|---|---|---|---|
| Product behavior and rules | `docs/MARKETFOOT_PRODUCT_FUNCTIONAL_PRD_v1.2.md` | Product requirements | 2026-09-19 |
| Permissions, architecture, data access | `docs/MARKETFOOT_TECHNICAL_IMPLEMENTATION_SPEC_v1.0.md` | Technical specification | 2026-09-19 |

## Visual contract

- Project `DESIGN.md`: source of visual intent.
- Token ownership model: existing runtime CSS is canonical.
- Runtime token source: `src/app/globals.css`.
- Mapping: `DESIGN.md` frontmatter documents the CSS custom properties.
- Token drift gate: `npx -p @google/design.md designmd lint DESIGN.md` plus static audit.

## Canonical UI Map

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
|---|---|---|---|---|
| Scrollbar | `src/app/globals.css` | `DESIGN.md` | geometry exceptions only | static audit + browser |
| Form / server validation | Feature-local server actions with Zod schemas | Technical specification + feature action | create, mutation, irreversible settlement confirmation | typecheck + browser flow |
| Select / date inputs | Native semantic controls | Feature forms | platform popup accepted; server validation remains authoritative | keyboard + narrow viewport |
| Settlement execution | `src/services/settlements/settlement-service.ts` and database RPCs | Rules modules + immutable database snapshots | review, execute, audited reversal | rules tests + admin review flow |
| Financial ledger | `financial_ledger` database table | migration 007 | settlement and reversal postings only | idempotency-key constraint + integration flow |
| Player catalogue | `src/app/(app)/joueurs/page.tsx` + `catalogue-repository.ts` | player, club, value-history, ownership and match-stat records | general / performance view, search, club and position filters | typecheck + desktop/narrow browser |
| Rankings | `src/app/(app)/classements/page.tsx` + `ranking-repository.ts` | latest immutable `ranking_snapshots` settlement cohort | general wealth / gains ranking | typecheck + desktop/narrow browser |

Tables remain native read-oriented tables. A shared toast, modal, authored select/listbox, and generic CRUD primitive have not yet been introduced; feature-local feedback remains inline until a shared owner is added.

## Foundation behavior

- Route titles use App Router metadata.
- Route shells use semantic `main` landmarks.
- Protected operations use server-side authentication and authorization before mutation.
- Server actions validate payloads with Zod and preserve domain calculations behind the rules/service boundary.
- Settlement execution requires an explicit French confirmation checkbox; reversal requires an audited written reason.

## Verification

- Static commands: `npm run lint`, `npm run typecheck`, `npm run build`.
- Browser matrix: root, auth, application, and admin placeholder routes at desktop and narrow viewport.
