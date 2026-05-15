# Cursor & Text Selection Rules

## Problem

Browser default styling gives `cursor: text` to any element that contains selectable text,
including `<th>`, `<label>`, and `<span>` elements inside tables. This causes the I-beam
text cursor to appear on table headers and non-interactive labels, which looks wrong and
misleads users into thinking the text is editable.

## Global CSS (applied automatically — no per-component fix needed)

`src/styles/globals.css` handles labels globally:

| Selector | Rule |
|---|---|
| `label` | `cursor: default; user-select: none` |
| `label:has(input/select/textarea)` | `cursor: pointer; user-select: auto` (restored for wrapping labels) |

You **do not** need to add `cursor-default` or `select-none` to `<label>` elements manually.

```tsx
// ✅ No class needed — global CSS handles cursor: default
<label htmlFor="email" className="block text-sm font-medium">Email</label>

// ✅ Wrapping label with input — global CSS restores cursor: pointer
<label className="flex items-center gap-2">
  <input type="checkbox" /> Accept terms
</label>
```

## Per-component rules (still required)

### Table headers (`<th>`)

Always add `select-none cursor-default` to `<th>` elements. These are display-only — users
should not be able to select or "edit" header text.

```tsx
// ✅ Correct
<th className="px-6 py-3 text-xs font-semibold uppercase select-none cursor-default">
  Date Paid
</th>

// ❌ Wrong — browser shows I-beam cursor
<th className="px-6 py-3 text-xs font-semibold uppercase">
  Date Paid
</th>
```

The shared `THeadTH` component already includes `select-none cursor-default`. Use it for
all tables; do not create bare `<th>` elements.

### Summary

| Element | Action needed |
|---|---|
| `<th>` table header | Use `THeadTH` component (already has `select-none cursor-default`) |
| `<label htmlFor="...">` | Nothing — global CSS handles `cursor: default` automatically |
| `<label>` wrapping `<input>` | Nothing — global CSS restores `cursor: pointer` automatically |
| Display-only `<p>` / heading | `select-none cursor-default` if needed |

