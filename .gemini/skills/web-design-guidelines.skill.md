---
name: web-design-guidelines
description:
  Essential guidelines for modern web design, focusing on accessibility,
  responsiveness, and user experience.
license: MIT
metadata:
  author: vercel
  version: '1.0.0'
---

# Web Design Guidelines

Principles for creating accessible, responsive, and user-friendly web interfaces.

## 1. Accessibility (A11y)

- **Semantic HTML**: Use appropriate elements (`<button>`, `<nav>`, `<main>`) to provide meaning to assistive technologies.
- **Alt Text**: Provide descriptive alt text for all informative images.
- **Contrast Ratio**: Ensure text has sufficient contrast against its background (WCAG AA standard).
- **Keyboard Navigation**: Ensure all interactive elements (links, buttons, forms) are reachable and usable via keyboard alone.
- **Focus States**: Never remove focus rings without providing a visible alternative.

---

## 2. Responsiveness (Mobile First)

- **Design for Smallest Screens First**: Start with a single-column layout and scale up for larger devices.
- **Flexible Layouts**: Use CSS Grid and Flexbox for layouts that adapt seamlessly.
- **Fluid Typography**: Use relative units (rem, em) instead of fixed pixels.
- **Touch Targets**: Ensure buttons and links are large enough to be easily tapped on mobile (minimum 44x44px).

---

## 3. User Experience (UX)

- **Consistency**: Maintain identical styling and behavior across the entire application.
- **Feedback**: Provide immediate visual feedback for all user actions (loading states, success indicators).
- **Performance**: Minimize layout shifts (CLS) by reserving space for images and dynamic content.
- **Visual Hierarchy**: Use size, color, and weight to guide the user's eye toward the primary action.
- **Typography**: Prioritize legibility. Use adequate line height (1.5x) and keep line lengths between 45-75 characters.
