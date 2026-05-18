# Modal + Select Dropdown Interactions

When modals contain scrollable content with selectable dropdowns, CSS transforms and event capture can silently break interactivity.

## When to Apply

- Modal body is scrollable (`overflow-y-auto`) and contains select dropdowns
- Select dropdown appears but options cannot be selected
- Modal content exceeds viewport and needs scrolling
- Dropdown appears clipped inside modal or positioned incorrectly
- Building modals with Radix Dialog + react-select + scroll support

## Common Failures

| Problem | Symptom | Root Cause |
|---|---|---|
| **Dropdown clipped inside modal** | Menu appears but is cut off at modal edge | Parent has `overflow-y: auto` without portal |
| **Select appears in wrong position** | Menu floats but coordinates are off | CSS `transform` on dialog centering |
| **Options unselectable via portal** | Menu visible but clicks don't register | Radix DismissableLayer captures events from portal DOM |
| **Modal won't scroll** | Content grows off-screen | Flex chain broken or `max-h` without overflow |

## Root Causes

### 1. CSS Transforms Break `position:fixed` Positioning

**The Problem:**
```css
/* ❌ WRONG - creates a containing block for position:fixed children */
.dialog {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);  /* This is the culprit */
}

.dialog-content {
  position: fixed;  /* Now positions relative to .dialog, NOT viewport */
}
```

When a parent has **any** `transform` (including `translate()`, `rotate()`, etc.):
- `position: fixed` children position **relative to that parent**, not the viewport
- They are clipped by ancestor `overflow-y: auto` containers
- They render inside the parent's stacking context

**The Solution:**
```css
/* ✅ CORRECT - no transform, natural viewport positioning */
.dialog {
  position: fixed;
  inset: 0;           /* top, right, bottom, left = 0 */
  display: grid;      /* or flex */
  place-items: center; /* or m-auto with flex */
  height: fit-content;
}

.dialog-content {
  position: fixed;  /* Now positions relative to viewport naturally */
}
```

**In Tailwind (what we use):**
```tsx
<div className="fixed inset-0 m-auto h-fit grid place-items-center">
  {/* Children with position:fixed render correctly */}
</div>
```

### 2. Radix DismissableLayer + Portaled Menus

**The Problem:**
```tsx
// ❌ Menu is portaled to document.body (outside Dialog DOM)
<Select menuPortalTarget={document.body} />
```

Radix Dialog uses a **capture-phase listener** on `document`:
```javascript
document.addEventListener('pointerdown', (e) => {
  if (!dialogIsAncestorOf(e.target)) {
    e.preventDefault(); // Kill the event
  }
}, { capture: true }); // ← Capture phase = first to run
```

**Flow:**
1. User clicks option in portaled menu (outside Dialog DOM)
2. Event bubbles up to `document`
3. Radix's **capture listener fires FIRST** (capture phase runs before bubbling)
4. Radix sees click is outside the dialog → `preventDefault()`
5. React-select's handler never fires because event is dead

**The Solution:**
Don't portal! Fix the CSS transform instead. Then:
```tsx
// ✅ Menu stays in Radix Dialog DOM tree, no capture interception
<Select menuPosition="fixed" /* don't portal */ />
```

### 3. Broken Flex Chain Prevents Scrolling

**The Problem:**
```tsx
// ❌ Form doesn't fill available space
<DialogContent className="flex flex-col max-h-[90vh]">
  <DialogHeader>Title</DialogHeader>
  <form>
    {/* Growing content, but form isn't flex=1 */}
  </form>
  <DialogFooter>Action buttons</DialogFooter>
</DialogContent>
```

**The Solution:**
```tsx
// ✅ Complete the flex chain
<DialogContent className="flex flex-col max-h-[90vh]">
  <DialogHeader>Title</DialogHeader>
  <form className="flex flex-col flex-1 min-h-0 overflow-y-auto">
    {/* Now form expands to fill space and scrolls */}
  </form>
  <DialogFooter>Action buttons</DialogFooter>
</DialogContent>
```

**Why `min-h-0`?** Flex containers have `min-height: auto` by default, which prevents overflow. Set `min-h-0` to allow children to shrink below content size, enabling scroll.

## Diagnostic Checklist

Before attempting portals or complex fixes:

- [ ] **Dialog centering:** Is the dialog using `transform: translate()`? Change to `inset-0 m-auto`.
- [ ] **Select component:** Are you using `menuPortalTarget={document.body}`? Remove it first.
- [ ] **Scroll not working?** Check flex chain: parent has `flex flex-col max-h-[X]`, body has `flex-1 overflow-y-auto min-h-0`.
- [ ] **Select options unclickable?** Check browser DevTools → event listener. Radix's capture listener should not be intercepting.
- [ ] **Menu position wrong?** Verify parent CSS has NO transform. Use DevTools Computed styles to check.

## Implementation Pattern

```tsx
// dialog.tsx - Base dialog component
export const DialogContent = React.forwardRef<
  React.ElementRef<typeof Dialog.Content>,
  React.ComponentPropsWithoutRef<typeof Dialog.Content>
>(({ className, ...props }, ref) => (
  <Dialog.Portal>
    <DialogOverlay />
    <Dialog.Content
      ref={ref}
      className={cn(
        // ✅ NO TRANSFORM - use inset-0 + m-auto instead
        "fixed inset-0 m-auto h-fit",
        "grid place-items-center z-50",
        className,
      )}
      {...props}
    />
  </Dialog.Portal>
));
```

```tsx
// Modal.tsx - Wrapper for scrollable content
export function Modal({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DialogContent className="flex flex-col max-h-[90vh]">
      {children}
    </DialogContent>
  );
}

export namespace Modal {
  export function Header({ children }: { children: React.ReactNode }) {
    return <div className="flex-shrink-0 border-b p-4">{children}</div>;
  }

  export function Body({ children }: { children: React.ReactNode }) {
    return (
      <div className="flex-1 overflow-y-auto min-h-0 p-4">
        {children}
      </div>
    );
  }

  export function Footer({ children }: { children: React.ReactNode }) {
    return <div className="flex-shrink-0 border-t p-4">{children}</div>;
  }
}
```

```tsx
// AppSelect.tsx - Select with fixed positioning
export function AppSelect(props: SelectProps) {
  return (
    <Select
      {...props}
      menuPosition="fixed"  // ✅ Use fixed, not portaled
      // No menuPortalTarget
    />
  );
}
```

## Why This Wasn't Obvious

1. **Transforms are silent** — CSS DevTools don't visually highlight that a transform breaks `position:fixed`. You have to know the spec.
2. **Portal pattern is standard** — Most codebases use portals for dropdowns. It's the "right" pattern in isolation, but breaks with Radix's aggressive event capture.
3. **Layered failures** — Each attempted fix (portal, z-index, context) revealed new issues, masking the real root cause (the transform).
4. **Solution is counterintuitive** — "Remove the transform to fix overflow" seems backwards. Most instincts lead to "add more CSS" or "portal harder."

## References

- **MDN: Containing Block** - https://developer.mozilla.org/en-US/docs/Web/CSS/Containing_block
- **Radix DismissableLayer** - https://www.radix-ui.com/primitives/docs/components/dismissable-layer
- **React-Select Portal** - https://react-select.com/advanced#fixed-options
- **Stacking Context** - https://developer.mozilla.org/en-US/docs/Web/CSS/CSS_Positioning/Understanding_z-index/The_stacking_context

## Quick Fix Recipe

If you encounter "select works outside modal but not inside":

1. **Check the dialog CSS:**
   ```bash
   # In DevTools, inspect dialog element
   # Look for: transform, translate, rotate, etc.
   # Replace with: inset-0 + m-auto (no transform)
   ```

2. **Remove portal from select:**
   ```tsx
   // Remove this:
   // menuPortalTarget={document.body}
   // Add this:
   menuPosition="fixed"
   ```

3. **Fix scroll chain:**
   ```tsx
   <form className="flex flex-col flex-1 min-h-0 overflow-y-auto">
   ```

4. **Test:** Click options in dropdown — they should now be selectable.

## Testing

- [ ] Modal scrolls when content exceeds max-height
- [ ] Modal header/footer stay fixed while body scrolls
- [ ] Select dropdown opens and closes normally
- [ ] Dropdown options are clickable and selectable
- [ ] Menu doesn't get clipped at modal edges
- [ ] No console warnings from Radix or react-select
- [ ] Works in both light and dark mode
- [ ] Keyboard navigation (arrow keys, Enter) still works
