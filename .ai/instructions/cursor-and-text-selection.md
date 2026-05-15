# Cursor & Text Selection Rules

## Problem

Browser defaults give `cursor: text` to `<th>`, `<label>`, and display spans. This causes
an I-beam cursor to appear on table headers and non-interactive labels, misleading users
into thinking text is editable.

## Global CSS (applied automatically — no per-component fix needed)

`src/styles/globals.css` already handles two cases globally:

| Selector | Rule |
|---|---|
| `label` | `cursor: default; user-select: none` |
| `label:has(input/select/textarea)` | `cursor: pointer; user-select: auto` (restored) |
| `[data-tile]` | `cursor: default; user-select: none` (display tiles) |

You **do not** need to add `cursor-default` or `select-none` to `<label>` elements manually.

## Per-component rules (still required)

### Table headers (`<th>`)

Use the shared `THeadTH` component (`src/components/table/components/THead/THeadTH.tsx`) —
it already includes `select-none cursor-default`. Do not create bare `<th>` elements.

```tsx
// ✅
<th className="px-6 py-3 uppercase select-none cursor-default">Date Paid</th>

// ❌ — I-beam cursor appears
<th className="px-6 py-3 uppercase">Date Paid</th>
```

### Labels

```tsx
// ✅ Works automatically — globals.css sets cursor: default on all labels
//    and cursor: pointer on labels wrapping an input
<label htmlFor="email" className="block text-sm font-medium">Email</label>
<label className="flex items-center gap-2"><input type="checkbox" /> Accept terms</label>

// ✅ Display-only label — no classes needed, global CSS handles it
<p className="text-sm font-medium text-gray-500">Section heading</p>
```

