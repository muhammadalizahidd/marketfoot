---
version: alpha
name: "MARKETFOOT"
description: "A French-first football management and virtual trading product with a focused, high-contrast matchday feel."
colors:
  canvas: "#05070B"
  surface: "#FFFFFF"
  ink: "#121720"
  muted: "#687182"
  primary: "#1266FF"
  primary-hover: "#0050D8"
  pitch: "#00A936"
  focus: "#8DB8FF"
typography:
  body:
    fontFamily: "Arial, Helvetica, sans-serif"
  data:
    fontFamily: "Arial, Helvetica, sans-serif"
rounded:
  control: "0.5rem"
  panel: "1rem"
spacing:
  page: "clamp(1.5rem, 5vw, 5rem)"
components:
  foundation-link: {}
  route-shell: {}
---

# MARKETFOOT Design System

## Overview

### Creative North Star

The supplied composition reference: a night-match canvas where electric-blue controls lead into a saturated green pitch, with compact white cards making data easy to scan.

### Product context and register

- **Audience and primary job:** Ligue 1 fans manage a virtual squad and assess football data.
- **Target market(s) and evidence:** French Championship/Ligue 1 only, per the product PRD.
- **Locale(s) and language policy:** French is the initial UI language; future copy follows the confirmed product terminology.
- **Usage scene:** Dense desktop management views must condense cleanly to mobile.
- **Register:** Product application, not a marketing site.
- **Memorable signature:** Pitch green is reserved for football-specific, positive contextual surfaces.
- **Restraint:** Forms, tables, admin tools, and error states stay quiet, legible, and semantic.
- **Anti-references:** Generic fintech dashboards and decorative football clichés; data clarity must win.
- **Token ownership/runtime mapping:** Existing runtime CSS is canonical (Model B). Frontmatter tokens map directly to `src/app/globals.css` variables; shared UI must consume those variables.

## Colors

`canvas` grounds the application; `primary` is the interactive blue; `pitch` is contextual rather than a generic success token. White `surface` cards sit above the dark canvas. Focus always uses the high-visibility `focus` treatment.

## Typography

The foundation uses the system Arial/Helvetica stack for predictable rendering. Future design implementation may introduce a typeface only when it is matched to approved visual references and mapped here first. Numeric values should remain easily scannable.

## Layout

Use responsive document flow, `--space-page` page insets, and grid/flex only where content needs it. Tables must own their overflow without constraining sibling forms or the page shell.

## Elevation & Depth

Use tonal contrast and a restrained border before shadow. White information cards may be elevated against the dark canvas; avoid ornamental floating panels.

## Shapes

Controls use `control`; information panels use `panel`. Avoid mixing arbitrary radii.

## Components

The shared shell contains active primary navigation and a budget/ranking rail. Catalogue and ranking views use dense white tables with locally contained horizontal overflow. Team management uses positional pitch rows and a separate bench. Competition pages share season/day controls; prediction choices expose pending, locked, error and saved states. Admin editing uses labeled native controls and explicit destructive confirmation. Runtime extensions live in `src/app/competition.css`, imported after the canonical global stylesheet.

### Responsive and verification contract

On narrow screens navigation wraps, pitch and bench stack, filters wrap and wide tables scroll inside their own container. The budget remains visible. Reference PNGs in MarketFoot are the visual authority; current pitch shirts are generic placeholders rather than supplied club assets. Authenticated desktop/mobile screenshot comparison is still required before claiming pixel-perfect parity.

## Do's and Don'ts

- **Do:** use blue to identify action and green to identify on-pitch context.
- **Do:** preserve semantic focus visibility and responsive document flow.
- **Don't:** use pitch green as the only indication of a positive or allowed state.
- **Don't:** invent product UI beyond the supplied references and confirmed requirements.
