# Lesson: React Select Positioning in Complex Containers

## Problem
A regression in `BeneficiaryFormFields.tsx` caused the `Beneficiary Type` dropdown to stop opening, and subsequent attempts to fix the positioning (forcing `menuPosition='fixed'`) resulted in the dropdown rendering aligned to the side instead of directly below the select field.

## Root Cause
1.  **Improper Portal Usage**: The introduction of `usePortal` (intended to resolve layout clipping) conflicted with the internal positioning context of the component wrapper (`AppSelect`), preventing the menu from rendering correctly within the drawer.
2.  **Redundant/Conflicting Positioning**: The `AppSelect` wrapper already defines `menuPosition='fixed'` by default to handle drawer layout constraints. Explicitly overriding this, or incorrectly toggling `usePortal`, caused the underlying `react-select` library to revert to its default (non-fixed) positioning, which fails in nested, container-constrained components (like drawers).

## Key Takeaways
- **Trust the Wrapper**: When using a wrapper component like `AppSelect`, rely on its internally defined positioning logic (`menuPosition`, `usePortal`) before manually overriding props.
- **Verify Positioning Context**: If a dropdown needs to be escaped from its container (via `usePortal`), ensure the wrapper component specifically supports and tests this interaction.
- **Avoid Over-configuration**: Avoid explicitly setting positioning props that the wrapper component already defines unless strictly necessary and fully tested against the component's surrounding layout.
