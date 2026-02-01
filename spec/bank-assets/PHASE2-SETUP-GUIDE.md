# Phase 2 Setup - Quick Start Guide

## 🚀 Quick Setup (3 Steps)

### Step 1: Create Directory

Open PowerShell in project root and run:

```powershell
New-Item -Path "src\app\(authorized)\cashflow\bank" -ItemType Directory -Force
```

Or create manually:

```
src/
  app/
    (authorized)/
      cashflow/
        bank/          ← Create this folder
```

### Step 2: Create Files

**File 1: page.tsx**

1. Create file: `src/app/(authorized)/cashflow/bank/page.tsx`
2. Copy content from: `spec/PHASE2-page-tsx.txt`
3. Remove the first 2 comment lines (FILE: and PHASE 2:)

**File 2: BankAssetsClient.tsx**

1. Create file: `src/app/(authorized)/cashflow/bank/BankAssetsClient.tsx`
2. Copy content from: `spec/PHASE2-BankAssetsClient-tsx.txt`
3. Remove the first 2 comment lines (FILE: and PHASE 2:)

### Step 3: Test

```bash
# Start dev server
pnpm run dev

# Navigate to:
http://localhost:3000/cashflow/bank
```

---

## ✅ Verification Checklist

After setup, verify:

### Visual Elements:

- [ ] Page title: "Bank Assets - Cash Tracking"
- [ ] Three buttons: FISCAL | ANNUAL | ZAKAT
- [ ] Year dropdown below calendar type
- [ ] Active button has teal background

### Functionality:

- [ ] Clicking FISCAL/ANNUAL/ZAKAT changes URL (`?type=...`)
- [ ] Selecting year updates URL (`?yearId=...`)
- [ ] Page fetches snapshot data
- [ ] Either shows grand total + banks OR "No snapshot" message

### If You Have Data:

- [ ] Grand total card displays (teal background)
- [ ] Bank names appear as accordion headers
- [ ] Clicking bank header expands/collapses
- [ ] Account table shows with balances
- [ ] Currency formatted as $X,XXX.XX
- [ ] "New Snapshot" button at bottom

### If No Data:

- [ ] Message: "No snapshot recorded for this period"
- [ ] "New Snapshot" button displayed
- [ ] Gray dashed border container

---

## 🐛 Troubleshooting

### Issue: "Cannot find module '@/components/card'"

**Solution**: Check that Card component exists at `src/components/card/Card.tsx`

### Issue: "Cannot find module './BankAssetsClient'"

**Solution**: Ensure BankAssetsClient.tsx is in the same directory as page.tsx

### Issue: "trpc.bankAsset is undefined"

**Solution**: Ensure Phase 1 migration was run and Prisma client generated

### Issue: Page shows "Loading..." forever

**Solution**:

1. Check database connection
2. Verify calendar years exist in database
3. Check browser console for errors

### Issue: TypeScript errors

**Solution**:

```bash
# Regenerate Prisma types
pnpm prisma generate

# Restart TypeScript server in VS Code
Ctrl+Shift+P → "TypeScript: Restart TS Server"
```

---

## 📸 Expected UI

### With Data:

```
┌─────────────────────────────────────┐
│ Bank Assets - Cash Tracking         │
├─────────────────────────────────────┤
│                                     │
│ Calendar Type                       │
│ [FISCAL] [ANNUAL] [ZAKAT]          │
│                                     │
│ Calendar Year                       │
│ [Fiscal 2025-2026         ▼]       │
│                                     │
│ Snapshot as of: 01 Feb 2026         │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ TOTAL CASH POSITION             │ │
│ │ $125,500.00                     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ▼ ANZ Bank       $50,000.00     │ │
│ ├─────────────────────────────────┤ │
│ │ Savings          $30,000.00     │ │
│ │ Term Deposit     $20,000.00     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ▶ CBA            $75,500.00     │ │
│ └─────────────────────────────────┘ │
│                                     │
│          [+ New Snapshot]           │
└─────────────────────────────────────┘
```

### Without Data:

```
┌─────────────────────────────────────┐
│ Bank Assets - Cash Tracking         │
├─────────────────────────────────────┤
│                                     │
│ Calendar Type                       │
│ [FISCAL] [ANNUAL] [ZAKAT]          │
│                                     │
│ Calendar Year                       │
│ [Fiscal 2025-2026         ▼]       │
│                                     │
│ ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐ │
│   No snapshot recorded for this     │
│   period.                           │
│                                     │
│          [+ New Snapshot]           │
│ └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘ │
└─────────────────────────────────────┘
```

---

## 📝 Next Steps After Verification

Once Phase 2 is working:

1. **Test all calendar types** (FISCAL, ANNUAL, ZAKAT)
2. **Test year selection** across multiple years
3. **Test with and without data**
4. **Check mobile responsiveness**
5. **Move to Phase 3**: Snapshot Creation

---

## 🎯 Phase 2 Complete When:

✅ Page loads without errors  
✅ Calendar selectors work  
✅ URL updates on selection  
✅ Data displays correctly (if exists)  
✅ Empty state shows (if no data)  
✅ All styling looks good  
✅ Responsive on mobile

**Then you're ready for Phase 3!** 🚀

---

## 📚 Documentation References

- **Full Phase 2 Details**: `spec/bank-assets-phase2-completion.md`
- **API Reference**: `spec/bank-assets-quick-reference.md`
- **Main PRD**: `spec/bank-assets-cash-tracking-prd.md`
- **Architecture**: `spec/bank-assets-architecture.md`

---

**Last Updated**: 2026-02-01  
**Phase 2 Status**: ✅ Complete - Ready for Testing
