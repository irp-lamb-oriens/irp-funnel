# Component Modularization Registry

This file tracks all modularized UI components, their purpose, and their import paths for use and refactoring.

---

## Buttons

- **PrimaryButton**
  - Path: `src/components/ui/PrimaryButton.svelte`
  - Usage: Main CTAs, e.g., "Book a consultation"
- **SecondaryButton**
  - Path: `src/components/ui/SecondaryButton.svelte`
  - Usage: Outlined/secondary actions

## Card

- **InfoCard**
  - Path: `src/components/ui/InfoCard.svelte`
  - Usage: Blog/news/resource/info cards

## Section Header

- **SectionHeader**
  - Path: `src/components/ui/SectionHeader.svelte`
  - Usage: Section titles with optional subtitle/underline

## Divider

- **Divider**
  - Path: `src/components/ui/Divider.svelte`
  - Usage: Visual separation between sections

## Social Icons

- **SocialIcons**
  - Path: `src/components/ui/SocialIcons.svelte`
  - Usage: Footer, social links

## Grid Layout

- **GridRow**
  - Path: `src/components/ui/GridRow.svelte`
  - Usage: Consistent row layout
- **GridCol**
  - Path: `src/components/ui/GridCol.svelte`
  - Usage: Consistent column layout

---

## How to Use

- Import the component from the path above in any Svelte page or component.
- If you create a new modular component, add it to this registry with its path and usage notes.
- When refactoring, always check this registry to avoid duplicating UI logic.

---

## Evo — Evolutionary UI Sales Attribution

Evo (`src/lib/evo/`) is a non-agnostic component registry + telemetry layer
that logs exposures and interactions per `(componentKey, versionKey, commitHash, visitorId)`
and joins them against paid consultations on the dashboard.

**Evo-instrumented components (variants in `src/lib/evo/config.ts`):**

- **HeroForm** — 3 variants: `v1-baseline` (control), `v2-warm-copy`, `v3-urgent-copy`. Logs exposure on CTA mount, `cta_click` on Get Started, `email_submit` on email capture. Calls `identify(email)` on submit to link the anonymous visitor to the email.

**To instrument a new component, in order:**

1. Add an entry to `EVO_COMPONENTS` in `src/lib/evo/config.ts` and mirror it in `irp-funnel-server/API/evo/registry.ts`.
2. In the component's script: `const variant = useVariant('ComponentKey');`
3. In `onMount`: `trackExposure('ComponentKey', variant);`
4. On meaningful user actions: `trackInteraction('ComponentKey', variant, 'subtype');`
5. On any step that produces an email, call `identify(email)` once.

Dashboard → `Evo` tab: smart explorer, filters bar, timeline graph (clickable
nodes), leaderboard, and per-node drill-down drawer.

---

## Dashboard primitives (`src/routes/dashboard/styles/`)

One visual system for every dashboard tab, panel and modal. Spec: IRP project doc `claude/dashboard-ui-cohesion-design.md`.

- **Tokens** — `_tokens.scss`. Colour ramps `--irp-{slate|teal|red|amber|green|blue|violet}-{50…900}`, roles (`--irp-text`, `--irp-text-dim`, `--irp-line`, `--irp-surface-2`, `--irp-accent-ink`, `--irp-danger-bg/-line/-ink` …), type scale `--irp-fs-2xs…2xl`, radii `--irp-r-2xs…2xl|full`, shadows, focus, z-index. Pages that render dashboard components outside `/dashboard` import `styles/irp-tokens.scss`.
- **Tabs** — `.irp-tabs` (section tabs), `.irp-tabs--segment` (in-section switches), `.irp-tabs--line` (tabs inside a card/panel), `.irp-tabs--block`, `.irp-tabs__count`. Active state is read from `.active`, `.is-active`, `--active`, or aria-selected/pressed/current.
- **`use:tabs`** — `utils/a11yTabs.ts`. Add to every tab row: roles, roving tabindex, Arrow/Home/End. `{ mode: 'toggle' }` for aria-pressed groups; `data-tab-skip` on a non-tab button inside the row.
- **Buttons** — `.irp-btn` + `--primary | --danger | --ghost | --sm | --icon`.
- **Chips** — `.irp-chip` + `--success | --warning | --danger | --info | --neutral`.
- **Surfaces / text** — `.irp-card`, `.irp-input`, `.irp-overline`, `.irp-empty`, `.irp-sr-only`.
- **Mixins** — `_mixins.scss` (`irp-tabs-pills/segment/line`, `irp-btn*`, `irp-chip($tone)`, `irp-input`, `irp-card`, `irp-focus-ring`). CSS-var only, so a component can `@import 'routes/dashboard/styles/mixins';` inside `<style lang="scss">`.
- **Guard** — `src/routes/dashboard/styles.guard.test.ts` (in `npm test`) fails on raw hex, literal font sizes ≤ 21px, literal radii 3–30px, or a removed focus outline. Fix most hits with `npm run tokens:dashboard`.

## To-Do

- [ ] Refactor all pages to use these modular components where applicable.
- [ ] Update this registry as new modules are created or existing ones are improved.
- [ ] Instrument Chatbot, HeroSection, MovingProcessSection and LeadCaptureModal with Evo.
