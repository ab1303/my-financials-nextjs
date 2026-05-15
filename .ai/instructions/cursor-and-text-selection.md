# Cursor & Text Selection Rules

## Problem

Browser defaults give `cursor: text` to `<th>`, `<label>`, and display spans. This causes
an I-beam cursor to appear on table headers and non-interactive labels, misleading users
into thinking text is editable.

## Rules

| Element | Class to add | Reason |
|---|---|---|
| `<th>` table header | `select-none cursor-default` | Display-only; not editable |
| `<label htmlFor="...">` | `cursor-pointer` | Clicking focuses the linked input |
| Display-only label/heading | `select-none cursor-default` | Not interactive |
| Disabled input | `cursor-not-allowed` | Already on `disabled:` variant |

### Table headers

```tsx
// ✅
<th className="px-6 py-3 uppercase select-none cursor-default">Date Paid</th>

// ❌ — I-beam cursor appears
<th className="px-6 py-3 uppercase">Date Paid</th>
```

Use the shared `THeadTH` component (`src/components/table/components/THead/THeadTH.tsx`) —
it already includes `select-none cursor-default`. Do not create bare `<th>` elements.

### Labels

```tsx
// ✅ Interactive label — clicking focuses input
<label htmlFor="email" className="block text-sm font-medium cursor-pointer">Email</label>

// ✅ Display-only label — not linked to input
<p className="text-sm font-medium select-none cursor-default">Section heading</p>
```
