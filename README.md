# MARKETFOOT

Fondation Next.js App Router + TypeScript pour le produit de gestion de football et trading virtuel dédié à la Ligue 1.

## Local development

1. Copy `.env.example` to `.env.local` and provide Supabase credentials.
2. Run `npm install`.
3. Run `npm run dev`.

Use `npm run lint`, `npm run typecheck`, and `npm run build` before merging.

## Architecture

- `src/app`: route groups and minimal shells.
- `src/rules`: the sole public interface for future game rules.
- `src/lib/supabase`: browser, server, and privileged server-only clients.
- `supabase/migrations`: future schema migrations; no schema has been designed yet.
- `docs`: authoritative product and technical specifications.

Product behavior is defined in [the PRD](docs/MARKETFOOT_PRODUCT_FUNCTIONAL_PRD_v1.2.md); engineering constraints are in [the technical specification](docs/MARKETFOOT_TECHNICAL_IMPLEMENTATION_SPEC_v1.0.md).
