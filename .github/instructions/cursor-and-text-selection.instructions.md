# Cursor & Text Selection Rules

## Problem

Browser default styling gives `cursor: text` to any element that contains selectable text,
including `<th>`, `<label>`, and `<span>` elements inside tables. This causes the I-beam
text cursor to appear on table headers and non-interactive labels, which looks wrong and
misleads users into thinking the text is editable.

## Rules

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

### Labels associated with inputs

`<label>` elements that are linked to an interactive input via `htmlFor` / `id` should have
`cursor-pointer` so clicking the label focuses the input (standard browser behaviour made
explicit):

```tsx
// ✅ Correct — clicking label focuses the input
<label htmlFor="email" className="block text-sm font-medium cursor-pointer">
  Email
</label>

// ❌ Wrong — cursor: text default, visually misleading
<label htmlFor="email" className="block text-sm font-medium">
  Email
</label>
```

### Display-only labels / headings

Labels or headings that are not linked to an input should have `select-none cursor-default`
to prevent the I-beam appearing:

```tsx
// ✅ Correct
<p className="text-sm font-medium text-gray-500 select-none cursor-default">
  Section heading
</p>
```

### Summary

| Element | Class to add |
|---|---|
| `<th>` table header | `select-none cursor-default` |
| `<label htmlFor="...">` | `cursor-pointer` |
| Display-only label/heading | `select-none cursor-default` |
| Disabled input | `cursor-not-allowed` (already on disabled styles) |
