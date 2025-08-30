# International Relocation Partner Style Bible

## 1. Color Palette
- **Primary Teal:** #1ccfc9 (logo, buttons, highlights)
- **Accent Blue:** var(--color-highlight-1) (CTA, links, hover)
- **Dark Gray:** #222 (footer, text)
- **Light Gray:** #f8f8f8 (backgrounds, section dividers)
- **White:** #fff (main backgrounds, cards)
- **Secondary Accent:** #b3d1ff (footer links, subtle highlights)

## 2. Typography
- **Font Family:** 'Montserrat', 'Arial', sans-serif (clean, modern, geometric)
- **Headings:** Bold, uppercase or capitalized, clear hierarchy (h1 > h2 > h3, etc.)
- **Body Text:** Regular weight, high contrast, 16-18px base size
- **Letter Spacing:** Slight for headings, normal for body

## 3. Layout & Spacing
- **Max Width:** 1440px centered, with generous side padding (2rem+)
- **Section Padding:** 2.5rem top/bottom, 2rem sides
- **Grid:** Flexbox for rows/columns, responsive stacking on mobile
- **Card/Box:** Rounded corners (4-8px), subtle box-shadow for elevation

## 4. Buttons
- **Primary CTA:** Teal or blue background, white text, bold, rounded, hover effect (darker shade or shadow)
- **Secondary:** White or light background, teal/blue border, colored text, hover with background fill
- **Button Padding:** 0.5rem 1.2rem, font-weight 600+

## 5. Navigation & Header
- **Logo left, menu center/right**
- **Sticky header with shadow**
- **Mobile menu:** Hamburger icon, slide-down or overlay, large tap targets

## 6. Footer
- **Dark background (#222), light text**
- **Three columns: navigation, policies, social**
- **Social icons:** Colored, circular or rounded, with label
- **Copyright:** Centered, small, accent color for links

## 7. Cards/Sections
- **Card:** White background, subtle shadow, rounded corners, padding
- **Section titles:** Large, bold, with accent underline or color
- **Dividers:** Thin, light gray or accent color

## 8. Forms & Inputs
- **Rounded, border, focus with accent color**
- **Labels above inputs, clear spacing**

## 9. Imagery
- **Images:** Rounded corners, box-shadow, responsive sizing
- **Icons:** SVG or PNG, consistent size, accent color

## 10. Responsive
- **Mobile:** Stack columns, increase padding, larger buttons/links
- **Tablet:** Adjust grid, font sizes, menu behavior

---

## Component Modularization Principles

- **Buttons:** All CTAs, secondary, and tertiary buttons as reusable components
- **Card:** For blog/news, resource, or info cards
- **SectionHeader:** For section titles with optional subtitle/underline
- **Divider:** For visual separation
- **SocialIcons:** For footer and anywhere social links are needed
- **GridRow/GridCol:** For layout consistency

---

## To-Do
- All pages must import their own SCSS file and style all tag elements.
- All repeated UI patterns must be modularized and tracked in the registry.
- All styles must follow this style bible for consistency.
