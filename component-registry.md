# Component Modularization Registry

This file tracks all modularized UI components, their purpose, and their import paths for use and refactoring.

---

## Buttons

- **PrimaryButton**
  - Path: `src/components/ui/PrimaryButton.svelte`
  - Usage: Main CTAs, e.g., "Schedule Consultation"
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

## To-Do

- [ ] Refactor all pages to use these modular components where applicable.
- [ ] Update this registry as new modules are created or existing ones are improved.
