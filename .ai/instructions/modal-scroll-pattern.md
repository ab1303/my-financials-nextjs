# Modal Scroll Pattern: Fixed Header/Footer with Scrollable Body

## Problem
Modal forms with expandable sections crop footer when content exceeds viewport height. Users cannot scroll to see all fields, and footer gets pushed off-screen.

## Root Causes Identified
1. **Form element breaks flex flow** - `<form>` doesn't inherit flex properties, blocking the scroll layout chain
2. **DialogContent `h-fit` grows with content** - Shadcn's default `h-fit` class makes the entire modal grow instead of constraining height
3. **Missing `min-h-0` on scrollable child** - Flex won't let children shrink below content size without explicit `min-h-0`
4. **Complex calc() expressions create edge cases** - `calc(95vh - 200px)` can show scrollbar even when not needed

## Solution: The Proper Flex Scroll Chain

### Modal.tsx (Container)
```tsx
<DialogContent 
  style={{ maxHeight: '95vh' }}  // Override h-fit with inline style
  className='flex flex-col overflow-hidden max-w-6xl md:max-w-4xl sm:max-w-3xl xs:max-w-sm !p-0 !gap-0'
>
  {children}
</DialogContent>
```

**Why inline style?** Shadcn's `h-fit` is a utility class. Inline `style` has higher specificity and overrides it reliably without needing `!important`.

**Why `flex flex-col overflow-hidden`?** 
- `flex flex-col` creates a column layout where children can use flex sizing
- `overflow-hidden` clips content and prevents overflow spilling out
- Combined with `maxHeight`, this constrains the entire modal

### Modal.Body (Scroll Container)
```tsx
<div className='flex-1 min-h-0 overflow-y-auto'>
  <div className={cn('px-6', variantClasses[variant], className)}>
    {children}
  </div>
</div>
```

**Why `flex-1 min-h-0`?**
- `flex-1` makes it expand to fill available space (after Header/Footer take their shrink-0 space)
- `min-h-0` is **critical** - it tells flex to allow this child to shrink below content height
- Without `min-h-0`, flex defaults to `min-height: auto` and won't let the child shrink
- This allows the scrollbar to appear when content overflows

### Form Wrapper (Critical Step!)
When a `<form>` wraps the Modal.Body, it must participate in flex:

```tsx
<form onSubmit={handleSubmit(onSubmit)} className='flex flex-col flex-1 min-h-0'>
  <Modal.Body variant='spacious'>
    {/* Content */}
  </Modal.Body>
</form>
```

**Why?** The form is a direct child of Modal.DialogContent (a flex container). If form doesn't have flex properties, it doesn't expand to fill space, and Modal.Body can't scroll properly because the chain is broken.

### Header/Footer (Fixed Sides)
```tsx
<DialogTitle className={cn(
  'shrink-0 pt-4 sm:pt-3 pb-4 sm:pb-3 px-6 border-b border-border ...',
  className,
)} />

<div className={cn(
  'shrink-0 pt-4 sm:pt-3 pb-4 sm:pb-3 px-6 border-t border-border ...',
  className,
)} />
```

**Why `shrink-0`?** Flex containers default to shrinking children. `shrink-0` tells flex: "Don't shrink this, keep it at its natural height." Combined with Modal having `overflow-hidden`, this keeps header/footer fixed while Body scrolls.

## The Complete Flex Chain

For scroll to work, every ancestor from scrollable child to constrained parent must participate:

```
DialogContent (height: 95vh, overflow: hidden, flex, flex-col)
  ├─ Header (shrink-0)
  ├─ Form (flex, flex-col, flex-1, min-h-0)  ← CRITICAL: form must be flex
  │   └─ Modal.Body (flex-1, min-h-0, overflow-y-auto)
  │       └─ Content container (padding)
  └─ Footer (shrink-0)
```

If any link in this chain is missing flex properties, scroll breaks.

## Anti-Patterns to Avoid

❌ **Using `h-fit` on scroll containers** - Grows with content  
❌ **Omitting `min-h-0` on scrollable child** - Prevents shrinking below content  
❌ **Complex `calc()` expressions** - Creates edge cases and false scrollbars  
❌ **Forgetting flex properties on wrapper elements** - Breaks the flex chain  
❌ **Using padding on scroll container directly** - Can interfere with flex calculations (put padding on inner div)

## Debugging Strategy

When modal scroll isn't working:

1. **Use browser DevTools** - Inspect element, check computed styles for `flex`, `flex-1`, `min-h-0`
2. **Check DialogContent** - Verify it has `maxHeight` set (not just `h-fit`)
3. **Trace the flex chain** - Each ancestor should have flex properties
4. **Look for padding on scroll containers** - Move padding to inner div
5. **Verify wrapper elements** - Forms, divs wrapping scrollable content need flex properties
6. **Use Playwright MCP** - Take screenshots before/after expanding content to verify scroll appears

## When to Use This Pattern

✅ Modal forms with dynamic/expandable content  
✅ Dialog panels with lots of fields  
✅ Any modal where content might exceed viewport height  
✅ Modals with collapsible sections (Disclosure)

## Files Using This Pattern

- `src/components/ui/Modal.tsx` - Core implementation
- `src/app/(authorized)/assets/stocks/HoldingFormModal.tsx` - Example usage with form wrapper

## Related Instructions

- `.ai/instructions/form-patterns.md` - Form structuring with Server Actions
- `.github/instructions/accessibility-and-semantics.instructions.md` - Modal a11y

## Key Takeaway

> **The flex scroll pattern requires every ancestor from the scrollable element to the height-constrained root to explicitly participate in flex layout. Missing even one `flex` or `flex-1` or `min-h-0` breaks the chain.**
